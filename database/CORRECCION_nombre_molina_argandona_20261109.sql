-- ============================================================================
-- Corrección de nombre de integrante: Yulietha -> Julietha Molina Argandoña
-- Fecha: 2026-11-09
-- Motivo: el panel no permite editar a esta integrante; corrección manual.
--   Primer nombre mal escrito: "Yulietha" debe ser "Julietha"
--   (los demás nombres/apellidos se conservan tal cual).
-- RUT: 27068946-9
--
-- EJECUTAR CON RESPALDO PREVIO. Correr primero el SELECT (1): debe devolver
-- UNA sola fila (la integrante correcta) y confirmar cómo está escrito el
-- campo "nombres" antes de ejecutar el UPDATE (2).
-- ============================================================================

-- 1) Identificar y ver el estado ACTUAL (solo lectura, ejecutar primero)
SELECT id, rut, nombres, apellido_paterno, apellido_materno, estado, activo
FROM personas
WHERE REPLACE(REPLACE(REPLACE(UPPER(rut), '.', ''), '-', ''), ' ', '') = '270689469';

-- 2) Corregir SOLO el primer nombre (ejecutar si el SELECT (1) devolvió la fila
--    correcta y "nombres" empieza exactamente por "Yulietha").
--    REPLACE es sensible a mayúsculas: si el nombre estuviera en otra forma
--    (p. ej. "YULIETHA"), ajustar la cadena buscada antes de correr.
UPDATE personas
SET nombres = REPLACE(nombres, 'Yulietha', 'Julietha')
WHERE REPLACE(REPLACE(REPLACE(UPPER(rut), '.', ''), '-', ''), ' ', '') = '270689469';

-- 3) Verificar el resultado
SELECT id, rut, nombres, apellido_paterno, apellido_materno
FROM personas
WHERE REPLACE(REPLACE(REPLACE(UPPER(rut), '.', ''), '-', ''), ' ', '') = '270689469';
