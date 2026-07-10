const db = require('./db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

// Una sola query a INFORMATION_SCHEMA por tabla — devuelve Set con nombres de columnas existentes
async function columnasExistentes(tabla) {
  const filas = await ejecutar(
    `SELECT COLUMN_NAME, COLUMN_TYPE
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tabla]
  );
  const set = new Set(filas.map(f => f.COLUMN_NAME));
  set._tipos = Object.fromEntries(filas.map(f => [f.COLUMN_NAME, f.COLUMN_TYPE]));
  return set;
}

async function asegurarEstadoIntegrantes(colsPersonas) {
  if (!colsPersonas.has('estado')) {
    await ejecutar(`
      ALTER TABLE personas
      ADD COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo' AFTER activo
    `);
  } else if (!String(colsPersonas._tipos['estado'] || '').includes('receso')) {
    // MODIFY solo si el ENUM no tiene 'receso' aún (evita rebuild de tabla en cada arranque)
    await ejecutar(`
      ALTER TABLE personas
      MODIFY COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo'
    `);
  }

  await ejecutar(`
    UPDATE personas
    SET estado = CASE WHEN activo = 1 THEN 'activo' ELSE 'inactivo' END
    WHERE estado IS NULL OR estado = ''
  `);
}

async function reconstruirVistaEstadoFinanciero() {
  // CREATE OR REPLACE es atómico y no requiere DROP previo
  await ejecutar(`
    CREATE OR REPLACE VIEW vista_estado_financiero AS

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
        + COALESCE(c.total_cuotas, 0)
        - COALESCE(pg.total_pagado, 0)
      ) AS deuda_actual

    FROM personas p

    LEFT JOIN (
      SELECT persona_id, SUM(monto) AS total_multas
      FROM multas WHERE estado = 'pendiente'
      GROUP BY persona_id
    ) m ON p.id = m.persona_id

    LEFT JOIN (
      SELECT persona_id, SUM(monto) AS total_cuotas
      FROM cuotas WHERE estado IN ('pendiente', 'vencido')
      GROUP BY persona_id
    ) c ON p.id = c.persona_id

    LEFT JOIN (
      SELECT persona_id, SUM(monto_total) AS total_pagado
      FROM pagos
      GROUP BY persona_id
    ) pg ON p.id = pg.persona_id

    WHERE p.activo = 1 AND COALESCE(p.estado, 'activo') = 'activo'
  `);
}

async function asegurarCamposPersonas(colsPersonas) {
  const columnas = [
    { nombre: 'bloque',            sql: "ADD COLUMN bloque VARCHAR(100) NULL AFTER apellido_materno" },
    { nombre: 'sexo',              sql: "ADD COLUMN sexo ENUM('Masculino','Femenino') NULL AFTER bloque" },
    { nombre: 'direccion',         sql: "ADD COLUMN direccion VARCHAR(255) NULL AFTER sexo" },
    { nombre: 'fecha_ingreso',     sql: "ADD COLUMN fecha_ingreso DATE NULL AFTER fecha_nacimiento" },
    { nombre: 'nombre_apoderado',  sql: "ADD COLUMN nombre_apoderado VARCHAR(150) NULL AFTER fecha_ingreso" },
    { nombre: 'telefono_apoderado',sql: "ADD COLUMN telefono_apoderado VARCHAR(30) NULL AFTER nombre_apoderado" },
    { nombre: 'es_honorario',      sql: "ADD COLUMN es_honorario TINYINT(1) NOT NULL DEFAULT 0" }
  ];

  for (const col of columnas) {
    if (!colsPersonas.has(col.nombre)) {
      await ejecutar(`ALTER TABLE personas ${col.sql}`);
    }
  }
}

async function asegurarCamposEventos(colsEventos) {
  if (!colsEventos.has('finalizado')) {
    await ejecutar(`
      ALTER TABLE eventos
      ADD COLUMN finalizado TINYINT(1) NOT NULL DEFAULT 0
    `);
  }
}

async function asegurarEstadosAsistencia(colsAsistencias) {
  const tipoEstado = String(colsAsistencias._tipos['estado'] || '');
  if (!tipoEstado.includes('justificado')) {
    await ejecutar(`
      ALTER TABLE asistencias
      MODIFY COLUMN estado ENUM(
        'presente', 'atrasado', 'ausente',
        'justificado', 'licencia_medica', 'vestimenta_distinta', 'retiro_sin_aviso'
      ) NOT NULL DEFAULT 'presente'
    `);
  }
}

async function asegurarTablaPuntajes() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS puntajes (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      persona_id   INT NOT NULL,
      asistencia_id INT NOT NULL,
      evento_id    INT NOT NULL,
      puntos       INT NOT NULL,
      detalle      VARCHAR(200) NOT NULL,
      fecha        DATE NOT NULL,
      created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_asistencia (asistencia_id)
    )
  `);
}

async function reconstruirVistaRankingPuntaje() {
  await ejecutar(`
    CREATE OR REPLACE VIEW vista_ranking_puntaje AS
    SELECT
      p.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.bloque,
      COALESCE(SUM(pt.puntos), 0) AS puntaje_total,
      COUNT(pt.id)                AS total_registros
    FROM personas p
    LEFT JOIN puntajes pt ON p.id = pt.persona_id
    WHERE p.activo = 1 AND COALESCE(p.estado, 'activo') = 'activo'
    GROUP BY p.id, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque
    ORDER BY puntaje_total DESC
  `);
}

async function ejecutarMigraciones() {
  const [colsPersonas, colsEventos, colsAsistencias] = await Promise.all([
    columnasExistentes('personas'),
    columnasExistentes('eventos'),
    columnasExistentes('asistencias')
  ]);

  await asegurarEstadoIntegrantes(colsPersonas);
  await asegurarCamposPersonas(colsPersonas);
  await asegurarCamposEventos(colsEventos);
  await asegurarEstadosAsistencia(colsAsistencias);
  await asegurarTablaPuntajes();
  await reconstruirVistaRankingPuntaje();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
