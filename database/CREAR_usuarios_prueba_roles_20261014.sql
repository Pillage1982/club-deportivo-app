-- Usuarios de PRUEBA para los roles nuevos del panel (dev.gdcayquina.cl).
-- Ejecutar DESPUÉS de desplegar el zip con los roles nuevos: al arrancar, el
-- servidor amplía el ENUM usuarios.rol; antes de eso este INSERT falla.
--
-- Clave inicial de todos: gdc123. En el primer ingreso cada uno debe cambiarla
-- (debe_cambiar_password = 1) y registrar un email.
--
--   director1  → permisos de Administrador, sin eliminar
--   director2  → permisos de Tesorero, sin eliminar
--   director3  → permisos de Encargado (entrenador), sin eliminar
--   secretaria → permisos de Administrador completos (incluye eliminar)

-- PASO 1: confirmar que el ENUM ya tiene los roles nuevos (debe listar director1..3 y secretaria).
SHOW COLUMNS FROM usuarios LIKE 'rol';

-- PASO 2: crear los usuarios (si ya existen, no hace nada).
INSERT IGNORE INTO usuarios (usuario, password, rol, debe_cambiar_password) VALUES
  ('director1',  '$2b$10$Knx5y8cuaHteLVykmB8WE.uF2Yl4n3MzAks7/0dghoFOb3YL8x0sa', 'director1',  1),
  ('director2',  '$2b$10$Knx5y8cuaHteLVykmB8WE.uF2Yl4n3MzAks7/0dghoFOb3YL8x0sa', 'director2',  1),
  ('director3',  '$2b$10$Knx5y8cuaHteLVykmB8WE.uF2Yl4n3MzAks7/0dghoFOb3YL8x0sa', 'director3',  1),
  ('secretaria', '$2b$10$Knx5y8cuaHteLVykmB8WE.uF2Yl4n3MzAks7/0dghoFOb3YL8x0sa', 'secretaria', 1);

-- PASO 2b (SOLO si el INSERT se corrió antes de desplegar): MySQL guardó el rol
-- vacío ('') porque el ENUM todavía no lo tenía. Con el ENUM ya ampliado (PASO 1),
-- esto corrige el rol de esos usuarios. No toca a ningún otro usuario.
UPDATE usuarios SET rol = usuario
WHERE usuario IN ('director1', 'director2', 'director3', 'secretaria') AND rol = '';

-- PASO 3: verificación (ningún usuario debe quedar con rol vacío).
SELECT id, usuario, rol, debe_cambiar_password, email FROM usuarios ORDER BY id;
