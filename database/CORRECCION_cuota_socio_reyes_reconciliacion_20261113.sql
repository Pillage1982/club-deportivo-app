-- ============================================================================
-- RECONCILIACIÓN cuotas de socio: Katherine Paola Reyes Alés
-- Fecha: 2026-11-13   (versión SIN @pid: cada statement la identifica por nombre,
--                      funciona aunque se corran uno por uno)
-- ----------------------------------------------------------------------------
-- Es socia (año = 10 cuotas de $6.000 = $60.000) y pagó $60.000, pero figura con
-- $30.000 de deuda: sus 5 cuotas Oct–Feb se pagaron a $12.000 (tarifa vieja de
-- bailarín) antes de pasarla a "Socios" y consumieron todo el pago; las 5 cuotas
-- Mar–Jul quedaron a $6.000 pero pendientes. Hay que redistribuir el pago como
-- 10 × $6.000.
--
-- Pasos: 1) baja a $6.000 las cuotas pagadas que siguen a $12.000; 2) baja su
-- pago_detalle a $6.000 → libera $30.000 del pago como saldo a favor. Luego en el
-- panel "Aplicar saldos a favor" cubre Mar–Jul → deuda $0 y puntaje.
--
-- ⚠️ PRODUCCIÓN: respaldar `cuotas` y `pago_detalle` antes. Revisar el paso 1.
-- ============================================================================

-- 1) VERIFICAR que el filtro de nombre apunta SOLO a Katherine (debe devolver 1)
SELECT id, nombres, apellido_paterno, apellido_materno, bloque
FROM personas
WHERE apellido_paterno LIKE 'Reyes%' AND nombres LIKE 'Katherine%';

-- 2) PREVIEW estado actual (esperado: 5 Oct–Feb pagadas con pagado=12000,
--    5 Mar–Jul pendientes con pagado=0)
SELECT c.mes, c.anio, c.monto, c.estado,
       COALESCE((SELECT SUM(d.monto_pagado) FROM pago_detalle d
                 WHERE d.tipo='cuota' AND d.referencia_id=c.id),0) AS pagado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre='Mensualidad'
WHERE p.apellido_paterno LIKE 'Reyes%' AND p.nombres LIKE 'Katherine%'
  AND ( (c.mes>=10 AND c.anio=2026) OR (c.mes<=7 AND c.anio=2027) )
ORDER BY c.anio, c.mes;

-- 3) Bajar a $6.000 las cuotas PAGADAS que quedaron a $12.000
UPDATE cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre='Mensualidad'
SET c.monto = ROUND(t.monto_base/2)
WHERE p.apellido_paterno LIKE 'Reyes%' AND p.nombres LIKE 'Katherine%'
  AND c.estado='pagado'
  AND c.monto <> ROUND(t.monto_base/2)
  AND ( (c.mes>=10 AND c.anio=2026) OR (c.mes<=7 AND c.anio=2027) );

-- 4) Bajar el pago_detalle de esas cuotas a su nuevo monto ($6.000) → libera los
--    $30.000 de más como saldo a favor del pago (sin tocar pago.monto_total).
UPDATE pago_detalle d
JOIN cuotas c ON c.id = d.referencia_id
JOIN personas p ON p.id = c.persona_id
SET d.monto_pagado = c.monto
WHERE d.tipo='cuota'
  AND p.apellido_paterno LIKE 'Reyes%' AND p.nombres LIKE 'Katherine%'
  AND d.monto_pagado > c.monto
  AND ( (c.mes>=10 AND c.anio=2026) OR (c.mes<=7 AND c.anio=2027) );

-- 5) VERIFICACIÓN: las 10 cuotas a $6.000; Oct–Feb pagadas con pagado=6000 y
--    Mar–Jul pendientes con pagado=0.
SELECT c.mes, c.anio, c.monto, c.estado,
       COALESCE((SELECT SUM(d.monto_pagado) FROM pago_detalle d
                 WHERE d.tipo='cuota' AND d.referencia_id=c.id),0) AS pagado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre='Mensualidad'
WHERE p.apellido_paterno LIKE 'Reyes%' AND p.nombres LIKE 'Katherine%'
  AND ( (c.mes>=10 AND c.anio=2026) OR (c.mes<=7 AND c.anio=2027) )
ORDER BY c.anio, c.mes;

-- 6) Confirmar que el pago quedó con saldo a favor (sobrante debe ser 30000)
SELECT pa.id, pa.monto_total,
       pa.monto_total - COALESCE(SUM(d.monto_pagado),0) AS sobrante
FROM pagos pa
JOIN personas p ON p.id = pa.persona_id
LEFT JOIN pago_detalle d ON d.pago_id = pa.id
WHERE p.apellido_paterno LIKE 'Reyes%' AND p.nombres LIKE 'Katherine%'
  AND pa.tipo_pago='cuota'
GROUP BY pa.id, pa.monto_total;

-- ============================================================================
-- DESPUÉS: Panel → Finanzas → "Aplicar saldos a favor" (ahora el preview debe
-- mostrar ~$30.000 de 1 integrante). Confirmar → cubre Mar–Jul → deuda $0 y
-- puntaje de esas cuotas.
-- ============================================================================
