-- Verifica quienes tienen exactamente 200 puntos por concepto de cuotas
-- en la base de datos real, y muestra el detalle de cada cuota que compone
-- ese total para poder revisar si cumplen la condicion estricta del art. 9.3
-- (escenario a: pago completo de $120.000 en octubre, nada en otro mes).

SELECT p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       SUM(pt.puntos) AS puntaje_cuotas_total,
       COUNT(pt.id) AS cantidad_cuotas_puntuadas
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
WHERE pt.cuota_id IS NOT NULL
GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno
HAVING SUM(pt.puntos) = 200
ORDER BY p.apellido_paterno, p.nombres;

-- Detalle mes a mes de cada uno de los que aparezcan arriba (reemplazar el RUT):
-- SELECT c.anio, c.mes, c.monto, pt.puntos, pt.detalle, pt.fecha
-- FROM puntajes pt
-- JOIN cuotas c ON c.id = pt.cuota_id
-- JOIN personas p ON p.id = pt.persona_id
-- WHERE p.rut = 'AQUI_EL_RUT'
-- ORDER BY c.anio, c.mes;
