-- Desglose de puntaje actual en produccion para los 3 bloques con cuadratura
-- manual de los lideres de bloque (Diablesas, Diablos, Chinas Supay), para
-- comparar contra las planillas "Cuadratura Diablesas.xlsx", "Cuadratura
-- Diablos.xlsx" y "Cuadratura Supay.xlsx" y generar la correccion.
--
-- Misma formula que usa vista_ranking_puntaje / formacionModel.js:
-- puntaje_total = SUM(puntajes.puntos) + 1 punto por año desde fecha_ingreso.
--
-- Ejecutar en produccion (phpMyAdmin / hPanel) y exportar el resultado a
-- CSV o Excel para hacer la comparacion contra las cuadraturas.

SELECT
  p.id, p.rut, p.apellido_paterno, p.apellido_materno, p.nombres, p.bloque,
  p.fecha_ingreso, p.estado, p.activo,
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
WHERE p.bloque IN ('Diablesas', 'Diablos', 'Chinas Supay')
GROUP BY p.id, p.rut, p.apellido_paterno, p.apellido_materno, p.nombres, p.bloque,
         p.fecha_ingreso, p.estado, p.activo
ORDER BY p.bloque, p.apellido_paterno, p.nombres;
