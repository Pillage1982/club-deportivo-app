-- Alta de 3 integrantes detectados en "Integrantes_GDC_actualizados_2026.xlsx"
-- (hoja "Observaciones cruce") que no estaban en la BD.
--
-- Correcciones aplicadas antes de insertar (RUT del archivo original tenia errores):
--   - Isis Morales Cordova: 24999374-K -> 24999374-3 (digito verificador mal tipeado).
--   - Alexis Jesus Vera Vera: 192055474-4 -> 19205547-4 (un digito de mas repetido
--     antes del guion; verificado contra la formula de RUT chileno, unico candidato
--     valido que respeta el prefijo 19 millones y el digito verificador 4).
--   - Sebastian Gonzalez Segovia: en el archivo comparte RUT (24217189-6) con
--     Sayumi Ayanami Silva Valdivia (persona real y distinta, RUT valido). Se agrega
--     sin RUT (queda pendiente confirmar el real) y se deja el nombre y RUT de
--     Sayumi como referencia en el campo de apoderado.

CREATE TABLE IF NOT EXISTS respaldo_alta_20260813_personas LIKE personas;

START TRANSACTION;

INSERT INTO personas
  (rut, nombres, apellido_paterno, apellido_materno, bloque, estado, es_honorario, nombre_apoderado)
VALUES
  ('24999374-3', 'Isis', 'Morales', 'Cordova', 'Infantil', 'activo', 0, NULL),
  (NULL, 'Sebastian', 'Gonzalez', 'Segovia', 'Figurines', 'activo', 0, 'Sayumi Ayanami Silva Valdivia (RUT 24217189-6) — referencia por choque de RUT, confirmar apoderado real'),
  ('19205547-4', 'Alexis Jesus', 'Vera', 'Vera', 'Pecados y tentaciones', 'activo', 0, NULL);

COMMIT;

-- Verificacion: deben aparecer los 3 con id asignado
SELECT id, rut, nombres, apellido_paterno, apellido_materno, bloque, estado, nombre_apoderado
FROM personas
WHERE (rut IN ('24999374-3','19205547-4'))
   OR (nombres='Sebastian' AND apellido_paterno='Gonzalez' AND apellido_materno='Segovia' AND rut IS NULL)
ORDER BY id DESC
LIMIT 3;
