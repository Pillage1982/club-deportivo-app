const db = require('./db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(result);
    });
  });
}

async function columnaExiste(tabla, columna) {
  const filas = await ejecutar(
    `
      SELECT COUNT(*) AS total
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE
        TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tabla, columna]
  );

  return Number(filas[0].total) > 0;
}

async function asegurarEstadoIntegrantes() {
  const tieneEstado =
    await columnaExiste('personas', 'estado');

  if (!tieneEstado) {
    await ejecutar(`
      ALTER TABLE personas
      ADD COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo' AFTER activo
    `);
  }

  await ejecutar(`
    ALTER TABLE personas
    MODIFY COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo'
  `);

  await ejecutar(`
    UPDATE personas
    SET estado = CASE
      WHEN activo = 1 THEN 'activo'
      ELSE 'inactivo'
    END
    WHERE estado IS NULL OR estado = ''
  `);
}

async function reconstruirVistaEstadoFinanciero() {
  await ejecutar('DROP VIEW IF EXISTS vista_estado_financiero');

  await ejecutar(`
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
      COALESCE(p.estado, 'activo') = 'activo'
  `);
}

async function asegurarTablaGastos() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS gastos (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      descripcion       VARCHAR(200) NOT NULL,
      categoria         VARCHAR(100) NOT NULL,
      monto             DECIMAL(10,2) NOT NULL,
      fecha             DATE NOT NULL,
      responsable       VARCHAR(150) NULL,
      comprobante_path  VARCHAR(255) NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function asegurarTablaActasReunion() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS actas_reunion (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      evento_id     INT NOT NULL,
      titulo        VARCHAR(200) NOT NULL,
      contenido     TEXT NOT NULL,
      archivo_path  VARCHAR(255) NULL,
      responsable   VARCHAR(150) NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_actas_evento (evento_id),
      CONSTRAINT fk_actas_evento FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
    )
  `);
}

async function ejecutarMigraciones() {
  await asegurarEstadoIntegrantes();
  await reconstruirVistaEstadoFinanciero();
  await asegurarTablaGastos();
  await asegurarTablaActasReunion();
}

module.exports = ejecutarMigraciones;
