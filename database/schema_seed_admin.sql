-- Esquema + semilla en un solo archivo para app.elaromodelportal4.cl (rama cliente/jjvv).
-- Basado en schema_hostinger.sql + seed.admin.sql. usuarios.rol solo admite 'admin'.
-- Solo para BD nueva y vacia: la seccion de semilla borra todas las tablas.

USE u193403304_jjvv;


-- ==========================
-- PERSONAS
-- ==========================

CREATE TABLE personas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    rut VARCHAR(20) UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellido_paterno VARCHAR(100) NOT NULL,
    apellido_materno VARCHAR(100),
    email VARCHAR(150),
    telefono VARCHAR(20),
    fecha_nacimiento DATE,
    activo TINYINT DEFAULT 1,
    estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ==========================
-- ROLES
-- ==========================

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (nombre) VALUES
('socio'),
('jugador'),
('directivo');

CREATE TABLE persona_rol (
    persona_id BIGINT,
    rol_id INT,

    PRIMARY KEY (
        persona_id,
        rol_id
    ),

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
        ON DELETE CASCADE,

    FOREIGN KEY (rol_id)
        REFERENCES roles(id)
        ON DELETE CASCADE
);

-- ==========================
-- USUARIOS DEL SISTEMA
-- ==========================

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario VARCHAR(50) UNIQUE NOT NULL,

    password VARCHAR(255) NOT NULL,

    rol ENUM(
        'admin'
    ) DEFAULT 'admin'
);

-- ==========================
-- EVENTOS
-- ==========================

CREATE TABLE eventos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    tipo ENUM(
        'entrenamiento',
        'partido',
        'reunion'
    ) NOT NULL,

    fecha DATETIME NOT NULL,

    ubicacion VARCHAR(150),

    descripcion TEXT
);

CREATE TABLE evento_participantes (
    evento_id BIGINT,
    persona_id BIGINT,

    PRIMARY KEY (
        evento_id,
        persona_id
    ),

    FOREIGN KEY (evento_id)
        REFERENCES eventos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
        ON DELETE CASCADE
);

-- ==========================
-- ASISTENCIAS
-- ==========================

CREATE TABLE asistencias (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    evento_id BIGINT NOT NULL,

    persona_id BIGINT NOT NULL,

    estado ENUM(
        'presente',
        'atrasado',
        'ausente'
    ) NOT NULL,

    minutos_atraso INT DEFAULT 0,

    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (
        evento_id,
        persona_id
    ),

    FOREIGN KEY (evento_id)
        REFERENCES eventos(id)
        ON DELETE CASCADE,

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
        ON DELETE CASCADE
);

-- ==========================
-- MULTAS
-- ==========================

CREATE TABLE multas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    persona_id BIGINT NOT NULL,

    asistencia_id BIGINT,

    monto INT NOT NULL,

    motivo VARCHAR(100),

    estado ENUM(
        'pendiente',
        'pagado'
    ) DEFAULT 'pendiente',

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
        ON DELETE CASCADE,

    FOREIGN KEY (asistencia_id)
        REFERENCES asistencias(id)
        ON DELETE SET NULL
);

-- ==========================
-- TIPOS DE CUOTA
-- ==========================

CREATE TABLE tipos_cuotas (
    id INT AUTO_INCREMENT PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    monto_base INT NOT NULL,

    descripcion TEXT
);

INSERT INTO tipos_cuotas (
    nombre,
    monto_base
) VALUES
('Mensualidad', 10000),
('Inscripción', 20000);

-- ==========================
-- CUOTAS
-- ==========================

CREATE TABLE cuotas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    persona_id BIGINT NOT NULL,

    tipo_cuota_id INT NOT NULL,

    monto INT NOT NULL,

    mes INT,

    anio INT,

    fecha_vencimiento DATE,

    estado ENUM(
        'pendiente',
        'pagado',
        'vencido'
    ) DEFAULT 'pendiente',

    origen ENUM(
        'interno',
        'externo'
    ) DEFAULT 'interno',

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY uq_cuota_mensual_persona (
        persona_id,
        tipo_cuota_id,
        mes,
        anio
    ),

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
        ON DELETE CASCADE,

    FOREIGN KEY (tipo_cuota_id)
        REFERENCES tipos_cuotas(id)
);

-- ==========================
-- PAGOS
-- ==========================

CREATE TABLE pagos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    persona_id BIGINT NOT NULL,

    monto_total INT NOT NULL,

    metodo VARCHAR(50),

    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (persona_id)
        REFERENCES personas(id)
);

CREATE TABLE pago_detalle (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,

    pago_id BIGINT NOT NULL,

    tipo ENUM(
        'multa',
        'cuota'
    ) NOT NULL,

    referencia_id BIGINT NOT NULL,

    monto_pagado INT NOT NULL,

    FOREIGN KEY (pago_id)
        REFERENCES pagos(id)
        ON DELETE CASCADE
);

-- ==========================
-- ÍNDICES
-- ==========================

CREATE INDEX idx_persona
ON multas(persona_id);

CREATE INDEX idx_cuotas_persona
ON cuotas(persona_id);

CREATE INDEX idx_asistencia_evento
ON asistencias(evento_id);

CREATE INDEX idx_pagos_persona
ON pagos(persona_id);

CREATE INDEX idx_cuotas_periodo
ON cuotas(mes, anio);

-- ==========================
-- VISTA ESTADO FINANCIERO
-- ==========================

CREATE VIEW vista_estado_financiero AS

SELECT

  p.id,

  p.nombres,

  p.apellido_paterno,

  p.apellido_materno,

  COALESCE(m.total_multas, 0) AS total_multas,

  COALESCE(c.total_cuotas, 0) AS total_cuotas,

  COALESCE(pg.total_pagado, 0) AS total_pagado,

  (
    COALESCE(m.total_multas, 0)
    +
    COALESCE(c.total_cuotas, 0)
    -
    COALESCE(pg.total_pagado, 0)
  ) AS deuda_actual

FROM personas p

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto) AS total_multas

  FROM multas

  WHERE estado = 'pendiente'

  GROUP BY persona_id

) m

ON p.id = m.persona_id

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto) AS total_cuotas

  FROM cuotas

  WHERE estado IN (
    'pendiente',
    'vencido'
  )

  GROUP BY persona_id

) c

ON p.id = c.persona_id

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto_total) AS total_pagado

  FROM pagos

  GROUP BY persona_id

) pg

ON p.id = pg.persona_id

WHERE
  p.activo = 1
  AND
  COALESCE(p.estado, 'activo') = 'activo';


-- ==========================
-- SEMILLA (solo usuario admin)
-- ==========================

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
('admin', '$2b$10$lMiSrir3d9zKZUve/WZkS.wp/rVdvx.ZOvMEgF/UWudPr/nnoKmbO', 'admin');

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
