-- Puntaje real registrado (por cuotas) para los 23 integrantes que llegaron a
-- $120.000 total sin pagar todo de una vez en octubre. Comparar la columna
-- puntaje_real contra el desglose calculado en la conversacion.

SELECT p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       SUM(pt.puntos) AS puntaje_real,
       COUNT(pt.id) AS cantidad_cuotas_puntuadas
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
WHERE pt.cuota_id IS NOT NULL
  AND p.rut IN (
    '20347778-3','22723843-7','24504416-K','16259337-4','23749198-K',
    '14596996-4','23759640-4','22146800-7','19867652-7','17093953-0',
    '24277809-K','10241653-8','20992433-1','16785228-9','11931043-1',
    '20399143-6','16564816-1','22777012-0','20399418-4','7886094-4',
    '22297913-7','13633292-9','21086809-7'
  )
GROUP BY p.rut, p.nombres, p.apellido_paterno, p.apellido_materno
ORDER BY p.apellido_paterno, p.nombres;
