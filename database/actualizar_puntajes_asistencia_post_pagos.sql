-- BORRADOR TECNICO: NO APLICAR COMO RESULTADO OFICIAL.
-- Contrastado con Estatuto GDC 2016, arts. 8.4 y 9.3 solamente.
-- Faltan las transformaciones, cortes y formacion exigidos por los arts.
-- 9.1.1, 9.1.2, 9.1.3 y 12.2, ademas de clasificar eventos puntuables.
-- Actualizacion GDC 2025-2026 posterior a la carga de pagos.
-- Compatible con MySQL/phpMyAdmin y segura para volver a ejecutar.
-- Requisito: haber importado seed_gdc_calamena_final.sql.

SET NAMES utf8mb4;

-- Conserva el estado anterior a la primera ejecucion de esta actualizacion.
CREATE TABLE IF NOT EXISTS respaldo_puntajes_antes_recalculo LIKE puntajes;
INSERT IGNORE INTO respaldo_puntajes_antes_recalculo SELECT * FROM puntajes;

START TRANSACTION;

UPDATE tipos_cuotas
SET monto_base = 12000, descripcion = 'Cuota mensual GDC'
WHERE nombre = 'Mensualidad';

-- Elimina la antigua bonificacion plana de 100, que producia 290 puntos.
DELETE FROM puntajes
WHERE detalle = 'Bonificación pago anual en un solo pago (temporada 2025-2026)';

-- Art. 9.3, escenario a: pago anual completo en octubre = 200 puntos.
-- Las nueve cuotas futuras ya tienen 20; se corrige octubre de 10 a 20.
UPDATE puntajes pt
JOIN cuotas c ON c.id = pt.cuota_id
JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
JOIN pagos pg ON pg.id = d.pago_id
JOIN (
  SELECT d2.pago_id
  FROM pago_detalle d2
  WHERE d2.tipo = 'cuota'
  GROUP BY d2.pago_id
  HAVING COUNT(DISTINCT d2.referencia_id) = 10
     AND SUM(d2.monto_pagado) >= 120000
) anual ON anual.pago_id = pg.id
SET pt.puntos = 20,
    pt.detalle = 'Cuota pagada anticipadamente (art. 9.3, pago anual al inicio)'
WHERE c.anio = 2025 AND c.mes = 10
  AND YEAR(pg.fecha) = 2025 AND MONTH(pg.fecha) = 10
  AND pg.monto_total >= 120000;

-- Ausencias y eventos provisionales no participan del ranking oficial.
DELETE pt
FROM puntajes pt
JOIN asistencias a ON a.id = pt.asistencia_id
JOIN eventos e ON e.id = a.evento_id
WHERE a.estado = 'ausente' OR e.nombre LIKE 'Actividad %';

-- Estar al dia exige tener pagado el mes de la actividad y no mantener cuotas
-- anteriores o del mismo mes pendientes/vencidas.
INSERT INTO puntajes
  (persona_id, asistencia_id, evento_id, puntos, detalle, fecha)
SELECT
  a.persona_id,
  a.id,
  a.evento_id,
  CASE a.estado
    WHEN 'presente' THEN IF(fin.al_dia = 1, 10, 5)
    WHEN 'atrasado' THEN IF(fin.al_dia = 1, 7, 3)
    WHEN 'justificado' THEN IF(fin.al_dia = 1, 5, 1)
    WHEN 'vestimenta_distinta' THEN IF(fin.al_dia = 1, 3, 1)
    WHEN 'licencia_medica' THEN 6
    WHEN 'retiro_sin_aviso' THEN -3
  END,
  CASE a.estado
    WHEN 'presente' THEN IF(fin.al_dia = 1, 'Presente + cuota al día', 'Presente sin cuota al día')
    WHEN 'atrasado' THEN IF(fin.al_dia = 1, 'Atraso + cuota al día', 'Atraso sin cuota al día')
    WHEN 'justificado' THEN IF(fin.al_dia = 1, 'Justificación + cuota al día', 'Justificación sin cuota al día')
    WHEN 'vestimenta_distinta' THEN IF(fin.al_dia = 1, 'Vestimenta distinta + cuota al día', 'Vestimenta distinta sin cuota al día')
    WHEN 'licencia_medica' THEN 'Licencia médica'
    WHEN 'retiro_sin_aviso' THEN 'Retiro sin aviso'
  END,
  DATE(e.fecha)
FROM asistencias a
JOIN eventos e ON e.id = a.evento_id
JOIN (
  SELECT
    a2.id AS asistencia_id,
    IF(
      EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a2.persona_id
          AND c.anio = YEAR(e2.fecha) AND c.mes = MONTH(e2.fecha)
          AND c.estado = 'pagado'
      )
      AND NOT EXISTS (
        SELECT 1 FROM cuotas c
        WHERE c.persona_id = a2.persona_id
          AND (c.anio < YEAR(e2.fecha)
            OR (c.anio = YEAR(e2.fecha) AND c.mes <= MONTH(e2.fecha)))
          AND c.estado <> 'pagado'
      ), 1, 0
    ) AS al_dia
  FROM asistencias a2
  JOIN eventos e2 ON e2.id = a2.evento_id
) fin ON fin.asistencia_id = a.id
WHERE a.estado IN (
  'presente', 'atrasado', 'justificado', 'licencia_medica',
  'vestimenta_distinta', 'retiro_sin_aviso'
)
  AND e.nombre NOT LIKE 'Actividad %'
ON DUPLICATE KEY UPDATE
  persona_id = VALUES(persona_id), evento_id = VALUES(evento_id),
  puntos = VALUES(puntos), detalle = VALUES(detalle), fecha = VALUES(fecha);

COMMIT;

-- Controles posteriores visibles como resultados en phpMyAdmin.
SELECT 'respaldo_puntajes' AS control, COUNT(*) AS total
FROM respaldo_puntajes_antes_recalculo
UNION ALL SELECT 'puntajes_actuales', COUNT(*) FROM puntajes
UNION ALL SELECT 'puntajes_asistencia', COUNT(*) FROM puntajes WHERE asistencia_id IS NOT NULL
UNION ALL
SELECT 'asistencias_sin_puntaje', COUNT(*)
FROM asistencias a
JOIN eventos e ON e.id = a.evento_id
LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
WHERE a.estado <> 'ausente' AND e.nombre NOT LIKE 'Actividad %' AND pt.id IS NULL
UNION ALL
SELECT 'eventos_provisionales_excluidos', COUNT(*)
FROM eventos WHERE nombre LIKE 'Actividad %';

-- Ranking vigente que alimenta la formacion, ordenado por bloque.
SELECT
  p.bloque,
  p.rut,
  CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno) AS integrante,
  COALESCE(SUM(pt.puntos), 0) AS puntaje_total
FROM personas p
LEFT JOIN puntajes pt ON pt.persona_id = p.id
WHERE p.activo = 1
  AND COALESCE(p.estado, 'activo') = 'activo'
  AND COALESCE(p.es_honorario, 0) = 0
  AND p.bloque IS NOT NULL AND TRIM(p.bloque) <> ''
  AND LOWER(TRIM(p.bloque)) NOT IN ('socio', 'socios', 'socio honorario', 'socios honorarios')
GROUP BY p.id, p.bloque, p.rut, p.nombres, p.apellido_paterno,
  p.apellido_materno, p.fecha_ingreso
ORDER BY p.bloque, puntaje_total DESC, p.fecha_ingreso,
  p.apellido_paterno, p.nombres;
