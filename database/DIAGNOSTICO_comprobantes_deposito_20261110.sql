-- =============================================================================
-- DIAGNÓSTICO (SOLO LECTURA) — Comprobantes de depósito del Portal del Socio
-- Etapa 1 del diseño "Comprobantes de pago con reparto familiar y anti-duplicados"
-- Fecha: 2026-11-10
-- =============================================================================
-- Objetivo: antes de tocar el esquema, entender qué hay hoy en
--   comprobantes_deposito y detectar POSIBLES reenvíos del mismo integrante
--   (mismo monto + misma fecha). NO borra ni modifica nada: todo es SELECT.
--
-- IMPORTANTE:
--   * Correr contra la BD REAL (producción) — la local está desactualizada.
--   * NADA se borra en esta etapa. Un "posible duplicado" aquí todavía puede
--     ser un envío legítimo (p. ej. dos aportes el mismo día). Solo se mira.
--   * El esquema actual NO guarda banco ni nº de transacción, así que la
--     detección retroactiva solo puede ser por (persona + monto + fecha).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) RESUMEN GENERAL
--    Cuántos comprobantes hay y cuántos ya quedaron ligados a un pago.
-- -----------------------------------------------------------------------------
SELECT
  COUNT(*)                                    AS total_comprobantes,
  SUM(pago_id IS NOT NULL)                    AS ya_vinculados_a_pago,
  SUM(pago_id IS NULL)                        AS pendientes_sin_pago,
  MIN(fecha_deposito)                         AS primer_deposito,
  MAX(fecha_deposito)                         AS ultimo_deposito,
  COUNT(DISTINCT persona_id)                  AS integrantes_distintos
FROM comprobantes_deposito;


-- -----------------------------------------------------------------------------
-- B) POSIBLES REENVÍOS DEL MISMO INTEGRANTE (candidatos a duplicado)
--    Agrupa por integrante + monto + fecha. Si COUNT > 1, el socio mandó
--    "lo mismo" más de una vez. Hay que revisarlos UNO A UNO antes de decidir.
-- -----------------------------------------------------------------------------
SELECT
  cd.persona_id,
  CONCAT(p.nombres, ' ', p.apellido_paterno, ' ', COALESCE(p.apellido_materno,'')) AS integrante,
  cd.monto,
  cd.fecha_deposito,
  COUNT(*)                                   AS veces_enviado,
  GROUP_CONCAT(cd.id ORDER BY cd.creado_en)  AS ids_comprobantes,
  SUM(cd.pago_id IS NOT NULL)                AS cuantos_ya_vinculados
FROM comprobantes_deposito cd
JOIN personas p ON p.id = cd.persona_id
GROUP BY cd.persona_id, cd.monto, cd.fecha_deposito
HAVING COUNT(*) > 1
ORDER BY veces_enviado DESC, cd.fecha_deposito DESC;


-- -----------------------------------------------------------------------------
-- C) DETALLE de esos grupos (para decidir cuál se conserva en la Etapa 3)
--    Muestra cada fila de los grupos marcados en (B), con su concepto y archivo.
-- -----------------------------------------------------------------------------
SELECT
  cd.id,
  cd.persona_id,
  CONCAT(p.nombres, ' ', p.apellido_paterno) AS integrante,
  cd.monto,
  cd.fecha_deposito,
  cd.concepto,
  cd.adjunto_path,
  cd.pago_id,
  cd.creado_en
FROM comprobantes_deposito cd
JOIN personas p ON p.id = cd.persona_id
JOIN (
  SELECT persona_id, monto, fecha_deposito
  FROM comprobantes_deposito
  GROUP BY persona_id, monto, fecha_deposito
  HAVING COUNT(*) > 1
) dup
  ON dup.persona_id = cd.persona_id
 AND dup.monto = cd.monto
 AND dup.fecha_deposito = cd.fecha_deposito
ORDER BY cd.persona_id, cd.fecha_deposito, cd.monto, cd.creado_en;


-- -----------------------------------------------------------------------------
-- D) VOLUMEN POR MES (para dimensionar la migración de la Etapa 3)
--    Cuántos comprobantes nacerían como 1 comprobante + 1 asignación cada uno.
-- -----------------------------------------------------------------------------
SELECT
  DATE_FORMAT(cd.fecha_deposito, '%Y-%m') AS mes,
  COUNT(*)                                AS comprobantes,
  SUM(cd.monto)                           AS monto_total
FROM comprobantes_deposito cd
GROUP BY DATE_FORMAT(cd.fecha_deposito, '%Y-%m')
ORDER BY mes;


-- -----------------------------------------------------------------------------
-- E) VERIFICACIÓN RÁPIDA DE INTEGRIDAD
--    Comprobantes cuyo persona_id no exista (no debería devolver filas).
-- -----------------------------------------------------------------------------
SELECT cd.id, cd.persona_id
FROM comprobantes_deposito cd
LEFT JOIN personas p ON p.id = cd.persona_id
WHERE p.id IS NULL;

-- =============================================================================
-- FIN DEL DIAGNÓSTICO — no se escribió nada en la base.
-- =============================================================================
