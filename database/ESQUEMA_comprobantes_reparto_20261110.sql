-- =============================================================================
-- ESQUEMA — Anti-duplicados + reparto de comprobantes (Etapa 2)
-- Calcado de backend/config/migrations.js (asegurarCamposPersonas + asegurarTablasDocumentosSocio)
-- Fecha: 2026-11-10
-- =============================================================================
-- Para QUÉ: permite crear el esquema por phpMyAdmin SIN desplegar el código,
--   para poder probar la migración de datos (Etapa 3) en dev/producción.
--
-- IMPORTANTE:
--   * Aplicar UNA sola vez por ambiente (dev, luego producción). Hoy ninguno de
--     estos objetos existe, así que corre limpio de principio a fin.
--   * Cuando después se despliegue el código, las migraciones usan
--     "CREATE TABLE IF NOT EXISTS" y chequeo de columnas/índices por
--     INFORMATION_SCHEMA, así que detectan todo esto ya creado y NO lo repiten.
--   * RESPALDO PREVIO recomendado (esto altera personas y comprobantes_deposito).
-- =============================================================================


-- 1) personas.apoderado_id  — vínculo apoderado -> integrante (se puebla a mano).
--    Si diera error en "AFTER rut_apoderado", quitar solo esa parte (es cosmética).
ALTER TABLE personas
  ADD COLUMN apoderado_id BIGINT NULL AFTER rut_apoderado,
  ADD CONSTRAINT fk_persona_apoderado FOREIGN KEY (apoderado_id) REFERENCES personas(id) ON DELETE SET NULL;


-- 2) comprobantes_deposito — columnas anti-duplicados + total.
--    banco NOT NULL DEFAULT '' a propósito (un UNIQUE permite varios NULL).
ALTER TABLE comprobantes_deposito
  ADD COLUMN banco              VARCHAR(60)  NOT NULL DEFAULT '' AFTER persona_id,
  ADD COLUMN numero_transaccion VARCHAR(60)  NULL               AFTER banco,
  ADD COLUMN monto_total        INT          NULL               AFTER monto,
  ADD COLUMN hash_archivo       CHAR(64)     NULL               AFTER adjunto_path;

-- Filas históricas: el total es su propio monto.
UPDATE comprobantes_deposito SET monto_total = monto WHERE monto_total IS NULL;

-- Índices anti-duplicados. hash y numero_transaccion quedan NULL en las históricas,
-- y en un UNIQUE los NULL cuentan como distintos, así que no se bloquean entre sí.
ALTER TABLE comprobantes_deposito
  ADD UNIQUE KEY uq_comprobante_hash         (hash_archivo),
  ADD UNIQUE KEY uq_comprobante_banco_numero (banco, numero_transaccion);


-- 3) comprobante_asignaciones — el reparto 1 comprobante -> N integrantes.
--    cuota_id NULL: el socio indica beneficiario + monto; la cuota la fija tesorería.
--    pago_id: el pago creado para ese beneficiario al confirmar.
CREATE TABLE IF NOT EXISTS comprobante_asignaciones (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  comprobante_id BIGINT NOT NULL,
  integrante_id  BIGINT NOT NULL,
  monto_asignado INT NOT NULL,
  cuota_id       BIGINT NULL,
  estado         ENUM('automatica','pendiente_revision','aprobada','rechazada') NOT NULL DEFAULT 'pendiente_revision',
  revisado_por   INT NULL,
  revisado_en    DATETIME NULL,
  pago_id        BIGINT NULL,
  creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_comprobante_integrante (comprobante_id, integrante_id),
  KEY idx_asignacion_integrante (integrante_id),
  KEY idx_asignacion_estado (estado),
  CONSTRAINT fk_asignacion_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobantes_deposito(id) ON DELETE CASCADE,
  CONSTRAINT fk_asignacion_integrante  FOREIGN KEY (integrante_id)  REFERENCES personas(id)             ON DELETE CASCADE,
  CONSTRAINT fk_asignacion_cuota       FOREIGN KEY (cuota_id)       REFERENCES cuotas(id)               ON DELETE SET NULL
);

-- =============================================================================
-- Verificación rápida (opcional): deben aparecer las columnas y la tabla nuevas.
--   SHOW COLUMNS FROM comprobantes_deposito;
--   SHOW INDEX  FROM comprobantes_deposito;
--   SHOW COLUMNS FROM personas LIKE 'apoderado_id';
--   SHOW CREATE TABLE comprobante_asignaciones;
-- Después de esto, correr MIGRACION_comprobantes_a_asignaciones_20261110.sql
-- =============================================================================
