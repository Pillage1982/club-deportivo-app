-- Desglose completo del puntaje usado en formaciones para
-- Williams Daisuke Rounin Alcayaga Sotomayor (RUT 23749198-K):
-- cuotas + asistencia + antiguedad (1 punto por año desde fecha_ingreso).

-- 1) Resumen total (igual formula que usa formacionModel para el ranking del bloque)
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
           ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE()) END AS puntaje_total_usado_en_formacion
FROM personas p
LEFT JOIN puntajes pt ON pt.persona_id = p.id
WHERE p.rut = '23749198-K'
GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque, p.fecha_ingreso;

-- 2) Detalle fila por fila de cada puntaje que se le sumo (para ver de donde
-- viene cada punto: que cuota, que evento de asistencia, etc.)
SELECT pt.id, pt.cuota_id, pt.asistencia_id, pt.evento_id, pt.puntos, pt.detalle, pt.fecha
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
WHERE p.rut = '23749198-K'
ORDER BY pt.fecha, pt.id;

-- 3) Todo el bloque de Williams, ordenado como lo hace formacionModel
-- (cambiar 'Arancibia' u otro texto de bloque no aplica; el bloque real
-- se ve en la fila 1 de esta misma consulta -- copiarlo aqui una vez conocido):
-- SELECT p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque,
--        COALESCE(SUM(pt.puntos),0) + CASE
--          WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
--          ELSE TIMESTAMPDIFF(YEAR,p.fecha_ingreso,CURDATE())
--        END AS puntaje
-- FROM personas p
-- LEFT JOIN puntajes pt ON pt.persona_id=p.id
-- WHERE p.activo=1 AND COALESCE(p.estado,'activo')='activo' AND COALESCE(p.es_honorario,0)=0
--   AND p.bloque = 'AQUI_EL_BLOQUE_DE_WILLIAMS'
-- GROUP BY p.id,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque
-- ORDER BY puntaje DESC, p.fecha_ingreso ASC, p.apellido_paterno ASC, p.nombres ASC;
