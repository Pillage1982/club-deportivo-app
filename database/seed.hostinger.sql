USE u193403304_club_deportivo;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE multas;
TRUNCATE TABLE asistencias;
TRUNCATE TABLE pagos;
TRUNCATE TABLE eventos;
TRUNCATE TABLE personas;
TRUNCATE TABLE usuarios;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO usuarios (usuario, password, rol)
VALUES
('admin', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'admin'),
('tesorero', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'tesorero'),
('entrenador', '$2b$10$2qQw6abE62sB2E.FiGLhnOYLVLbi4JlzSl8VDE1DP9D.B6DtkLwry', 'entrenador');

INSERT INTO personas
(rut, nombres, apellido_paterno, apellido_materno, email, telefono, fecha_nacimiento)
VALUES
('11.111.111-1', 'Juan', 'Perez', '', 'juan@test.cl', '999111111', '2000-01-01'),
('22.222.222-2', 'Pedro', 'Gonzalez', '', 'pedro@test.cl', '999222222', '1999-02-10'),
('33.333.333-3', 'Luis', 'Rojas', '', 'luis@test.cl', '999333333', '2001-03-15'),
('44.444.444-4', 'Carlos', 'Munoz', '', 'carlos@test.cl', '999444444', '1998-05-20'),
('55.555.555-5', 'Matias', 'Araya', '', 'matias@test.cl', '999555555', '2002-07-11'),
('66.666.666-6', 'Sebastian', 'Contreras', '', 'seba@test.cl', '999666666', '1997-08-30'),
('77.777.777-7', 'Diego', 'Torres', '', 'diego@test.cl', '999777777', '2000-09-09'),
('88.888.888-8', 'Felipe', 'Castillo', '', 'felipe@test.cl', '999888888', '1996-11-14');

INSERT INTO eventos
(nombre, tipo, fecha, ubicacion, descripcion)
VALUES
('Entrenamiento Lunes', 'entrenamiento', NOW(), 'Cancha Norte', 'Entrenamiento semanal'),
('Entrenamiento Miercoles', 'entrenamiento', NOW(), 'Cancha Norte', 'Trabajo fisico'),
('Partido Apertura', 'partido', NOW(), 'Estadio Municipal', 'Primer partido temporada'),
('Reunion Directiva', 'reunion', NOW(), 'Sede Club', 'Reunion mensual');

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