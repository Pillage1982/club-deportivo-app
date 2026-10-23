-- Diagnóstico y corrección (2026-10-23): actividades de la temporada vigente que
-- no aparecen en el historial de puntaje ni suman en el ranking.
--
-- El ranking y el historial solo suman filas de `puntajes`. Si una actividad no
-- aparece es porque esa fila no existe. Dos causas posibles:
--   A) La asistencia está (presente/atrasado/...) pero sin fila de puntaje.
--      → La corrige el PASO 3 (recalcular), sin perder nada.
--   B) La asistencia quedó "ausente": escaneo offline que se sincronizó después de
--      finalizada la actividad (el código anterior a 721470b lo descartaba).
--      → El escaneo ya no existe en el teléfono; hay que corregir a mano (ver PASO 1).
--
-- ORDEN: correr PASOS 0 y 1 (solo lectura) y revisar. Si hay casos A, correr
-- PASOS 2 y 3 y repetir el PASO 0. Con respaldo de la BD descargado antes.
-- Requiere el código 721470b desplegado (misma regla de "cuota al día").

-- ============================================================
-- PASO 0 (solo lectura): por actividad de la temporada vigente
--   sin_puntaje = asistencias que deberían sumar y no tienen fila (caso A)
--   ausentes    = posibles casos B (revisar con la directiva)
-- ============================================================
SELECT e.id, e.nombre, e.fecha, e.finalizado,
       COUNT(a.id) AS asistencias,
       SUM(a.estado NOT IN ('ausente')) AS con_asistencia,
       SUM(a.estado = 'ausente') AS ausentes,
       SUM(a.estado <> 'ausente' AND pt.id IS NULL) AS sin_puntaje
FROM eventos e
LEFT JOIN asistencias a ON a.evento_id = e.id
LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
WHERE DATE(e.fecha) >= (
  SELECT COALESCE(MAX(DATE(fecha)), '1900-01-01') FROM eventos
  WHERE inicia_temporada = 1 AND DATE(fecha) <= CURDATE()
)
  AND e.fecha <= NOW()
GROUP BY e.id, e.nombre, e.fecha, e.finalizado
ORDER BY e.fecha;

-- ============================================================
-- PASO 1 (solo lectura): detalle de un integrante (cambiar el apellido)
-- ============================================================
SELECT p.nombres, p.apellido_paterno, e.nombre AS actividad, e.fecha,
       COALESCE(a.estado, 'SIN REGISTRO') AS estado, a.fecha_registro,
       pt.puntos, pt.detalle
FROM eventos e
JOIN personas p ON p.apellido_paterno = 'Carozzi'
LEFT JOIN asistencias a ON a.evento_id = e.id AND a.persona_id = p.id
LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
WHERE DATE(e.fecha) >= (
  SELECT COALESCE(MAX(DATE(fecha)), '1900-01-01') FROM eventos
  WHERE inicia_temporada = 1 AND DATE(fecha) <= CURDATE()
)
  AND e.fecha <= NOW()
ORDER BY e.fecha;

-- ============================================================
-- PASO 2: respaldo
-- ============================================================
CREATE TABLE respaldo_puntajes_asistencia_temporada_20261023 AS
SELECT * FROM puntajes WHERE asistencia_id IS NOT NULL;

-- ============================================================
-- PASO 3: recalcular el puntaje de TODAS las asistencias de la temporada vigente
-- (misma consulta que recalcularPuntajesAsistencia; crea las filas que faltan y
-- actualiza las existentes con la regla vigente de "cuota al día")
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
  WHERE DATE(e.fecha) >= (
    SELECT COALESCE(MAX(DATE(fecha)), '1900-01-01') FROM eventos
    WHERE inicia_temporada = 1 AND DATE(fecha) <= CURDATE()
  )
    AND a.estado <> 'ausente'
    AND e.nombre NOT REGEXP '^Actividad [0-9]{4}-[0-9]{2}-[0-9]{2}'
) x
ON DUPLICATE KEY UPDATE
  persona_id = VALUES(persona_id), evento_id = VALUES(evento_id),
  puntos = VALUES(puntos), detalle = VALUES(detalle), fecha = VALUES(fecha);

-- ============================================================
-- PASO 4 (solo lectura): repetir el PASO 0; sin_puntaje debe quedar en 0
-- ============================================================

-- REVERSA (solo si hay que deshacer):
-- DELETE FROM puntajes WHERE asistencia_id IS NOT NULL;
-- INSERT INTO puntajes SELECT * FROM respaldo_puntajes_asistencia_temporada_20261023;
