-- Excepción acordada por la directiva (2026-10-23): Cristóbal Eduardo Escobar Carozzi
-- mantiene la cuota infantil ($6.000) durante TODA la temporada 2026-2027
-- (octubre 2026 a julio 2027), aunque cumpla 12 años antes de que termine, porque
-- no cambia de bloque hasta la temporada siguiente.
--
-- Por qué basta con datos: la generación de cuotas (cuotaModel.generarMensualidadMasiva)
-- calcula el 50% infantil por la edad a la fecha de vencimiento (Art. 2.1.B), pero
-- nunca reemplaza una cuota que ya existe (UNIQUE persona/tipo/mes/año + INSERT
-- IGNORE). Por eso:
--   PASO 3: las cuotas de la temporada que ya tiene a más de $6.000 y SIN pagos
--           asignados pasan a $6.000.
--   PASO 4: los meses de la temporada que aún no se generan se crean ahora a $6.000,
--           así la generación del mes ya no los crea a $12.000.
-- Cuotas con pagos asignados no se tocan: el PASO 1 las muestra para decidir.
-- La temporada 2027-2028 se genera con la regla normal ($12.000).
--
-- Sin variables (@): cada paso se puede ejecutar por separado en phpMyAdmin.
-- ORDEN: primero en u402516660_Diablada_dev; en producción con respaldo de la BD.
-- PASOS 0 y 1 solo lectura. El PASO 0 debe devolver UNA sola persona; si salen
-- cero o varias, NO seguir.

-- ============================================================
-- PASO 0 (solo lectura): el integrante (debe salir exactamente una fila)
-- ============================================================
SELECT id, rut, nombres, apellido_paterno, apellido_materno, bloque, fecha_nacimiento,
       TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad_hoy,
       DATE_ADD(fecha_nacimiento, INTERVAL 12 YEAR) AS cumple_12,
       COALESCE(estado, 'activo') AS estado, activo
FROM personas
WHERE apellido_paterno = 'Escobar' AND apellido_materno = 'Carozzi'
  AND nombres LIKE 'Crist%bal%';

-- ============================================================
-- PASO 1 (solo lectura): sus cuotas de la temporada 2026-2027 y lo pagado
-- ============================================================
SELECT c.id, c.mes, c.anio, c.monto, c.estado,
       COALESCE((SELECT SUM(d.monto_pagado) FROM pago_detalle d
                 WHERE d.tipo = 'cuota' AND d.referencia_id = c.id), 0) AS pagado
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
WHERE p.apellido_paterno = 'Escobar' AND p.apellido_materno = 'Carozzi'
  AND p.nombres LIKE 'Crist%bal%'
  AND ((c.anio = 2026 AND c.mes >= 10) OR (c.anio = 2027 AND c.mes <= 7))
ORDER BY c.anio, c.mes;

-- ============================================================
-- PASO 2: respaldo de sus cuotas de la temporada
-- ============================================================
CREATE TABLE respaldo_cuotas_escobar_carozzi_20261023 AS
SELECT c.*
FROM cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
WHERE p.apellido_paterno = 'Escobar' AND p.apellido_materno = 'Carozzi'
  AND p.nombres LIKE 'Crist%bal%'
  AND ((c.anio = 2026 AND c.mes >= 10) OR (c.anio = 2027 AND c.mes <= 7));

-- ============================================================
-- PASO 3: cuotas ya generadas, sin pagos, a $6.000
-- ============================================================
UPDATE cuotas c
JOIN personas p ON p.id = c.persona_id
JOIN tipos_cuotas t ON t.id = c.tipo_cuota_id AND t.nombre = 'Mensualidad'
SET c.monto = 6000
WHERE p.apellido_paterno = 'Escobar' AND p.apellido_materno = 'Carozzi'
  AND p.nombres LIKE 'Crist%bal%'
  AND ((c.anio = 2026 AND c.mes >= 10) OR (c.anio = 2027 AND c.mes <= 7))
  AND c.monto > 6000
  AND NOT EXISTS (
    SELECT 1 FROM pago_detalle d WHERE d.tipo = 'cuota' AND d.referencia_id = c.id
  );

-- ============================================================
-- PASO 4: meses de la temporada aún no generados, creados a $6.000
-- (vencimiento el día 10, como la generación normal)
-- ============================================================
INSERT IGNORE INTO cuotas
  (persona_id, tipo_cuota_id, monto, mes, anio, fecha_vencimiento, estado, origen)
SELECT p.id, t.id, 6000, m.mes, m.anio,
       STR_TO_DATE(CONCAT(m.anio, '-', m.mes, '-10'), '%Y-%c-%d'), 'pendiente', 'interno'
FROM personas p
JOIN (SELECT id FROM tipos_cuotas WHERE nombre = 'Mensualidad' ORDER BY id LIMIT 1) t
JOIN (
  SELECT 10 AS mes, 2026 AS anio UNION ALL SELECT 11, 2026 UNION ALL SELECT 12, 2026
  UNION ALL SELECT 1, 2027 UNION ALL SELECT 2, 2027 UNION ALL SELECT 3, 2027
  UNION ALL SELECT 4, 2027 UNION ALL SELECT 5, 2027 UNION ALL SELECT 6, 2027
  UNION ALL SELECT 7, 2027
) m
WHERE p.apellido_paterno = 'Escobar' AND p.apellido_materno = 'Carozzi'
  AND p.nombres LIKE 'Crist%bal%'
  AND p.activo = 1 AND COALESCE(p.estado, 'activo') = 'activo';

-- ============================================================
-- PASO 5 (solo lectura): repetir el PASO 1. Deben quedar las 10 cuotas a
-- $6.000, salvo las que ya tenían pagos (decidir aparte).
-- Si tiene saldo a favor: Cuotas → "Aplicar saldos a favor".
-- ============================================================

-- REVERSA (solo si hay que deshacer):
-- 1) Devolver el monto original a las que existían:
-- UPDATE cuotas c JOIN respaldo_cuotas_escobar_carozzi_20261023 r ON r.id = c.id SET c.monto = r.monto;
-- 2) Borrar las creadas en el PASO 4 (no están en el respaldo y no tienen pagos):
-- DELETE c FROM cuotas c
-- JOIN personas p ON p.id = c.persona_id
-- LEFT JOIN respaldo_cuotas_escobar_carozzi_20261023 r ON r.id = c.id
-- WHERE p.apellido_paterno = 'Escobar' AND p.apellido_materno = 'Carozzi' AND p.nombres LIKE 'Crist%bal%'
--   AND ((c.anio = 2026 AND c.mes >= 10) OR (c.anio = 2027 AND c.mes <= 7))
--   AND r.id IS NULL
--   AND NOT EXISTS (SELECT 1 FROM pago_detalle d WHERE d.tipo = 'cuota' AND d.referencia_id = c.id);
