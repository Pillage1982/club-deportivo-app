-- Corrección de puntaje de asistencia (2026-10-23), acompaña al cambio de código
-- del mismo día en backend/models/puntajeModel.js (condicionCuotaAlDia).
--
-- Problema 1: "cuota al día" exigía tener PAGADA la cuota del mes de la actividad.
-- Agosto y septiembre no tienen cuota (las 10 cuotas van de octubre a julio), así
-- que toda actividad de esos meses quedaba "sin cuota al día" para todos: las del
-- 2 al 9 de septiembre (Ayquina) y también la Misa a la Chilena del 26-09, que ya
-- cuenta en el ranking de la temporada 2026-2027. Regla corregida: en agosto y
-- septiembre basta con no deber cuotas de meses anteriores.
--
-- Problema 2: al eliminar una actividad sus asistencias se borraban, pero sus
-- puntos no: seguían sumando en el ranking ("Evento eliminado" en el historial).
--
-- Qué hace:
--   PASOS 0 a 2 (solo lectura): diagnóstico.
--   PASO 3: respaldo de todos los puntajes de asistencia.
--   PASO 4: recalcula el puntaje de las asistencias de agosto y septiembre 2026
--           con la regla nueva (misma consulta que recalcularPuntajesAsistencia).
--   PASO 5: borra los puntajes de asistencias que ya no existen.
--   PASO 6 (solo lectura): verificación.
-- No toca asistencias, cuotas, pagos ni puntajes de cuotas.
--
-- ORDEN: primero en u402516660_Diablada_dev. En producción, con respaldo de la BD
-- descargado antes desde phpMyAdmin y DESPUÉS de desplegar el código nuevo (si no,
-- un pago registrado entretanto vuelve a calcular con la regla antigua).
-- La tabla respaldo_* NO se borra (auditoría de la directiva anterior); la usa la
-- REVERSA.

-- ============================================================
-- PASO 0 (solo lectura): por actividad de ago-sep 2026, puntos actuales y nuevos
-- ============================================================
SELECT e.id AS evento_id, e.nombre, e.fecha,
       COUNT(*) AS asistencias_con_puntaje,
       SUM(COALESCE(pt.puntos, 0)) AS puntos_actuales,
       SUM(CASE a.estado
         WHEN 'presente'            THEN IF(x.al_dia, 10, 5)
         WHEN 'atrasado'            THEN IF(x.al_dia, 7, 3)
         WHEN 'justificado'         THEN IF(x.al_dia, 5, 1)
         WHEN 'vestimenta_distinta' THEN IF(x.al_dia, 3, 1)
         WHEN 'licencia_medica'     THEN 6
         WHEN 'retiro_sin_aviso'    THEN -3
       END) AS puntos_nuevos,
       SUM(x.al_dia = 0) AS quedan_sin_cuota_al_dia
FROM asistencias a
JOIN eventos e ON e.id = a.evento_id
LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
JOIN (
  SELECT a2.id,
    (
      (MONTH(e2.fecha) IN (8, 9) OR EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a2.persona_id AND c.anio = YEAR(e2.fecha) AND c.mes = MONTH(e2.fecha) AND c.estado = 'pagado'
      ))
      AND NOT EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a2.persona_id
          AND (c.anio < YEAR(e2.fecha) OR (c.anio = YEAR(e2.fecha) AND c.mes <= MONTH(e2.fecha)))
          AND c.estado <> 'pagado'
      )
    ) AS al_dia
  FROM asistencias a2
  JOIN eventos e2 ON e2.id = a2.evento_id
) x ON x.id = a.id
WHERE e.fecha >= '2026-08-01' AND e.fecha < '2026-10-01'
  AND a.estado <> 'ausente'
  AND e.nombre NOT REGEXP '^Actividad [0-9]{4}-[0-9]{2}-[0-9]{2}'
GROUP BY e.id, e.nombre, e.fecha
ORDER BY e.fecha;

-- ============================================================
-- PASO 1 (solo lectura): quiénes seguirán "sin cuota al día" en esas actividades
-- (deben alguna cuota anterior) y cuál es su cuota impaga más antigua
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno, p.bloque,
       COUNT(DISTINCT a.id) AS asistencias_ago_sep,
       (SELECT CONCAT(c.mes, '/', c.anio, ' (', c.estado, ')') FROM cuotas c
        WHERE c.persona_id = p.id AND c.estado <> 'pagado'
          AND (c.anio < 2026 OR (c.anio = 2026 AND c.mes <= 9))
        ORDER BY c.anio, c.mes LIMIT 1) AS cuota_impaga_mas_antigua
