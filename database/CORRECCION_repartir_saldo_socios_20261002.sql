-- Corrección complementaria de CORRECCION_cuotas_socios_temporada_2025_2026_20261002.sql
-- (correr DESPUÉS de ese script, en la misma base).
--
-- Problema: al bajar a $6.000 cuotas de socios que ya estaban pagadas a $12.000,
-- el pago quedó asignado (pago_detalle) con $12.000 a una cuota de $6.000. La
-- deuda total del socio se calcula bien (cuotas - pagos), pero ese sobrante no
-- cubre ninguna otra cuota: el socio ve deuda $0 y, a la vez, cuotas "vencidas".
--
-- Qué hace, solo para socios (bloque "Socios"/"Socio", sin honorario):
--   1. Recorta lo asignado a cada cuota hasta su monto (el sobrante queda
--      libre). Si una cuota tiene varias filas, recorta desde la más reciente.
--   2. Reparte el sobrante de cada socio entre sus cuotas impagas, de la más
--      antigua a la más nueva, con filas nuevas de pago_detalle del mismo pago.
--   3. Marca "pagado" las cuotas que quedan cubiertas completas. Si el sobrante
--      no alcanza para la última, queda con abono parcial.
-- La tabla pagos NO se toca. El puntaje no se recalcula (los puntos por pagar a
-- tiempo se asignan al registrar el pago y corresponden a la temporada pasada).
--
-- ORDEN: primero en u402516660_Diablada_dev, revisar PASOS 0 y 1 (solo
-- lectura), ejecutar PASOS 2 a 4 y revisar el 5. En producción, con respaldo de
-- la BD descargado antes desde phpMyAdmin. Las tablas trabajo_* y respaldo_* se
-- borran al final, una vez confirmado (las usa la REVERSA).

-- ============================================================
-- PASO 0 (solo lectura): cuotas de socios con más pago asignado que su monto
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno, c.id AS cuota_id, c.mes, c.anio, c.monto,
       SUM(d.monto_pagado) AS asignado, SUM(d.monto_pagado) - c.monto AS sobrante,
       COUNT(*) AS filas_detalle
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
GROUP BY p.rut, p.nombres, p.apellido_paterno, c.id, c.mes, c.anio, c.monto
HAVING SUM(d.monto_pagado) > c.monto
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

-- ============================================================
-- PASO 1 (solo lectura): por socio, sobrante a repartir y cuotas impagas
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno,
       s.sobrante,
       (SELECT COUNT(*) FROM cuotas c2
         WHERE c2.persona_id = p.id AND c2.estado IN ('pendiente','vencido')) AS cuotas_impagas,
       (SELECT COALESCE(SUM(c2.monto), 0) FROM cuotas c2
         WHERE c2.persona_id = p.id AND c2.estado IN ('pendiente','vencido')) AS monto_impago
FROM (
  SELECT persona_id, SUM(sobrante_cuota) AS sobrante
  FROM (
    SELECT c.persona_id, SUM(d.monto_pagado) - c.monto AS sobrante_cuota
    FROM cuotas c
    JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
    GROUP BY c.id, c.persona_id, c.monto
    HAVING SUM(d.monto_pagado) > c.monto
  ) s0
  GROUP BY persona_id
) s
JOIN personas p ON p.id = s.persona_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
ORDER BY p.apellido_paterno, p.nombres;

