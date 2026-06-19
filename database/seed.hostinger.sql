SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM pago_detalle;
DELETE FROM pagos;
DELETE FROM multas;
DELETE FROM asistencias;
DELETE FROM cuotas;
DELETE FROM evento_participantes;
DELETE FROM persona_rol;
DELETE FROM eventos;
DELETE FROM personas;
DELETE FROM usuarios;

ALTER TABLE pago_detalle AUTO_INCREMENT = 1;
ALTER TABLE pagos AUTO_INCREMENT = 1;
ALTER TABLE multas AUTO_INCREMENT = 1;
ALTER TABLE asistencias AUTO_INCREMENT = 1;
ALTER TABLE cuotas AUTO_INCREMENT = 1;
ALTER TABLE eventos AUTO_INCREMENT = 1;
ALTER TABLE personas AUTO_INCREMENT = 1;
ALTER TABLE usuarios AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO usuarios (usuario, password, rol)
VALUES
('admin', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'admin'),
('tesorero', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'tesorero'),
('entrenador', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'entrenador');

INSERT INTO personas
(rut, nombres, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento)
VALUES
('11.111.111-1', 'Ana', 'Morales', '', 'ana.demo@test.cl', '999111111', '2000-01-01'),
('22.222.222-2', 'Pedro', 'Gonzalez', '', 'pedro.demo@test.cl', '999222222', '1999-02-10'),
('33.333.333-3', 'Lucia', 'Rojas', '', 'lucia.demo@test.cl', '999333333', '2001-03-15'),
('44.444.444-4', 'Carlos', 'Munoz', '', 'carlos.demo@test.cl', '999444444', '1998-05-20'),
('55.555.555-5', 'Matias', 'Araya', '', 'matias.demo@test.cl', '999555555', '2002-07-11'),
('66.666.666-6', 'Sofia', 'Contreras', '', 'sofia.demo@test.cl', '999666666', '1997-08-30'),
('77.777.777-7', 'Diego', 'Torres', '', 'diego.demo@test.cl', '999777777', '2000-09-09'),
('88.888.888-8', 'Camila', 'Castillo', '', 'camila.demo@test.cl', '999888888', '1996-11-14');

INSERT INTO eventos
(nombre, tipo, fecha, ubicacion, descripcion)
VALUES
('Actividad Semanal', 'entrenamiento', NOW(), 'Sede Comunitaria', 'Actividad regular de la organizacion'),
('Taller de Coordinacion', 'entrenamiento', NOW(), 'Sala Multiuso', 'Trabajo colaborativo del equipo'),
('Encuentro Comunitario', 'partido', NOW(), 'Centro Comunitario', 'Encuentro abierto de la organizacion'),
('Reunion Directiva', 'reunion', NOW(), 'Oficina Administrativa', 'Reunion mensual');

INSERT INTO asistencias
(evento_id, persona_id, estado, minutos_atraso)
VALUES
(1, 1, 'presente', 0),
(1, 2, 'atrasado', 5),
(1, 3, 'atrasado', 15),
(1, 4, 'ausente', 0),
(2, 5, 'presente', 0),
(2, 6, 'atrasado', 10),
(2, 7, 'ausente', 0),
(2, 8, 'presente', 0),
(3, 1, 'presente', 0),
(3, 2, 'presente', 0),
(3, 3, 'atrasado', 20),
(3, 4, 'ausente', 0);

INSERT INTO pagos
(persona_id, monto_total, metodo)
VALUES
(1, 10000, 'efectivo'),
(2, 15000, 'transferencia'),
(3, 8000, 'efectivo'),
(4, 12000, 'transferencia');

SELECT * FROM usuarios;
SELECT * FROM personas;
SELECT * FROM eventos;
SELECT * FROM asistencias;
SELECT * FROM multas;
SELECT * FROM pagos;
