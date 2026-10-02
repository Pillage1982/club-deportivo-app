-- Corrección: cuotas de SOCIOS de la temporada 2025-2026 (oct-2025 a jul-2026)
-- quedan todas en $6.000.
--
-- Contexto: los socios (bloque "Socios"/"Socio", sin honorario) pagan el 50%
-- de la cuota de adulto ($12.000 → $6.000). El código ya genera así las cuotas
-- nuevas (cuotaModel.generarMensualidadMasiva, commit 0216c25), pero las cuotas
-- de la temporada 2025-2026 cargadas antes de ese cambio quedaron mezcladas:
-- unas a $12.000 y otras a $6.000. Este script las deja parejas en $6.000.
--
-- Reemplaza, para esta temporada, a CORRECCION_cuotas_socios_20260825.sql
-- (que solo tocaba pendientes/vencidas y nunca se ejecutó).
--
-- Efecto en la deuda: deuda = SUM(cuotas) - SUM(pagos). La tabla `pagos` NO se
-- toca (es la plata que realmente entró). Si un socio ya pagó una cuota a
-- $12.000, al bajarla a $6.000 esos $6.000 de más quedan descontando su deuda
-- de otros meses, o como saldo a favor si no debe nada (ver PASO 3).
--
-- Socios honorarios: no deben tener cuotas; este script no los toca (PASO 0
-- solo los lista para revisarlos aparte).
--
-- ORDEN: ejecutar primero en la BD de pruebas (u402516660_Diablada_dev), revisar
-- los PASOS 0 a 3 (solo lectura) y recién después el PASO 4. Repetir en
-- producción con un respaldo de la BD descargado antes desde phpMyAdmin.

-- ============================================================
-- PASO 0 (solo lectura): socios honorarios con cuotas de la temporada
-- (no deberían tener; si aparece algo, revisarlo aparte)
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno, p.bloque, p.es_honorario,
       c.id AS cuota_id, c.mes, c.anio, c.monto, c.estado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE (p.es_honorario = 1
       OR LOWER(TRIM(p.bloque)) IN ('socios honorario','socios honorarios','socio honorario','socio honorarios'))
  AND ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

-- ============================================================
-- PASO 1 (solo lectura): resumen por estado y monto actual
-- (todo lo que no sea 6000 se va a corregir; revisar si aparece un monto raro)
-- ============================================================
SELECT c.estado, c.monto, COUNT(*) AS cuotas, COUNT(DISTINCT c.persona_id) AS socios
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
GROUP BY c.estado, c.monto
ORDER BY c.estado, c.monto;

-- ============================================================
-- PASO 2 (solo lectura): detalle de las cuotas que cambian
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       c.id AS cuota_id, c.mes, c.anio, c.monto AS monto_actual, 6000 AS monto_nuevo, c.estado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
  AND c.monto <> 6000
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

-- ============================================================
-- PASO 3 (solo lectura): deuda de cada socio antes y después
-- deuda_nueva < 0 = saldo a favor (pagó cuotas a $12.000)
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno,
       COALESCE(cu.total, 0) - COALESCE(pg.total, 0)                     AS deuda_actual,
       COALESCE(cu.total, 0) - COALESCE(cu.rebaja, 0) - COALESCE(pg.total, 0) AS deuda_nueva
FROM personas p
JOIN (
  SELECT c.persona_id,
         SUM(c.monto) AS total,
         SUM(CASE WHEN ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
                   AND c.monto <> 6000 THEN c.monto - 6000 ELSE 0 END) AS rebaja
  FROM cuotas c GROUP BY c.persona_id
) cu ON cu.persona_id = p.id
LEFT JOIN (SELECT persona_id, SUM(monto_total) AS total FROM pagos GROUP BY persona_id) pg ON pg.persona_id = p.id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND cu.rebaja <> 0
ORDER BY deuda_nueva, p.apellido_paterno, p.nombres;

-- ============================================================
-- PASO 4: respaldo + corrección
-- ============================================================
CREATE TABLE respaldo_cuotas_socios_temporada_20261002 AS
SELECT c.*
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
  AND c.monto <> 6000;

UPDATE cuotas c
JOIN respaldo_cuotas_socios_temporada_20261002 r ON r.id = c.id
SET c.monto = 6000;

-- Una cuota vencida con un abono parcial de $6.000 o más queda pagada con el
-- monto nuevo. Solo se revisan las cuotas recién corregidas.
UPDATE cuotas c
JOIN respaldo_cuotas_socios_temporada_20261002 r ON r.id = c.id
JOIN (
  SELECT referencia_id, SUM(monto_pagado) AS pagado
  FROM pago_detalle WHERE tipo = 'cuota' GROUP BY referencia_id
) d ON d.referencia_id = c.id
SET c.estado = 'pagado'
WHERE c.estado IN ('pendiente','vencido')
  AND d.pagado >= c.monto;

-- ============================================================
-- PASO 5 (solo lectura): verificación — debe quedar una sola fila por estado, monto 6000
-- ============================================================
SELECT c.estado, c.monto, COUNT(*) AS cuotas
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND ((c.anio = 2025 AND c.mes BETWEEN 10 AND 12) OR (c.anio = 2026 AND c.mes BETWEEN 1 AND 7))
GROUP BY c.estado, c.monto;

-- ============================================================
-- REVERSA (solo si hay que deshacer): restaura monto y estado desde el respaldo
-- ============================================================
-- UPDATE cuotas c
-- JOIN respaldo_cuotas_socios_temporada_20261002 r ON r.id = c.id
-- SET c.monto = r.monto, c.estado = r.estado;
--
-- Cuando todo esté confirmado:
-- DROP TABLE respaldo_cuotas_socios_temporada_20261002;
