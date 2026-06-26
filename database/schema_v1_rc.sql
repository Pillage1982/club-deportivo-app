CREATE DATABASE IF NOT EXISTS club_deportivo
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE club_deportivo;

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
        'admin',
        'tesorero',
        'entrenador'
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
