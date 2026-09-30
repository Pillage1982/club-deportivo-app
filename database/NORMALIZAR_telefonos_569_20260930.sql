-- =====================================================================
-- GDC Calameña — Normalización de teléfonos celulares a +569XXXXXXXX
-- Pedido del cliente (sep-2026). Preparado 2026-09-29, revisado 2026-09-30.
-- Columnas: personas.telefono, personas.telefono_apoderado
--
-- ANTES DE EJECUTAR:
--   1. Correr primero en PRUEBAS (u402516660_Diablada_dev) y revisar el PASO 2.
--   2. Respaldo de producción (phpMyAdmin > Exportar) antes de correrlo en
--      u402516660_Diablada_BD. El PASO 1 además guarda una copia de las dos columnas.
--   3. Seleccionar la BD correcta en phpMyAdmin (este archivo NO trae USE a propósito).
--   4. Ejecutar por pasos, no todo de una vez.
--
-- Reglas (sobre los dígitos, descartando espacios, guiones, '+' y
-- caracteres invisibles pegados desde WhatsApp):
--   9 dígitos que empiezan con 9    -> '+56' + dígitos
--   11 dígitos que empiezan con 569 -> '+'   + dígitos
--   Cualquier otro caso (8 dígitos, fijos 55x, 10 dígitos, dos números
--   en el mismo campo, vacíos) NO se toca: el socio los corrige en
--   "Actualizar datos" de su primer ingreso al Portal del Socio.
--
-- Requiere REGEXP_REPLACE (MySQL 8+ / MariaDB 10.0.5+). Hostinger usa MariaDB 11.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 — Respaldo de las dos columnas (permite revertir con el PASO 6)
-- ---------------------------------------------------------------------
CREATE TABLE respaldo_telefonos_20260929 AS
SELECT id, telefono, telefono_apoderado
FROM personas;

SELECT COUNT(*) AS filas_respaldadas FROM respaldo_telefonos_20260929;


-- ---------------------------------------------------------------------
-- PASO 2 — Vista previa: antes / después de cada fila que cambiará
-- ---------------------------------------------------------------------
SELECT
  p.id, p.rut, p.nombres, p.apellido_paterno,
  p.telefono AS telefono_actual,
  CASE
    WHEN REGEXP_REPLACE(p.telefono, '[^0-9]', '') REGEXP '^9[0-9]{8}$'
      THEN CONCAT('+56', REGEXP_REPLACE(p.telefono, '[^0-9]', ''))
    WHEN REGEXP_REPLACE(p.telefono, '[^0-9]', '') REGEXP '^569[0-9]{8}$'
      THEN CONCAT('+',   REGEXP_REPLACE(p.telefono, '[^0-9]', ''))
    ELSE p.telefono
  END AS telefono_nuevo,
  p.telefono_apoderado AS apoderado_actual,
  CASE
    WHEN REGEXP_REPLACE(p.telefono_apoderado, '[^0-9]', '') REGEXP '^9[0-9]{8}$'
      THEN CONCAT('+56', REGEXP_REPLACE(p.telefono_apoderado, '[^0-9]', ''))
    WHEN REGEXP_REPLACE(p.telefono_apoderado, '[^0-9]', '') REGEXP '^569[0-9]{8}$'
      THEN CONCAT('+',   REGEXP_REPLACE(p.telefono_apoderado, '[^0-9]', ''))
    ELSE p.telefono_apoderado
  END AS apoderado_nuevo
FROM personas p
WHERE REGEXP_REPLACE(p.telefono, '[^0-9]', '')           REGEXP '^(9|569)[0-9]{8}$'
   OR REGEXP_REPLACE(p.telefono_apoderado, '[^0-9]', '') REGEXP '^(9|569)[0-9]{8}$'
ORDER BY p.apellido_paterno, p.nombres;


-- ---------------------------------------------------------------------
-- PASO 3 — Casos que NO se tocan (solo informativo)
-- ---------------------------------------------------------------------
SELECT id, rut, nombres, apellido_paterno, telefono, telefono_apoderado
FROM personas
WHERE (telefono IS NOT NULL AND TRIM(telefono) <> ''
       AND REGEXP_REPLACE(telefono, '[^0-9]', '') NOT REGEXP '^(9|569)[0-9]{8}$')
   OR (telefono_apoderado IS NOT NULL AND TRIM(telefono_apoderado) <> ''
       AND REGEXP_REPLACE(telefono_apoderado, '[^0-9]', '') NOT REGEXP '^(9|569)[0-9]{8}$')
ORDER BY apellido_paterno, nombres;


-- ---------------------------------------------------------------------
-- PASO 4 — Actualización (ejecutar este bloque COMPLETO, de una vez)
-- phpMyAdmin cierra la conexión al terminar cada ejecución y descarta una
-- transacción abierta: START TRANSACTION, los dos UPDATE y el COMMIT deben ir
-- en la MISMA ejecución. La red de seguridad es el respaldo del PASO 1: si las
-- "filas afectadas" no cuadran con el PASO 2, revertir con el PASO 6.
-- ---------------------------------------------------------------------
START TRANSACTION;

UPDATE personas
SET telefono = CASE
    WHEN REGEXP_REPLACE(telefono, '[^0-9]', '') REGEXP '^9[0-9]{8}$'
      THEN CONCAT('+56', REGEXP_REPLACE(telefono, '[^0-9]', ''))
    ELSE CONCAT('+', REGEXP_REPLACE(telefono, '[^0-9]', ''))
  END
WHERE REGEXP_REPLACE(telefono, '[^0-9]', '') REGEXP '^(9|569)[0-9]{8}$';

UPDATE personas
SET telefono_apoderado = CASE
    WHEN REGEXP_REPLACE(telefono_apoderado, '[^0-9]', '') REGEXP '^9[0-9]{8}$'
      THEN CONCAT('+56', REGEXP_REPLACE(telefono_apoderado, '[^0-9]', ''))
    ELSE CONCAT('+', REGEXP_REPLACE(telefono_apoderado, '[^0-9]', ''))
  END
WHERE REGEXP_REPLACE(telefono_apoderado, '[^0-9]', '') REGEXP '^(9|569)[0-9]{8}$';

COMMIT;


-- ---------------------------------------------------------------------
-- PASO 5 — Verificación (después del COMMIT)
-- ---------------------------------------------------------------------
SELECT
  SUM(telefono REGEXP '^\\+569[0-9]{8}$')           AS telefonos_ok,
  SUM(telefono_apoderado REGEXP '^\\+569[0-9]{8}$') AS apoderados_ok,
  COUNT(*)                                          AS total_personas
FROM personas;


-- ---------------------------------------------------------------------
-- PASO 6 — SOLO SI HAY QUE REVERTIR
-- ---------------------------------------------------------------------
-- UPDATE personas p
-- JOIN respaldo_telefonos_20260929 r ON r.id = p.id
-- SET p.telefono = r.telefono,
--     p.telefono_apoderado = r.telefono_apoderado;

-- Cuando todo esté confirmado, se puede eliminar el respaldo:
-- DROP TABLE respaldo_telefonos_20260929;
