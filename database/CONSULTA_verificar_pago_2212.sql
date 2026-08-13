-- Verifica puntualmente si el pago 2212 (julio, $12.000, Dubos Rojas) tiene
-- algun detalle vinculado a una cuota. Deberia devolver 0 filas si el pago
-- quedo "sobrante" sin aplicarse a ninguna cuota.

SELECT * FROM pago_detalle WHERE pago_id = 2212;

-- Todos los pagos de Dubos Rojas ordenados por fecha, solo columnas clave
-- (para confirmar si falta la fila de octubre $24.000 en la vista anterior)
SELECT pg.id, pg.monto_total, pg.fecha
FROM pagos pg
JOIN personas p ON p.id = pg.persona_id
WHERE p.rut = '18234880-5'
ORDER BY pg.fecha;
