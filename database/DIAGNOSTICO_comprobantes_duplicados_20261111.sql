-- =============================================================================
-- DIAGNÓSTICO (SOLO LECTURA) — Comprobantes de depósito duplicados
-- Fecha: 2026-11-11
-- =============================================================================
-- Objetivo: ver el panorama de reenvíos (el mismo comprobante enviado varias veces).
-- NO borra nada.
--
-- NOTA sobre SHA-256: los comprobantes ANTERIORES a la mejora tienen
--   hash_archivo = NULL (nunca se calcularon). Por eso:
--     - Query B encuentra duplicados exactos SOLO entre los NUEVOS (con hash).
--     - Query C es el proxy para los HISTÓRICOS (mismo integrante+monto+fecha).
--   Para el SHA-256 real de los históricos hay que calcularlo de los archivos
--   en el servidor (script aparte).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) ESTADO GENERAL: cuántos tienen hash (nuevos) vs NULL (históricos).
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                               AS total,
  SUM(hash_archivo IS NOT NULL AND hash_archivo <> '')  AS con_hash_nuevos,
  SUM(hash_archivo IS NULL OR hash_archivo = '')        AS sin_hash_historicos,
  SUM(pago_id IS NOT NULL)                               AS registrados,
  SUM(pago_id IS NULL)                                   AS pendientes
FROM comprobantes_deposito;


-- -----------------------------------------------------------------------------
-- B) HASHES REPETIDOS entre los NUEVOS (duplicado exacto, detección automática).
--    Cada fila = un mismo archivo subido más de una vez.
-- -----------------------------------------------------------------------------
SELECT
  cd.hash_archivo,
  COUNT(*)                                 AS veces,
  GROUP_CONCAT(cd.id ORDER BY cd.id)       AS folios,
  GROUP_CONCAT(DISTINCT CONCAT(per.nombres,' ',per.apellido_paterno) SEPARATOR ' | ') AS integrantes,
  SUM(cd.pago_id IS NOT NULL)              AS cuantos_registrados
FROM comprobantes_deposito cd
JOIN personas per ON per.id = cd.persona_id
WHERE cd.hash_archivo IS NOT NULL AND cd.hash_archivo <> ''
GROUP BY cd.hash_archivo
HAVING COUNT(*) > 1
ORDER BY veces DESC;


-- -----------------------------------------------------------------------------
-- C) PROXY PARA LOS HISTÓRICOS: mismo integrante + mismo monto + misma fecha.
--    Aquí caen los reenvíos sin hash (German 83/99, Piero 84/85, etc.).
--    'cuantos_registrados' > 0 avisa si alguno del grupo ya se procesó en un pago.
-- -----------------------------------------------------------------------------
SELECT
  cd.persona_id,
  CONCAT(per.nombres,' ',per.apellido_paterno) AS integrante,
  cd.monto,
  cd.fecha_deposito,
  COUNT(*)                                 AS veces,
  GROUP_CONCAT(cd.id ORDER BY cd.id)       AS folios,
  SUM(cd.pago_id IS NOT NULL)              AS cuantos_registrados
FROM comprobantes_deposito cd
JOIN personas per ON per.id = cd.persona_id
GROUP BY cd.persona_id, cd.monto, cd.fecha_deposito
HAVING COUNT(*) > 1
ORDER BY veces DESC, cd.fecha_deposito DESC;


-- -----------------------------------------------------------------------------
-- D) DETALLE de todos los comprobantes que caen en algún grupo de (C),
--    para revisarlos uno a uno (concepto, archivo, si ya tiene pago).
-- -----------------------------------------------------------------------------
SELECT
  cd.id        AS folio,
  CONCAT(per.nombres,' ',per.apellido_paterno) AS integrante,
  cd.monto,
  cd.fecha_deposito,
  cd.concepto,
  cd.adjunto_path,
  cd.hash_archivo,
  cd.pago_id,
  cd.creado_en
FROM comprobantes_deposito cd
JOIN personas per ON per.id = cd.persona_id
JOIN (
  SELECT persona_id, monto, fecha_deposito
  FROM comprobantes_deposito
  GROUP BY persona_id, monto, fecha_deposito
  HAVING COUNT(*) > 1
) dup ON dup.persona_id = cd.persona_id AND dup.monto = cd.monto AND dup.fecha_deposito = cd.fecha_deposito
ORDER BY cd.persona_id, cd.fecha_deposito, cd.creado_en;

-- =============================================================================
-- Con A/B/C/D tenemos el panorama. Para el SHA-256 real de los históricos
-- (detección exacta por contenido) va un script Node que hashea los archivos.
-- =============================================================================
