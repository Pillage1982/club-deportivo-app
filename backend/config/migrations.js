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

async function asegurarCamposPersonas() {
  const columnas = [
    {
      nombre: 'bloque',
      sql: "ADD COLUMN bloque VARCHAR(100) NULL AFTER apellido_materno"
    },
    {
      nombre: 'sexo',
      sql: "ADD COLUMN sexo ENUM('Masculino','Femenino') NULL AFTER bloque"
    },
    {
      nombre: 'direccion',
      sql: "ADD COLUMN direccion VARCHAR(255) NULL AFTER sexo"
    },
    {
      nombre: 'fecha_ingreso',
      sql: "ADD COLUMN fecha_ingreso DATE NULL AFTER fecha_nacimiento"
    }
  ];

  for (const col of columnas) {
    const existe = await columnaExiste('personas', col.nombre);
    if (!existe) {
      await ejecutar(`ALTER TABLE personas ${col.sql}`);
    }
  }
}

async function asegurarCampoFinalizadoEventos() {
  const existe = await columnaExiste('eventos', 'finalizado');
  if (!existe) {
    await ejecutar(`
      ALTER TABLE eventos
      ADD COLUMN finalizado TINYINT(1) NOT NULL DEFAULT 0
    `);
  }
}

async function ejecutarMigraciones() {
  await asegurarEstadoIntegrantes();
  await asegurarCamposPersonas();
  await asegurarCampoFinalizadoEventos();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
