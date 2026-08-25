-- Corrección retroactiva de cuotas de socios (bloque "Socios"/"Socio", sin
-- honorario): pagan 50% del valor de la cuota de adulto, igual que los
-- bailarines menores de 12 años. Mismo criterio agregado a
-- generarMensualidadMasiva en cuotaModel.js (ver commit de este cambio).
--
-- Los socios honorarios (bloque con "Honorario", o es_honorario=1) NO entran
-- en esta corrección: para ellos la cuota no debe existir en absoluto (igual
-- que hoy). Si alguno tiene una cuota generada de antes de este fix, hay que
-- revisarlo aparte (no lo cubre este script) — ver PASO 0.
--
-- El fix de código solo aplica el 50% a las cuotas que se generen DE AHORA EN
-- ADELANTE ("Generar cuotas del mes" / "Generar temporada completa"). Las
-- cuotas de socios que ya existían en la BD antes de este cambio quedaron al
-- valor completo. Este script las corrige.
--
-- IMPORTANTE: correr primero PASO 0, 1 y 2 (solo lectura) y revisar el
-- resultado antes de ejecutar el PASO 3 (UPDATE). No correr nada de esto
-- directo sin mirar los resultados anteriores. Esta corrida está además bajo
-- la moratoria de escritura en BD vigente — no ejecutar hasta el respaldo
-- pre-despliegue final.

-- ============================================================
-- PASO 0 (solo lectura): socios honorarios con cuota generada por error
-- (no deberían tener ninguna — revisar aparte si aparece algo acá)
-- ============================================================
SELECT p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque,
       p.es_honorario, c.id AS cuota_id, c.mes, c.anio, c.monto, c.estado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
WHERE (
    p.es_honorario = 1
    OR LOWER(TRIM(p.bloque)) IN ('socios honorario','socios honorarios','socio honorario','socio honorarios')
  )
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

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
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND c.monto = t.monto_base   -- solo cuotas que siguen al valor completo (sin corregir)
GROUP BY c.estado;

-- ============================================================
-- PASO 2 (solo lectura): detalle fila por fila, para revisar antes de tocar nada
-- ============================================================
SELECT
  p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque,
  c.id AS cuota_id, c.mes, c.anio, c.monto AS monto_actual,
  ROUND(c.monto/2) AS monto_corregido, c.estado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
WHERE LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND c.monto = t.monto_base
ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;

-- ============================================================
-- PASO 3: corrige SOLO cuotas pendientes/vencidas (no tocan pagos ya hechos)
-- Con respaldo propio antes de modificar nada.
-- ============================================================

CREATE TABLE IF NOT EXISTS respaldo_cuotas_socios_20260825 AS
SELECT c.*
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
WHERE c.estado IN ('pendiente','vencido')
  AND LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND c.monto = t.monto_base;

UPDATE cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
SET c.monto = ROUND(c.monto/2)
WHERE c.estado IN ('pendiente','vencido')
  AND LOWER(TRIM(p.bloque)) IN ('socios','socio')
  AND COALESCE(p.es_honorario, 0) = 0
  AND c.monto = t.monto_base;

-- ============================================================
-- PENDIENTE DE DECISIÓN: cuotas YA PAGADAS al valor completo por socios.
-- Esto no se corrige automáticamente porque implica una decisión de la
-- Directiva (dejar como saldo a favor, devolver, o no tocar pagos pasados).
-- Correr esta consulta para dimensionarlo:
-- ============================================================
-- SELECT p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
--        c.id AS cuota_id, c.mes, c.anio, c.monto,
--        c.monto - ROUND(c.monto/2) AS diferencia_a_favor
-- FROM cuotas c
-- JOIN personas p ON p.id = c.persona_id
-- JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id
-- WHERE c.estado = 'pagado'
--   AND LOWER(TRIM(p.bloque)) IN ('socios','socio')
--   AND COALESCE(p.es_honorario, 0) = 0
--   AND c.monto = t.monto_base
-- ORDER BY p.apellido_paterno, p.nombres, c.anio, c.mes;
