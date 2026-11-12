-- =============================================================================
-- DIAGNÓSTICO (SOLO LECTURA) — Pagos duplicados  (v2, criterios más amplios)
-- Fecha: 2026-11-11
-- =============================================================================
-- NO borra nada. Correr en la base que corresponda (prod o dev).
-- Un "duplicado" puede ser un pago legítimo repetido: revisar UNO A UNO.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- A) INDICADOR FUERTE — cuotas PAGADAS DE MÁS.
--    Si a una cuota se le aplicó MÁS que su monto, es que se pagó dos veces.
--    (Un abono parcial + su completación suman EXACTO el monto, así que NO salen
--    aquí; solo salen las realmente sobrepagadas.)
-- -----------------------------------------------------------------------------
SELECT
  c.id                                   AS cuota_id,
  CONCAT(per.nombres, ' ', per.apellido_paterno) AS integrante,
  c.mes, c.anio,
  c.monto                                AS monto_cuota,
  c.estado,
  COUNT(pd.id)                           AS veces,
  SUM(pd.monto_pagado)                   AS total_pagado,
  SUM(pd.monto_pagado) - c.monto         AS pagado_de_mas,
  GROUP_CONCAT(pd.pago_id ORDER BY pd.pago_id) AS ids_pagos
FROM pago_detalle pd
JOIN cuotas c      ON c.id = pd.referencia_id
JOIN personas per  ON per.id = c.persona_id
WHERE pd.tipo = 'cuota'
GROUP BY c.id
HAVING SUM(pd.monto_pagado) > c.monto
ORDER BY pagado_de_mas DESC;


-- -----------------------------------------------------------------------------
-- B) VISTA AMPLIA — mismo integrante + mismo monto + mismo tipo, CUALQUIER fecha.
--    Muestra las fechas y los comprobantes para poder distinguir a ojo un
--    duplicado real de dos pagos legítimos iguales.
-- -----------------------------------------------------------------------------
SELECT
  p.persona_id,
  CONCAT(per.nombres, ' ', per.apellido_paterno) AS integrante,
  p.monto_total,
  p.tipo_pago,
  COUNT(*)                               AS veces,
  GROUP_CONCAT(p.id ORDER BY p.id)       AS ids_pagos,
  GROUP_CONCAT(DATE(p.fecha) ORDER BY p.id) AS fechas,
  GROUP_CONCAT(COALESCE(p.comprobante_path,'(sin archivo)') ORDER BY p.id SEPARATOR ' | ') AS comprobantes
FROM pagos p
JOIN personas per ON per.id = p.persona_id
GROUP BY p.persona_id, p.monto_total, p.tipo_pago
HAVING COUNT(*) > 1
ORDER BY veces DESC, p.monto_total DESC;


-- -----------------------------------------------------------------------------
-- C) MISMO COMPROBANTE en más de un pago (archivo reutilizado).
--    OJO: un reparto crea VARIOS pagos con el MISMO comprobante a propósito
--    (uno por beneficiario). Eso NO es duplicado. Aquí es duplicado solo si los
--    pagos son del MISMO integrante.
-- -----------------------------------------------------------------------------
SELECT
  p.comprobante_path,
  COUNT(*)                               AS pagos_con_este_archivo,
  COUNT(DISTINCT p.persona_id)           AS integrantes_distintos,
  GROUP_CONCAT(p.id ORDER BY p.id)       AS ids_pagos,
  GROUP_CONCAT(DISTINCT CONCAT(per.nombres,' ',per.apellido_paterno) SEPARATOR ' | ') AS integrantes
FROM pagos p
JOIN personas per ON per.id = p.persona_id
WHERE p.comprobante_path IS NOT NULL AND p.comprobante_path <> ''
GROUP BY p.comprobante_path
HAVING COUNT(*) > 1
ORDER BY pagos_con_este_archivo DESC;

-- =============================================================================
-- Lo importante es (A): cuotas pagadas de más = duplicado real. Con esos ids de
-- pago armamos el borrado seguro (revertir cuota + borrar puntaje + borrar pago).
-- =============================================================================