FROM asistencias a
JOIN eventos e ON e.id = a.evento_id
JOIN personas p ON p.id = a.persona_id
WHERE e.fecha >= '2026-08-01' AND e.fecha < '2026-10-01'
  AND a.estado <> 'ausente'
  AND EXISTS (
    SELECT 1 FROM cuotas c
    WHERE c.persona_id = a.persona_id AND c.estado <> 'pagado'
      AND (c.anio < YEAR(e.fecha) OR (c.anio = YEAR(e.fecha) AND c.mes <= MONTH(e.fecha)))
  )
GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.bloque
ORDER BY p.apellido_paterno, p.nombres;

-- ============================================================
-- PASO 2 (solo lectura): puntajes de asistencias que ya no existen
-- (actividad eliminada)
-- ============================================================
SELECT pt.id, pt.persona_id, pt.evento_id, pt.puntos, pt.detalle, pt.fecha
FROM puntajes pt
LEFT JOIN asistencias a ON a.id = pt.asistencia_id
WHERE pt.asistencia_id IS NOT NULL AND a.id IS NULL
ORDER BY pt.fecha;

-- ============================================================
-- PASO 3: respaldo
-- ============================================================
CREATE TABLE respaldo_puntajes_asistencia_20261023 AS
SELECT * FROM puntajes WHERE asistencia_id IS NOT NULL;

-- ============================================================
-- PASO 4: recalcular las asistencias de agosto y septiembre 2026
-- ============================================================
INSERT INTO puntajes
  (persona_id, asistencia_id, evento_id, puntos, detalle, fecha)
SELECT
  x.persona_id,
  x.id,
  x.evento_id,
  CASE x.estado
    WHEN 'presente'            THEN IF(x.al_dia, 10, 5)
    WHEN 'atrasado'            THEN IF(x.al_dia, 7, 3)
    WHEN 'justificado'         THEN IF(x.al_dia, 5, 1)
    WHEN 'vestimenta_distinta' THEN IF(x.al_dia, 3, 1)
    WHEN 'licencia_medica'     THEN 6
    WHEN 'retiro_sin_aviso'    THEN -3
  END,
  CASE x.estado
    WHEN 'presente'            THEN CONCAT('Presente ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
    WHEN 'atrasado'            THEN CONCAT('Atraso ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
    WHEN 'justificado'         THEN CONCAT('Justificación ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
    WHEN 'vestimenta_distinta' THEN CONCAT('Vestimenta distinta ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
    WHEN 'licencia_medica'     THEN 'Licencia médica'
    WHEN 'retiro_sin_aviso'    THEN 'Retiro sin aviso'
  END,
  x.fecha
FROM (
  SELECT
    a.id, a.persona_id, a.evento_id, a.estado, DATE(e.fecha) AS fecha,
    (
      (MONTH(e.fecha) IN (8, 9) OR EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a.persona_id AND c.anio = YEAR(e.fecha) AND c.mes = MONTH(e.fecha) AND c.estado = 'pagado'
      ))
      AND NOT EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a.persona_id
          AND (c.anio < YEAR(e.fecha) OR (c.anio = YEAR(e.fecha) AND c.mes <= MONTH(e.fecha)))
          AND c.estado <> 'pagado'
      )
    ) AS al_dia
  FROM asistencias a
  JOIN eventos e ON e.id = a.evento_id
  WHERE e.fecha >= '2026-08-01' AND e.fecha < '2026-10-01'
    AND a.estado <> 'ausente'
    AND e.nombre NOT REGEXP '^Actividad [0-9]{4}-[0-9]{2}-[0-9]{2}'
) x
ON DUPLICATE KEY UPDATE
  persona_id = VALUES(persona_id), evento_id = VALUES(evento_id),
  puntos = VALUES(puntos), detalle = VALUES(detalle), fecha = VALUES(fecha);

-- ============================================================
-- PASO 5: borrar puntajes de asistencias que ya no existen
-- ============================================================
DELETE pt FROM puntajes pt
LEFT JOIN asistencias a ON a.id = pt.asistencia_id
WHERE pt.asistencia_id IS NOT NULL AND a.id IS NULL;

-- ============================================================
-- PASO 6 (solo lectura): verificación — repetir el PASO 0 (puntos_actuales debe
-- ser igual a puntos_nuevos) y el PASO 2 (debe venir vacío)
-- ============================================================

-- ============================================================
-- REVERSA (solo si hay que deshacer): vuelve los puntajes de asistencia al
-- respaldo del PASO 3
-- ============================================================
-- DELETE FROM puntajes WHERE asistencia_id IS NOT NULL;
-- INSERT INTO puntajes SELECT * FROM respaldo_puntajes_asistencia_20261023;