-- ============================================================
-- PASO 2: tablas de trabajo y respaldo
-- ============================================================
-- Cuánto recortar de cada fila de pago_detalle: el sobrante de la cuota se
-- descuenta desde la fila más reciente hacia atrás.
CREATE TABLE trabajo_saldo_exceso_20261002 AS
SELECT detalle_id, pago_id, persona_id, exceso
FROM (
  SELECT d.id AS detalle_id, d.pago_id, c.persona_id,
         LEAST(d.monto_pagado, GREATEST(0, (t.total - c.monto) - COALESCE(SUM(d.monto_pagado) OVER (
           PARTITION BY c.id ORDER BY d.id DESC
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0))) AS exceso
  FROM pago_detalle d
  JOIN cuotas c ON d.tipo = 'cuota' AND c.id = d.referencia_id
  JOIN personas p ON p.id = c.persona_id
  JOIN (SELECT referencia_id, SUM(monto_pagado) AS total
          FROM pago_detalle WHERE tipo = 'cuota' GROUP BY referencia_id) t ON t.referencia_id = c.id
  WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
    AND COALESCE(p.es_honorario, 0) = 0
    AND t.total > c.monto
) x
WHERE exceso > 0;

-- Sobrante por socio; las filas nuevas se asignan a su pago más reciente con sobrante
CREATE TABLE trabajo_saldo_socio_20261002 AS
SELECT persona_id, MAX(pago_id) AS pago_id, SUM(exceso) AS saldo
FROM trabajo_saldo_exceso_20261002
GROUP BY persona_id;

-- Reparto: cuotas impagas de esos socios, de la más antigua a la más nueva
CREATE TABLE trabajo_saldo_reparto_20261002 AS
SELECT x.cuota_id, x.persona_id, x.pago_id, x.faltante,
       LEAST(x.faltante, GREATEST(0, x.saldo - x.acumulado_previo)) AS asignar
FROM (
  SELECT c.id AS cuota_id, c.persona_id, s.pago_id, s.saldo,
         c.monto - COALESCE(dp.pagado, 0) AS faltante,
         COALESCE(SUM(c.monto - COALESCE(dp.pagado, 0)) OVER (
           PARTITION BY c.persona_id ORDER BY c.anio, c.mes, c.id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS acumulado_previo
  FROM cuotas c
  JOIN trabajo_saldo_socio_20261002 s ON s.persona_id = c.persona_id
  LEFT JOIN (
    SELECT referencia_id, SUM(monto_pagado) AS pagado
    FROM pago_detalle WHERE tipo = 'cuota' GROUP BY referencia_id
  ) dp ON dp.referencia_id = c.id
  WHERE c.estado IN ('pendiente','vencido')
    AND c.monto - COALESCE(dp.pagado, 0) > 0
) x;

-- Respaldos para la REVERSA
CREATE TABLE respaldo_pago_detalle_saldo_20261002 AS
SELECT d.* FROM pago_detalle d
JOIN trabajo_saldo_exceso_20261002 t ON t.detalle_id = d.id;

CREATE TABLE respaldo_cuotas_saldo_20261002 AS
SELECT c.* FROM cuotas c
JOIN trabajo_saldo_reparto_20261002 r ON r.cuota_id = c.id;

CREATE TABLE trabajo_saldo_meta_20261002 AS
SELECT COALESCE(MAX(id), 0) AS max_detalle_antes FROM pago_detalle;

-- ============================================================
-- PASO 3: recortar asignaciones al monto de la cuota
-- ============================================================
UPDATE pago_detalle d
JOIN trabajo_saldo_exceso_20261002 t ON t.detalle_id = d.id
SET d.monto_pagado = d.monto_pagado - t.exceso;

-- ============================================================
-- PASO 4: asignar el sobrante a las cuotas impagas y marcar las cubiertas
-- ============================================================
INSERT INTO pago_detalle (pago_id, tipo, referencia_id, monto_pagado)
SELECT pago_id, 'cuota', cuota_id, asignar
FROM trabajo_saldo_reparto_20261002
WHERE asignar > 0
ORDER BY persona_id, cuota_id;

UPDATE cuotas c
JOIN trabajo_saldo_reparto_20261002 r ON r.cuota_id = c.id
SET c.estado = 'pagado'
WHERE r.asignar > 0 AND r.asignar = r.faltante;

-- ============================================================
-- PASO 5 (solo lectura): verificación
-- ============================================================
-- 5a. No debe quedar ninguna cuota de socio con más pago asignado que su monto (0)
SELECT COUNT(*) AS cuotas_sobreasignadas
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN (SELECT referencia_id, SUM(monto_pagado) AS pagado
        FROM pago_detalle WHERE tipo = 'cuota' GROUP BY referencia_id) dp ON dp.referencia_id = c.id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND dp.pagado > c.monto;

-- 5b. Socios corregidos: cuotas que quedaron pagadas, abonos parciales y lo que sobra
SELECT p.rut, p.nombres, p.apellido_paterno, s.saldo AS sobrante_inicial,
       SUM(r.asignar) AS asignado,
       s.saldo - SUM(r.asignar) AS sobrante_restante,
       SUM(r.asignar > 0 AND r.asignar = r.faltante) AS cuotas_pagadas,
       SUM(r.asignar > 0 AND r.asignar < r.faltante) AS cuotas_con_abono
FROM trabajo_saldo_socio_20261002 s
JOIN personas p ON p.id = s.persona_id
LEFT JOIN trabajo_saldo_reparto_20261002 r ON r.persona_id = s.persona_id
GROUP BY p.rut, p.nombres, p.apellido_paterno, s.saldo
ORDER BY p.apellido_paterno, p.nombres;

-- ============================================================
-- REVERSA (solo si hay que deshacer)
-- ============================================================
-- DELETE d FROM pago_detalle d
-- JOIN trabajo_saldo_reparto_20261002 r ON r.pago_id = d.pago_id AND r.cuota_id = d.referencia_id
-- WHERE d.tipo = 'cuota' AND d.id > (SELECT max_detalle_antes FROM trabajo_saldo_meta_20261002);
--
-- UPDATE pago_detalle d
-- JOIN respaldo_pago_detalle_saldo_20261002 r ON r.id = d.id
-- SET d.monto_pagado = r.monto_pagado;
--
-- UPDATE cuotas c
-- JOIN respaldo_cuotas_saldo_20261002 r ON r.id = c.id
-- SET c.estado = r.estado;

-- ============================================================
-- LIMPIEZA (cuando todo esté confirmado)
-- ============================================================
-- DROP TABLE trabajo_saldo_exceso_20261002, trabajo_saldo_socio_20261002,
--   trabajo_saldo_reparto_20261002, trabajo_saldo_meta_20261002,
--   respaldo_pago_detalle_saldo_20261002, respaldo_cuotas_saldo_20261002;
