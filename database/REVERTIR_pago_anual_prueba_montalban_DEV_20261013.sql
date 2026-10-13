-- SOLO BD DE PRUEBAS (dev.gdcayquina.cl). NO ejecutar en producción.
--
-- Revierte el pago anual de prueba del 13-10-2026 a Rodrigo Alejandro Montalban
-- Cofre ($30.000), que por un error del pago anual (tomaba cuotas pendientes de
-- cualquier temporada) se aplicó a las cuotas 3/2026 a 7/2026 de la temporada
-- anterior en vez de la 2026-2027. El pago está vinculado a cuotas (pago_detalle),
-- por eso el panel no permite eliminarlo.
--
-- Deja todo como antes del pago: cuotas otra vez vencidas/pendientes, sin
-- pago_detalle, sin puntaje de cuota generado hoy y sin el pago.

-- PASO 1: identificar el pago. Debe devolver UNA sola fila (monto 30000, 5 detalles).
-- Si devuelve 0 o más de 1, NO continuar.
SELECT pg.id, pg.monto_total, pg.fecha, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       (SELECT COUNT(*) FROM pago_detalle d WHERE d.pago_id = pg.id) AS detalles_vinculados
FROM pagos pg
JOIN personas p ON p.id = pg.persona_id
WHERE p.nombres = 'Rodrigo Alejandro'
  AND p.apellido_paterno = 'Montalban'
  AND pg.monto_total = 30000
  AND DATE(pg.fecha) = '2026-10-13';

-- PASO 2: anotar el id del PASO 1 aquí (reemplazar 0).
SET @pago_id = 0;

-- PASO 3: respaldo de lo que se va a tocar.
CREATE TABLE IF NOT EXISTS respaldo_revertir_20261013_pagos        LIKE pagos;
CREATE TABLE IF NOT EXISTS respaldo_revertir_20261013_pago_detalle LIKE pago_detalle;
CREATE TABLE IF NOT EXISTS respaldo_revertir_20261013_cuotas       LIKE cuotas;
CREATE TABLE IF NOT EXISTS respaldo_revertir_20261013_puntajes     LIKE puntajes;

INSERT IGNORE INTO respaldo_revertir_20261013_pagos        SELECT * FROM pagos        WHERE id = @pago_id;
INSERT IGNORE INTO respaldo_revertir_20261013_pago_detalle SELECT * FROM pago_detalle WHERE pago_id = @pago_id;
INSERT IGNORE INTO respaldo_revertir_20261013_cuotas
  SELECT c.* FROM cuotas c
  WHERE c.id IN (SELECT referencia_id FROM pago_detalle WHERE pago_id = @pago_id AND tipo = 'cuota');
INSERT IGNORE INTO respaldo_revertir_20261013_puntajes
  SELECT pt.* FROM puntajes pt
  WHERE pt.cuota_id IN (SELECT referencia_id FROM pago_detalle WHERE pago_id = @pago_id AND tipo = 'cuota')
    AND DATE(pt.created_at) = '2026-10-13';

-- PASO 4: revertir.
START TRANSACTION;

DELETE pt FROM puntajes pt
WHERE pt.cuota_id IN (SELECT referencia_id FROM respaldo_revertir_20261013_pago_detalle WHERE pago_id = @pago_id)
  AND DATE(pt.created_at) = '2026-10-13';

UPDATE cuotas c
SET c.estado = CASE WHEN c.fecha_vencimiento < CURDATE() THEN 'vencido' ELSE 'pendiente' END
WHERE c.id IN (SELECT referencia_id FROM respaldo_revertir_20261013_pago_detalle WHERE pago_id = @pago_id);

DELETE FROM pago_detalle WHERE pago_id = @pago_id;
DELETE FROM pagos        WHERE id      = @pago_id;

-- Si el depósito de un socio quedó vinculado a este pago, vuelve a pendiente
UPDATE comprobantes_deposito SET pago_id = NULL WHERE pago_id = @pago_id;

COMMIT;

-- PASO 5: confirmación. El pago ya no existe y las cuotas 3/2026–7/2026 vuelven a vencido.
SELECT * FROM pagos WHERE id = @pago_id;
SELECT id, mes, anio, monto, estado FROM respaldo_revertir_20261013_cuotas ORDER BY anio, mes;
SELECT c.id, c.mes, c.anio, c.estado FROM cuotas c
WHERE c.id IN (SELECT id FROM respaldo_revertir_20261013_cuotas) ORDER BY c.anio, c.mes;
