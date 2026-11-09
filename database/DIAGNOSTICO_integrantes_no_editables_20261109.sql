-- ============================================================================
-- DIAGNÓSTICO: ¿por qué ciertos integrantes NO se pueden editar desde el panel?
-- Fecha: 2026-11-09   (SOLO LECTURA, no modifica nada)
--
-- Causa de fondo:
--   Al guardar una edición, el panel RE-VALIDA TODO el registro (no solo el
--   campo que cambiaste) y vuelve a enviar todos los campos. Si CUALQUIER campo
--   guardado ya no cumple las reglas actuales (celular +569XXXXXXXX, celular del
--   apoderado, email, fecha de nacimiento), el guardado se rechaza y no puedes
--   cambiar ni el nombre.
--   Los registros con datos "sucios" son los que no pasaron por esas reglas:
--     - registros antiguos migrados (ej. Priscila Robles, ingreso 2013)
--     - altas por la ficha pública "Súmate a la promesa" (los "Nuevo", ej.
--       Julietha), que copian lo que tipeó el postulante sin normalizar.
--
-- Este script NO cambia datos: solo lista qué integrantes están bloqueados y por
-- qué campo. Con eso se corrige cada campo (por panel si se puede, o por SQL).
-- ============================================================================

-- Expresión reutilizable: dígitos del teléfono (quita +, espacios, guiones, etc.)
-- Un celular chileno válido para el panel = 9XXXXXXXX  o  569XXXXXXXX.

-- ----------------------------------------------------------------------------
-- 0) Caso puntual reportado: Julietha Molina Argandoña (RUT 27068946-9)
--    Ver qué campo suyo falla la validación.
-- ----------------------------------------------------------------------------
SELECT
  id, rut, nombres, apellido_paterno, apellido_materno,
  email, telefono, telefono_apoderado, fecha_nacimiento,
  CASE WHEN REPLACE(REPLACE(REPLACE(telefono,' ',''),'-',''),'+','')
            REGEXP '^(9[0-9]{8}|569[0-9]{8})$' THEN 'ok' ELSE 'TELEFONO INVALIDO' END AS chk_telefono,
  CASE WHEN telefono_apoderado IS NULL OR telefono_apoderado = '' THEN 'ok(vacio)'
       WHEN REPLACE(REPLACE(REPLACE(telefono_apoderado,' ',''),'-',''),'+','')
            REGEXP '^(9[0-9]{8}|569[0-9]{8})$' THEN 'ok'
       ELSE 'TEL. APODERADO INVALIDO' END AS chk_tel_apoderado,
  CASE WHEN email IS NULL OR email = '' THEN 'ok(vacio)'
       WHEN email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' THEN 'ok'
       ELSE 'EMAIL INVALIDO' END AS chk_email,
  CASE WHEN fecha_nacimiento IS NULL OR fecha_nacimiento = '0000-00-00' THEN 'FECHA NAC. VACIA'
       ELSE 'ok' END AS chk_fecha_nac
FROM personas
WHERE REPLACE(REPLACE(REPLACE(UPPER(rut), '.', ''), '-', ''), ' ', '') = '270689469';

-- ----------------------------------------------------------------------------
-- 1) TODOS los integrantes activos/receso con algún campo que BLOQUEA el guardado.
--    (los que hoy no se pueden editar desde el panel)
-- ----------------------------------------------------------------------------
SELECT
  id, rut, nombres, apellido_paterno, apellido_materno, estado,
  telefono, telefono_apoderado, email, fecha_nacimiento,
  CONCAT_WS(', ',
    CASE
      WHEN telefono IS NULL OR telefono = '' THEN 'telefono_vacio'
      WHEN REPLACE(REPLACE(REPLACE(telefono, ' ', ''), '-', ''), '+', '')
           NOT REGEXP '^(9[0-9]{8}|569[0-9]{8})$' THEN 'telefono'
    END,
    CASE
      WHEN telefono_apoderado IS NOT NULL AND telefono_apoderado <> ''
       AND REPLACE(REPLACE(REPLACE(telefono_apoderado, ' ', ''), '-', ''), '+', '')
           NOT REGEXP '^(9[0-9]{8}|569[0-9]{8})$' THEN 'tel_apoderado'
    END,
    CASE
      WHEN email IS NOT NULL AND email <> ''
       AND email NOT REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$' THEN 'email'
    END,
    CASE
      WHEN fecha_nacimiento IS NULL OR fecha_nacimiento = '0000-00-00' THEN 'fecha_nacimiento'
    END
  ) AS campos_que_bloquean
FROM personas
WHERE activo = 1
HAVING campos_que_bloquean <> ''
ORDER BY apellido_paterno, apellido_materno, nombres;

-- ----------------------------------------------------------------------------
-- 2) RUT duplicados (otra causa de bloqueo: al guardar da
--    "Ya existe un integrante registrado con ese RUT", error 409).
-- ----------------------------------------------------------------------------
SELECT
  REPLACE(REPLACE(REPLACE(UPPER(rut), '.', ''), '-', ''), ' ', '') AS rut_norm,
  COUNT(*) AS veces,
  GROUP_CONCAT(CONCAT(id, ':', nombres, ' ', apellido_paterno, ' [', COALESCE(estado,'?'),
              '/activo=', activo, ']') SEPARATOR ' || ') AS registros
FROM personas
GROUP BY rut_norm
HAVING veces > 1
ORDER BY veces DESC;
