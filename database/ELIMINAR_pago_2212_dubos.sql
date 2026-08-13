-- Elimina el pago 2212 (Daniela Dubos Rojas, RUT 18234880-5): $12.000
-- registrados en julio 2026 por error de tipeo en el ultimo documento de
-- pagos. Verificado: no tiene ningun pago_detalle vinculado (no se aplico
-- a ninguna cuota, no genero puntaje) -- es una eliminacion aislada y segura.

CREATE TABLE IF NOT EXISTS respaldo_eliminacion_20260813_pagos LIKE pagos;
INSERT IGNORE INTO respaldo_eliminacion_20260813_pagos SELECT * FROM pagos WHERE id = 2212;

START TRANSACTION;

-- Verificacion final antes de borrar: debe confirmar RUT, monto y que
-- pago_detalle esta vacio. Si algo no coincide, hacer ROLLBACK y no continuar.
SELECT pg.id, pg.monto_total, pg.fecha, p.rut, p.nombres, p.apellido_paterno,
       (SELECT COUNT(*) FROM pago_detalle WHERE pago_id = pg.id) AS detalles_vinculados
FROM pagos pg
JOIN personas p ON p.id = pg.persona_id
WHERE pg.id = 2212;

DELETE FROM pagos WHERE id = 2212;

COMMIT;

-- Confirmacion: debe devolver 0 filas
SELECT * FROM pagos WHERE id = 2212;
