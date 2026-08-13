-- Desglose de puntaje del bloque "Arcangeles" (Gran Diablada Calamena)
-- Misma formula que usa formacionModel.js para el ranking del bloque:
-- puntaje = SUM(puntajes.puntos) + 1 punto por año desde fecha_ingreso.

-- 1) Resumen por persona: cuotas + asistencia + antiguedad + total
SELECT
  p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque,
  p.fecha_ingreso,
  CASE
    WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
    ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE())
  END AS puntos_antiguedad,
  COALESCE(SUM(CASE WHEN pt.cuota_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_cuotas,
  COALESCE(SUM(CASE WHEN pt.asistencia_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_asistencia,
  COALESCE(SUM(pt.puntos), 0)
    + CASE WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
           ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE()) END AS puntaje_total
FROM personas p
LEFT JOIN puntajes pt ON pt.persona_id = p.id
WHERE p.bloque = 'Arcangeles'
  AND p.activo = 1 AND COALESCE(p.estado,'activo') = 'activo' AND COALESCE(p.es_honorario,0) = 0
GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque, p.fecha_ingreso
ORDER BY puntaje_total DESC, p.fecha_ingreso ASC, p.apellido_paterno ASC, p.nombres ASC;

-- 2) Detalle fila por fila de cada punto sumado a cada integrante del bloque
-- (de donde viene cada punto: que cuota, que evento de asistencia, etc.)
SELECT
  p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
  pt.id, pt.cuota_id, pt.asistencia_id, pt.evento_id, pt.puntos, pt.detalle, pt.fecha
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
WHERE p.bloque = 'Arcangeles'
  AND p.activo = 1 AND COALESCE(p.estado,'activo') = 'activo' AND COALESCE(p.es_honorario,0) = 0
ORDER BY p.apellido_paterno, p.nombres, pt.fecha, pt.id;
