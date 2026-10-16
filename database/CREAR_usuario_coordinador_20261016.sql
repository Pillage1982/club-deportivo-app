-- Usuario para el rol COORDINADOR del panel.
--   coordinador → permisos de Encargado (entrenador), sin eliminar:
--   asistencia QR, crear eventos, formaciones, puntaje y justificaciones; sin finanzas.
-- Ejecutar DESPUÉS de desplegar el zip con el rol nuevo: al arrancar, el servidor
-- amplía el ENUM usuarios.rol; antes de eso el INSERT guarda el rol vacío.
-- Clave inicial: gdc123 (cambio obligatorio y registro de email en el primer ingreso).

-- PASO 1: confirmar que el ENUM ya incluye 'coordinador'.
SHOW COLUMNS FROM usuarios LIKE 'rol';

-- PASO 2: crear el usuario (si ya existe, no hace nada).
INSERT IGNORE INTO usuarios (usuario, password, rol, debe_cambiar_password) VALUES
  ('coordinador', '$2b$10$Knx5y8cuaHteLVykmB8WE.uF2Yl4n3MzAks7/0dghoFOb3YL8x0sa', 'coordinador', 1);

-- PASO 3: verificación (ningún usuario debe quedar con rol vacío).
SELECT id, usuario, rol, debe_cambiar_password, email FROM usuarios ORDER BY id;
