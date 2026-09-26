-- Semilla minima: solo el usuario admin (clave: admin123).
-- Para instalaciones nuevas, despues de importar schema_hostinger.sql.
-- No borra datos; si 'admin' ya existe, no hace nada.

INSERT IGNORE INTO usuarios (usuario, password, rol)
VALUES
('admin', '$2b$10$lMiSrir3d9zKZUve/WZkS.wp/rVdvx.ZOvMEgF/UWudPr/nnoKmbO', 'admin');
