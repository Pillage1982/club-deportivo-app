// Migraciones idempotentes de arranque: detectan columnas/tablas existentes antes de adaptar la base activa.
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
  // Multas se muestran como informativo pero NO suman a deuda_actual
  // (la agrupación no las cobra actualmente — se reactivarán cuando lo decidan)
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
        COALESCE(c.total_cuotas, 0)
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
      FROM cuotas
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

  // El formulario ya captura fecha+hora (datetime-local) pero la columna DATE
  // truncaba la hora al guardar. Se amplía a DATETIME para conservarla y poder
  // desambiguar actividades del mismo día (ej. viaje anual con varias actividades
  // separadas por ~1 hora).
  if (String(colsEventos._tipos['fecha'] || '').toLowerCase() === 'date') {
    await ejecutar(`
      ALTER TABLE eventos
      MODIFY COLUMN fecha DATETIME NOT NULL
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
      id            INT AUTO_INCREMENT PRIMARY KEY,
      persona_id    INT NOT NULL,
      asistencia_id INT NULL,
      evento_id     INT NULL,
      cuota_id      INT NULL,
      puntos        INT NOT NULL,
      detalle       VARCHAR(200) NOT NULL,
      fecha         DATE NOT NULL,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_asistencia (asistencia_id),
      UNIQUE KEY uk_cuota (cuota_id)
    )
  `);
}

async function asegurarCamposPuntajes() {
  const cols = await columnasExistentes('puntajes');
  if (!cols.has('cuota_id')) {
    await ejecutar(`
      ALTER TABLE puntajes
        MODIFY COLUMN asistencia_id INT NULL,
        MODIFY COLUMN evento_id     INT NULL,
        ADD COLUMN cuota_id         INT NULL AFTER evento_id,
        ADD UNIQUE KEY uk_cuota (cuota_id)
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

// Esta bonificacion se cargo por una interpretacion incorrecta de los estatutos.
// Se elimina de forma idempotente sin afectar los puntos normales de cada cuota.
async function eliminarBonificacionPagoAnual() {
  await ejecutar(`
    DELETE FROM puntajes
    WHERE detalle = 'Bonificación pago anual en un solo pago (temporada 2025-2026)'
  `);
}

async function asegurarTablasFormaciones() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS formaciones (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      evento_id       BIGINT NOT NULL,
      bloque          VARCHAR(100) NOT NULL,
      estado          ENUM('borrador','confirmada') NOT NULL DEFAULT 'borrador',
      fecha_ranking   DATETIME NOT NULL,
      creado_por      INT NOT NULL,
      confirmado_por INT NULL,
      observaciones   TEXT NULL,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      confirmed_at    DATETIME NULL,
      UNIQUE KEY uk_formacion_evento_bloque (evento_id, bloque),
      KEY idx_formacion_estado (estado),
      CONSTRAINT fk_formacion_evento FOREIGN KEY (evento_id) REFERENCES eventos(id),
      CONSTRAINT fk_formacion_creador FOREIGN KEY (creado_por) REFERENCES usuarios(id),
      CONSTRAINT fk_formacion_confirmador FOREIGN KEY (confirmado_por) REFERENCES usuarios(id)
    )
  `);

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS formacion_posiciones (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      formacion_id      INT NOT NULL,
      persona_id        BIGINT NOT NULL,
      orden_general     INT NOT NULL,
      puntaje_utilizado INT NOT NULL DEFAULT 0,
      ajuste_manual     TINYINT(1) NOT NULL DEFAULT 0,
      motivo_ajuste     VARCHAR(255) NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_formacion_orden (formacion_id, orden_general),
      UNIQUE KEY uk_formacion_persona (formacion_id, persona_id),
      CONSTRAINT fk_posicion_formacion FOREIGN KEY (formacion_id) REFERENCES formaciones(id) ON DELETE CASCADE,
      CONSTRAINT fk_posicion_persona FOREIGN KEY (persona_id) REFERENCES personas(id)
    )
  `);
}

async function asegurarCamposPagos() {
  const cols = await columnasExistentes('pagos');
  if (!cols.has('referencia_externa')) {
    await ejecutar('ALTER TABLE pagos ADD COLUMN referencia_externa CHAR(64) NULL');
  }
  if (!cols.has('fecha_precision')) {
    await ejecutar("ALTER TABLE pagos ADD COLUMN fecha_precision ENUM('exacta','mensual') NOT NULL DEFAULT 'exacta'");
  }
}

async function consolidarTiposCuota() {
  const mensualidades = await ejecutar("SELECT id FROM tipos_cuotas WHERE nombre='Mensualidad' ORDER BY id");
  if (!mensualidades.length) {
    await ejecutar("INSERT INTO tipos_cuotas (nombre,monto_base,descripcion) VALUES ('Mensualidad',12000,'Cuota mensual GDC')");
    return;
  }
  const canonico = mensualidades[0].id;
  for (const duplicado of mensualidades.slice(1)) {
    await ejecutar('UPDATE IGNORE cuotas SET tipo_cuota_id=? WHERE tipo_cuota_id=?', [canonico, duplicado.id]);
    await ejecutar('DELETE FROM cuotas WHERE tipo_cuota_id=?', [duplicado.id]);
    await ejecutar('DELETE FROM tipos_cuotas WHERE id=?', [duplicado.id]);
  }
  await ejecutar("UPDATE tipos_cuotas SET monto_base=12000, descripcion='Cuota mensual GDC' WHERE id=?", [canonico]);
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
  await asegurarCamposPuntajes();
  await eliminarBonificacionPagoAnual();
  await asegurarTablaGastos();
  await asegurarTablasFormaciones();
  await asegurarCamposPagos();
  await consolidarTiposCuota();
  await reconstruirVistaRankingPuntaje();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
