-- ============================================================================
-- Corrección de fechas de integrante: Priscila Pamela Robles Pereira
-- Fecha: 2026-11-07
-- Motivo: el panel no permite editar estas fechas; corrección manual.
--   fecha_nacimiento -> 1989-12-18 (18/12/1989)
--   fecha_ingreso    -> 2013-09-09 (9/9/2013)
--
-- EJECUTAR CON RESPALDO PREVIO. Revisar el SELECT de identificación antes
-- de correr el UPDATE: debe devolver UNA sola fila (la persona correcta).
-- ============================================================================

-- 1) Identificar y ver el estado ACTUAL (ejecutar primero, solo lectura)
SELECT id, rut, nombres, apellido_paterno, apellido_materno,
       fecha_nacimiento, fecha_ingreso
FROM personas
WHERE nombres LIKE 'Priscila%'
  AND apellido_paterno = 'Robles'
  AND apellido_materno = 'Pereira';

-- 2) Corregir (ejecutar solo si el SELECT anterior devolvió la fila correcta)
UPDATE personas
SET fecha_nacimiento = '1989-12-18',
    fecha_ingreso    = '2013-09-09'
WHERE nombres LIKE 'Priscila%'
  AND apellido_paterno = 'Robles'
  AND apellido_materno = 'Pereira';

-- 3) Verificar el resultado
SELECT id, rut, nombres, apellido_paterno, apellido_materno,
       fecha_nacimiento, fecha_ingreso
FROM personas
WHERE nombres LIKE 'Priscila%'
  AND apellido_paterno = 'Robles'
  AND apellido_materno = 'Pereira';
