-- =============================================================================
-- MIGRACIÓN DE DATOS — Comprobantes históricos  ->  comprobante_asignaciones
-- Etapa 3 del diseño "Comprobantes de pago con reparto familiar y anti-duplicados"
-- Fecha: 2026-11-10
-- =============================================================================
-- Qué hace: por cada fila de comprobantes_deposito que todavía NO tenga reparto,
--   crea UNA asignación al propio socio (beneficiario = quien lo subió,
--   monto_asignado = su monto). Deja la base lista para el modelo 1 -> N.
--
-- Estado de cada asignación migrada:
--   * pago_id presente  -> 'aprobada'   (ya quedó registrado el pago)
--   * pago_id NULL       -> 'automatica' (es el propio socio; falta que tesorería confirme)
--
-- REQUISITOS ANTES DE CORRER:
--   1) Debe existir ya la tabla comprobante_asignaciones y la columna
--      comprobantes_deposito.monto_total (las crea la Etapa 2 al desplegar la app).
--   2) RESPALDO PREVIO de la base (o al menos de comprobantes_deposito y
--      comprobante_asignaciones). Esta migración ESCRIBE.
--   3) Correr contra la BD REAL (producción), tras el respaldo.
--
-- Es IDEMPOTENTE: solo inserta donde falta (WHERE NOT EXISTS). Re-correrla no
-- duplica nada. NO borra ni toca comprobantes_deposito.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- PASO 1 — PREVIEW (solo lectura). Mirar ANTES de insertar.
--   Cuántos comprobantes hay y cuántos quedarían migrados en este pase.
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM comprobantes_deposito)          AS total_comprobantes,
  (SELECT COUNT(*) FROM comprobante_asignaciones)       AS asignaciones_actuales,
  (SELECT COUNT(*) FROM comprobantes_deposito cd
     WHERE NOT EXISTS (SELECT 1 FROM comprobante_asignaciones a
                       WHERE a.comprobante_id = cd.id))  AS se_migraran_ahora;


-- -----------------------------------------------------------------------------
-- PASO 2 — MIGRACIÓN (escribe). Una asignación por comprobante sin reparto.
--   cuota_id queda NULL: la fija tesorería al confirmar.
--   creado_en se copia del comprobante para conservar la fecha original.
-- -----------------------------------------------------------------------------
INSERT INTO comprobante_asignaciones
  (comprobante_id, integrante_id, monto_asignado, cuota_id, estado, pago_id, creado_en)
SELECT
  cd.id,
  cd.persona_id,
  COALESCE(cd.monto_total, cd.monto),
  NULL,
  CASE WHEN cd.pago_id IS NOT NULL THEN 'aprobada' ELSE 'automatica' END,
  cd.pago_id,
  cd.creado_en
FROM comprobantes_deposito cd
WHERE NOT EXISTS (
  SELECT 1 FROM comprobante_asignaciones a WHERE a.comprobante_id = cd.id
);


-- -----------------------------------------------------------------------------
-- PASO 3 — VERIFICACIÓN (solo lectura). Correr DESPUÉS del paso 2.
-- -----------------------------------------------------------------------------

-- 3.1 Tras la migración, cada comprobante debe tener exactamente 1 asignación.
--     'comprobantes_sin_asignacion' debe dar 0.
SELECT
  (SELECT COUNT(*) FROM comprobantes_deposito)    AS total_comprobantes,
  (SELECT COUNT(*) FROM comprobante_asignaciones) AS total_asignaciones,
  (SELECT COUNT(*) FROM comprobantes_deposito cd
     WHERE NOT EXISTS (SELECT 1 FROM comprobante_asignaciones a
                       WHERE a.comprobante_id = cd.id)) AS comprobantes_sin_asignacion;

-- 3.2 El total asignado debe cuadrar con el total de los comprobantes.
--     Ambas columnas deben ser iguales.
SELECT
  (SELECT SUM(COALESCE(monto_total, monto)) FROM comprobantes_deposito) AS suma_comprobantes,
  (SELECT SUM(monto_asignado) FROM comprobante_asignaciones)            AS suma_asignaciones;

-- 3.3 Reparto por estado de las asignaciones migradas.
SELECT estado, COUNT(*) AS cantidad, SUM(monto_asignado) AS monto
FROM comprobante_asignaciones
GROUP BY estado
ORDER BY estado;

-- 3.4 Integridad: ninguna asignación debe apuntar a un comprobante o integrante
--     inexistente (no debería devolver filas).
SELECT a.id, a.comprobante_id, a.integrante_id
FROM comprobante_asignaciones a
LEFT JOIN comprobantes_deposito cd ON cd.id = a.comprobante_id
LEFT JOIN personas p               ON p.id  = a.integrante_id
WHERE cd.id IS NULL OR p.id IS NULL;

-- =============================================================================
-- FIN. Si 3.1 da 0 sin asignación y 3.2 cuadra, la migración quedó correcta.
-- =============================================================================
