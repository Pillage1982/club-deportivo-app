-- =============================================================================
-- VINCULAR depósito pendiente de Ximena Madeleine Cure Vega a su pago ya registrado
-- Fecha: 2026-11-05
-- Motivo: el pago de cuota ($120.000, 05-11-2026) se registró con el comprobante
--         subido como archivo (no eligiendo el folio del depósito), por lo que el
--         depósito quedó en "Pendiente" en Tablas → Depósitos. Como el pago está
--         vinculado a cuotas ("Histórico vinculado") no se puede re-vincular desde
--         el panel. Este script marca el depósito como registrado (pago_id).
--
-- SOLO el de Ximena. El de Carlos Humberto Aguilera Vega ya quedó bien vinculado.
--
-- MODO DE USO:
--   1) Hacer RESPALDO de comprobantes_deposito y pagos antes de ejecutar.
--   2) Ejecutar el PASO 1 (solo SELECT) y anotar el folio del depósito y el id del pago.
--   3) Rellenar @folio y @pago en el PASO 2 con esos valores y ejecutar.
--   4) El PASO 3 confirma que quedó vinculado.
-- =============================================================================


-- ----------------------------------------------------------------------------
-- PASO 1 — VERIFICAR (solo lectura, no cambia nada)
-- ----------------------------------------------------------------------------

-- 1a. Persona
SELECT id AS persona_id,
       CONCAT_WS(' ', nombres, apellido_paterno, apellido_materno) AS integrante
FROM personas
WHERE nombres LIKE 'Ximena%'
  AND apellido_paterno = 'Cure'
  AND apellido_materno = 'Vega';

-- 1b. Depósito(s) de Ximena que siguen PENDIENTES (pago_id NULL) -> anotar el folio
SELECT cd.id AS folio_deposito, cd.monto, cd.fecha_deposito, cd.concepto,
       cd.creado_en, cd.pago_id
FROM comprobantes_deposito cd
JOIN personas p ON p.id = cd.persona_id
WHERE p.nombres LIKE 'Ximena%'
  AND p.apellido_paterno = 'Cure'
  AND p.apellido_materno = 'Vega'
  AND cd.pago_id IS NULL
ORDER BY cd.creado_en DESC;

-- 1c. Pago(s) de cuota de Ximena -> anotar el id del pago de $120.000 del 05-11-2026
SELECT pa.id AS pago_id, pa.monto_total, pa.tipo_pago, pa.fecha,
       pa.comprobante_path
FROM pagos pa
JOIN personas p ON p.id = pa.persona_id
WHERE p.nombres LIKE 'Ximena%'
  AND p.apellido_paterno = 'Cure'
  AND p.apellido_materno = 'Vega'
ORDER BY pa.id DESC;


-- ----------------------------------------------------------------------------
-- PASO 2 — VINCULAR (rellenar los dos valores de abajo con lo del PASO 1)
-- ----------------------------------------------------------------------------

SET @folio := NULL;   -- <-- folio del depósito pendiente (PASO 1b)
SET @pago  := NULL;   -- <-- id del pago de cuota de $120.000 (PASO 1c)

-- Guardas de seguridad: solo vincula si el depósito sigue pendiente Y el pago es
-- de la MISMA persona (evita atar un depósito al pago de otro integrante).
UPDATE comprobantes_deposito cd
JOIN pagos pa ON pa.id = @pago
SET cd.pago_id = @pago
WHERE cd.id = @folio
  AND cd.pago_id IS NULL
  AND cd.persona_id = pa.persona_id;


-- ----------------------------------------------------------------------------
-- PASO 3 — CONFIRMAR (debe mostrar el depósito con su pago_id ya asignado)
-- ----------------------------------------------------------------------------

SELECT cd.id AS folio_deposito, cd.monto, cd.pago_id,
       pa.monto_total AS monto_pago, pa.fecha AS fecha_pago
FROM comprobantes_deposito cd
LEFT JOIN pagos pa ON pa.id = cd.pago_id
WHERE cd.id = @folio;
