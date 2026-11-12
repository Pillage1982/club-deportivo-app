-- =============================================================================
-- LIMPIEZA — Depósitos duplicados (reenvíos del mismo archivo, confirmados por SHA-256)
-- Fecha: 2026-11-11
-- =============================================================================
-- Borra SOLO los depósitos duplicados PENDIENTES (pago_id NULL). Se conserva, por
-- cada socio, el comprobante registrado (si lo hay) o uno de los pendientes.
--
-- Confirmado por el script hash-comprobantes-duplicados.js (archivos idénticos):
--   Catherine  63 (borrar) / 65 (queda, pago 2635)
--   German     83, 99 (borrar) / 64 (queda, pago 2640)
--   Constanza  53 (borrar) / 52 (queda)
--   Reinaldo   57 (borrar) / 55 (queda)
--   Piero      85 (borrar) / 84 (queda)
--
-- NO incluye el caso Olga(30)/Diego(31): mismo archivo pero DISTINTAS personas
-- (comprobante compartido o error) — se decide aparte.
--
-- REQUISITOS:
--   1) RESPALDO de la BD de producción antes de correr el PASO 2.
--   2) La cláusula "AND pago_id IS NULL" es un seguro: nunca borra un registrado.
--   3) Al borrar el comprobante se borran en cascada sus comprobante_asignaciones
--      (son pendientes, sin pago). El archivo físico queda huérfano en uploads
--      (inofensivo; se puede limpiar después).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASO 1 — PREVIEW (solo lectura). Verifica que sean exactamente estos 6 y que
--          todos tengan pago_id NULL.
-- -----------------------------------------------------------------------------
SELECT cd.id AS folio,
       CONCAT(per.nombres,' ',per.apellido_paterno) AS integrante,
       cd.monto, cd.fecha_deposito, cd.concepto, cd.pago_id
FROM comprobantes_deposito cd
JOIN personas per ON per.id = cd.persona_id
WHERE cd.id IN (53, 57, 63, 83, 99, 85)
ORDER BY integrante, cd.id;


-- -----------------------------------------------------------------------------
-- PASO 2 — BORRADO. Solo si el PASO 1 muestra los 6 correctos y todos con pago NULL.
-- -----------------------------------------------------------------------------
DELETE FROM comprobantes_deposito
WHERE id IN (53, 57, 63, 83, 99, 85)
  AND pago_id IS NULL;
-- Debe reportar "6 filas afectadas". Si borra menos, revisar cuál tenía pago.


-- -----------------------------------------------------------------------------
-- PASO 3 — VERIFICACIÓN (solo lectura). No debe devolver ninguna de las 6 filas.
-- -----------------------------------------------------------------------------
SELECT id, persona_id, pago_id
FROM comprobantes_deposito
WHERE id IN (53, 57, 63, 83, 99, 85);

-- =============================================================================
-- Tras esto quedan, de cada grupo, solo el comprobante que corresponde.
-- Pendiente aparte: Olga(30)/Diego(31) y los pagos B (Suam/Millaray/Antonella).
-- =============================================================================
