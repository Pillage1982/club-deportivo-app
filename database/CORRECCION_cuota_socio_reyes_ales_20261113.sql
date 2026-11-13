-- ============================================================================
-- CORRECCIÓN tarifa de cuotas: Katherine Paola Reyes Alés (socia)
-- Fecha: 2026-11-13
-- ----------------------------------------------------------------------------
-- Contexto: sus cuotas de la temporada 2026-2027 se generaron cuando todavía
-- figuraba SIN bloque, por lo que quedaron a tarifa de bailarín ($12.000).
-- Ya se la asignó al bloque "Socios", pero las cuotas ya generadas conservan
-- la tarifa vieja. Este script las baja a la tarifa de socio (50% = $6.000),
-- SOLO las cuotas aún no pagadas de la temporada vigente.
--
-- ⚠️ PRODUCCIÓN: hacer RESPALDO de la tabla `cuotas` antes de ejecutar.
--    Correr los pasos en orden; revisar el PREVIEW (paso 3) antes del UPDATE.
-- ============================================================================

-- 1) Encontrar su persona_id (verificar que sea la correcta y su bloque = Socios)
SELECT id, nombres, apellido_paterno, apellido_materno, bloque
FROM personas
WHERE apellido_paterno LIKE 'Reyes%' AND nombres LIKE 'Katherine%';

-- 2) Fijar el id encontrado arriba
SET @pid = 0;   -- <<< reemplazar 0 por el id del paso 1

-- 3) PREVIEW: cuotas de mensualidad de la temporada 2026-2027, no pagadas,
--    que se van a corregir (deberían ser 10 cuotas a $12.000).
SELECT c.id, c.mes, c.anio, c.monto AS monto_actual,
       ROUND(t.monto_base/2) AS monto_corregido, c.estado
FROM cuotas c
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
WHERE c.persona_id = @pid
  AND c.estado <> 'pagado'
  AND ( (c.mes >= 10 AND c.anio = 2026) OR (c.mes <= 7 AND c.anio = 2027) )
ORDER BY c.anio, c.mes;

-- 4) UPDATE: aplicar la tarifa de socio (50% del valor adulto) a esas cuotas.
--    Solo toca las no pagadas y solo si el monto no es ya el de socio.
UPDATE cuotas c
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
SET c.monto = ROUND(t.monto_base/2)
WHERE c.persona_id = @pid
  AND c.estado <> 'pagado'
  AND c.monto <> ROUND(t.monto_base/2)
  AND ( (c.mes >= 10 AND c.anio = 2026) OR (c.mes <= 7 AND c.anio = 2027) );

-- 5) Verificación posterior (deberían quedar todas a $6.000)
SELECT c.mes, c.anio, c.monto, c.estado
FROM cuotas c
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
WHERE c.persona_id = @pid
  AND ( (c.mes >= 10 AND c.anio = 2026) OR (c.mes <= 7 AND c.anio = 2027) )
ORDER BY c.anio, c.mes;

-- ============================================================================
-- Después de correr esto:
--   Panel → Finanzas → "Aplicar saldos a favor": los $60.000 del pago (que hoy
--   están como saldo a favor) cubren las 10 cuotas de $6.000 → quedan pagadas,
--   se genera el puntaje de cuota y la asistencia se recalcula a "+ cuota al día".
-- ============================================================================
