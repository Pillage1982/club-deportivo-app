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
  } else {
    // Corre en cada arranque del servidor (ejecutarMigraciones gatea app.listen),
    // así que el MODIFY solo se ejecuta si el tipo de columna aún no coincide,
    // en vez de un ALTER TABLE ciego en cada reinicio/redeploy.
    const filasTipo = await ejecutar(`
      SELECT COLUMN_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'personas' AND COLUMN_NAME = 'estado'
    `);
    const tipoActual = String(filasTipo[0]?.COLUMN_TYPE || '').toLowerCase();
    if (tipoActual !== "enum('activo','receso','inactivo')") {
      await ejecutar(`
        ALTER TABLE personas
        MODIFY COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo'
      `);
    }
  }

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

// Solo fecha_ingreso y es_honorario se portan de v1.3-dev: bloque/sexo/dirección
// son conceptos específicos de calamena, main ya los revirtió a propósito
// (ver commit "Revert: agregar campos bloque, sexo, dirección...").
async function asegurarCamposPersonas() {
  const columnas = [
    {
      nombre: 'fecha_ingreso',
      sql: "ADD COLUMN fecha_ingreso DATE NULL AFTER fecha_nacimiento"
    },
    {
      nombre: 'es_honorario',
      sql: "ADD COLUMN es_honorario TINYINT(1) NOT NULL DEFAULT 0 AFTER estado"
    },
    {
      nombre: 'apoderado_nombre',
      sql: "ADD COLUMN apoderado_nombre VARCHAR(150) NULL AFTER es_honorario"
    },
    {
      nombre: 'apoderado_telefono',
      sql: "ADD COLUMN apoderado_telefono VARCHAR(30) NULL AFTER apoderado_nombre"
    }
  ];

  const filasExistentes = await ejecutar(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'personas' AND COLUMN_NAME IN (?)`,
    [columnas.map(col => col.nombre)]
  );
  const existentes = new Set(filasExistentes.map(f => f.COLUMN_NAME));

  for (const col of columnas) {
    if (!existentes.has(col.nombre)) {
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

async function asegurarFechaHoraEventos() {

  // El formulario ya captura fecha+hora (datetime-local) pero la columna DATE
  // truncaba la hora al guardar. Se amplía a DATETIME para conservarla y poder
  // desambiguar actividades del mismo día (ej. viaje anual con varias actividades
  // separadas por ~1 hora).
  const filasFecha = await ejecutar(`
    SELECT DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eventos' AND COLUMN_NAME = 'fecha'
  `);
  if (String(filasFecha[0]?.DATA_TYPE || '').toLowerCase() === 'date') {
    await ejecutar(`
      ALTER TABLE eventos
      MODIFY COLUMN fecha DATETIME NOT NULL
    `);
  }
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

// Portal del socio (login RUT + PIN): tabla separada de `personas` para que un
// export o un bug de otra pantalla nunca exponga el hash del PIN. `persona_id`
// es PK 1:1, así ON DUPLICATE KEY UPDATE sirve tanto para el primer PIN como
// para regenerarlo. intentos_fallidos/bloqueado_hasta sostienen el lockout
// anti fuerza-bruta (ver socioAuthModel/socioAuthController).
async function asegurarTablaSociosAuth() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS socios_auth (
      persona_id        BIGINT PRIMARY KEY,
      pin_hash          VARCHAR(255) NOT NULL,
      pin_cambiado      TINYINT(1) NOT NULL DEFAULT 0,
      intentos_fallidos INT NOT NULL DEFAULT 0,
      bloqueado_hasta   DATETIME NULL,
      ultimo_login      DATETIME NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_socios_auth_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `);
}

async function ejecutarMigraciones() {
  await asegurarEstadoIntegrantes();
  await asegurarCamposPersonas();
  await asegurarCampoFinalizadoEventos();
  await asegurarFechaHoraEventos();
  await asegurarTablaGastos();
  await asegurarTablaSociosAuth();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
