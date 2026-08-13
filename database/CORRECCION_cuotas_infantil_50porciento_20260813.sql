-- Corrección retroactiva de cuotas de bailarines infantiles (Art. 2.1.B Estatutos
-- GDC 2016: 0 a 11 años, 11 meses y 29 días pagan 50% de la cuota de adulto).
--
-- El fix de codigo (commit de1637f) solo aplica el 50% a las cuotas que se
-- generen DE AHORA EN ADELANTE ("Generar cuotas del mes" / "Generar temporada
-- completa"). Las cuotas que ya existian en la BD antes de ese cambio quedaron
-- al valor completo. Este script corrige esas cuotas, identificadas a partir
-- de integrantes_13-08-2026.xlsx (48 integrantes del bloque "Infantil",
-- activos, no honorarios, menores de 12 años al 2026-08-13).
--
-- IMPORTANTE: correr primero el PASO 1 (solo lectura) y revisar el resultado
-- antes de ejecutar el PASO 3 (UPDATE). No correr nada de esto directo sin
-- mirar los resultados del PASO 1 y 2.

-- ============================================================
-- PASO 0: lista de RUT de bailarines infantiles afectados
-- ============================================================
-- (48 RUT, normalizados sin puntos ni espacios, en mayúsculas)

-- ============================================================
-- PASO 1 (solo lectura): impacto total, agrupado por estado de cuota
-- ============================================================
SELECT
  c.estado,
  COUNT(*) AS cantidad_cuotas,
  SUM(c.monto) AS monto_actual_total,
  SUM(ROUND(c.monto/2)) AS monto_corregido_total
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
WHERE UPPER(REPLACE(REPLACE(p.rut,'.',''),' ','')) IN (
  '24736184-8','24756453-5','24760969-5','24766846-2','24828427-7','24829746-8',
  '24893954-0','24903088-0','24905474-7','24916661-8','24924797-9','24966740-4',
  '24974578-2','25010509-6','25016245-6','25066742-6','25131204-4','25171203-3',
  '25318647-K','25377126-7','25407881-6','25419756-4','25433878-8','25516080-K',
  '25545587-7','25554671-6','25572199-2','25635267-2','25638263-6','25678307-K',
  '25737832-2','25743573-3','25935949-K','25968491-9','26044167-1','26085332-5',
  '26135065-3','26188319-8','26190477-2','26262401-3','26389857-5','26696664-4',
  '27044985-9','27310337-6','27540211-7','27617117-7','28093053-9','28367836-6'
)
AND c.monto = t.monto_base   -- solo cuotas que siguen al valor completo (sin corregir)
GROUP BY c.estado;

-- ============================================================
-- PASO 2 (solo lectura): detalle fila por fila, para revisar antes de tocar nada
-- ============================================================
SELECT
  p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
  c.id AS cuota_id, c.mes, c.anio, c.monto AS monto_actual,
  ROUND(c.monto/2) AS monto_corregido, c.estado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
WHERE UPPER(REPLACE(REPLACE(p.rut,'.',''),' ','')) IN (
  '24736184-8','24756453-5','24760969-5','24766846-2','24828427-7','24829746-8',
  '24893954-0','24903088-0','24905474-7','24916661-8','24924797-9','24966740-4',
  '24974578-2','25010509-6','25016245-6','25066742-6','25131204-4','25171203-3',
  '25318647-K','25377126-7','25407881-6','25419756-4','25433878-8','25516080-K',
  '25545587-7','25554671-6','25572199-2','25635267-2','25638263-6','25678307-K',
  '25737832-2','25743573-3','25935949-K','25968491-9','26044167-1','26085332-5',
  '26135065-3','26188319-8','26190477-2','26262401-3','26389857-5','26696664-4',
  '27044985-9','27310337-6','27540211-7','27617117-7','28093053-9','28367836-6'
)
AND c.monto = t.monto_base
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

-- ============================================================
-- PASO 3: corrige SOLO cuotas pendientes/vencidas (no tocan pagos ya hechos)
-- Con respaldo propio antes de modificar nada.
-- ============================================================

CREATE TABLE IF NOT EXISTS respaldo_cuotas_infantil_20260813 AS
SELECT c.*
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
WHERE c.estado IN ('pendiente','vencido')
  AND UPPER(REPLACE(REPLACE(p.rut,'.',''),' ','')) IN (
    '24736184-8','24756453-5','24760969-5','24766846-2','24828427-7','24829746-8',
    '24893954-0','24903088-0','24905474-7','24916661-8','24924797-9','24966740-4',
    '24974578-2','25010509-6','25016245-6','25066742-6','25131204-4','25171203-3',
    '25318647-K','25377126-7','25407881-6','25419756-4','25433878-8','25516080-K',
    '25545587-7','25554671-6','25572199-2','25635267-2','25638263-6','25678307-K',
    '25737832-2','25743573-3','25935949-K','25968491-9','26044167-1','26085332-5',
    '26135065-3','26188319-8','26190477-2','26262401-3','26389857-5','26696664-4',
    '27044985-9','27310337-6','27540211-7','27617117-7','28093053-9','28367836-6'
  )
  AND c.monto = t.monto_base;

UPDATE cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
SET c.monto = ROUND(c.monto/2)
WHERE c.estado IN ('pendiente','vencido')
  AND UPPER(REPLACE(REPLACE(p.rut,'.',''),' ','')) IN (
    '24736184-8','24756453-5','24760969-5','24766846-2','24828427-7','24829746-8',
    '24893954-0','24903088-0','24905474-7','24916661-8','24924797-9','24966740-4',
    '24974578-2','25010509-6','25016245-6','25066742-6','25131204-4','25171203-3',
    '25318647-K','25377126-7','25407881-6','25419756-4','25433878-8','25516080-K',
    '25545587-7','25554671-6','25572199-2','25635267-2','25638263-6','25678307-K',
    '25737832-2','25743573-3','25935949-K','25968491-9','26044167-1','26085332-5',
    '26135065-3','26188319-8','26190477-2','26262401-3','26389857-5','26696664-4',
    '27044985-9','27310337-6','27540211-7','27617117-7','28093053-9','28367836-6'
  )
  AND c.monto = t.monto_base;

-- ============================================================
-- PENDIENTE DE DECISIÓN: cuotas YA PAGADAS al valor completo por estos
-- mismos 48 integrantes. Esto no se corrige automáticamente porque implica
-- una decisión de la Directiva (dejar como saldo a favor, devolver, o no
-- tocar pagos pasados). Correr esta consulta para dimensionarlo:
-- ============================================================
-- SELECT p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
--        c.id AS cuota_id, c.mes, c.anio, c.monto,
--        c.monto - ROUND(c.monto/2) AS diferencia_a_favor
-- FROM cuotas c
-- JOIN personas p ON p.id = c.persona_id
-- JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
-- WHERE c.estado = 'pagado'
--   AND UPPER(REPLACE(REPLACE(p.rut,'.',''),' ','')) IN (/* mismos 48 RUT */)
--   AND c.monto = t.monto_base
-- ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;
