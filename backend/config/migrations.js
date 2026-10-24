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

// Pagos: tipo (solo 'cuota' rebaja la deuda de cuotas), detalle y comprobante
// adjunto. pago_detalle vincula cada pago de cuota con las cuotas que cubre (con
// abonos parciales); lo no asignado a ninguna cuota queda como saldo a favor.
async function asegurarCamposPagos() {
  if (!await columnaExiste('pagos', 'tipo_pago')) {
    // DEFAULT 'cuota': todos los pagos existentes quedan como pago de cuota.
    await ejecutar("ALTER TABLE pagos ADD COLUMN tipo_pago VARCHAR(30) NOT NULL DEFAULT 'cuota'");
  }
  if (!await columnaExiste('pagos', 'detalle')) {
    await ejecutar('ALTER TABLE pagos ADD COLUMN detalle VARCHAR(200) NULL');
  }
  if (!await columnaExiste('pagos', 'comprobante_path')) {
    await ejecutar('ALTER TABLE pagos ADD COLUMN comprobante_path VARCHAR(255) NULL');
  }

  await ejecutar(`
    CREATE TABLE IF NOT EXISTS pago_detalle (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      pago_id       BIGINT NOT NULL,
      tipo          ENUM('multa', 'cuota') NOT NULL,
      referencia_id BIGINT NOT NULL,
      monto_pagado  INT NOT NULL,
      KEY idx_pago_detalle_pago (pago_id),
      KEY idx_pago_detalle_referencia (tipo, referencia_id),
      FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE
    )
  `);
}

// Deuda = multas pendientes + todas las cuotas − pagos de tipo 'cuota'. Antes se
// sumaban solo las cuotas pendientes/vencidas y se restaban todos los pagos: una
// cuota pagada salía de las cuotas y además se restaba su pago (deuda negativa).
// Los pagos de otro tipo (inscripción, extras) entran a caja pero no son abono a cuotas.
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
      GROUP BY persona_id
    ) c
    ON p.id = c.persona_id

    LEFT JOIN (
      SELECT
        persona_id,
        SUM(monto_total) AS total_pagado
      FROM pagos
      WHERE tipo_pago = 'cuota'
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
    },
    {
      nombre: 'es_honorario',
      sql: "ADD COLUMN es_honorario TINYINT(1) NOT NULL DEFAULT 0 AFTER estado"
    },
    // Apoderado: solo para menores de 18 años (personaController lo exige y lo
    // deja en NULL para mayores).
    {
      nombre: 'nombre_apoderado',
      sql: "ADD COLUMN nombre_apoderado VARCHAR(150) NULL AFTER fecha_ingreso"
    },
    {
      nombre: 'telefono_apoderado',
      sql: "ADD COLUMN telefono_apoderado VARCHAR(30) NULL AFTER nombre_apoderado"
    }
  ];

  // Una sola consulta batcheada en vez de un round trip por columna
  // (una por columna) en cada arranque del servidor.
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

// Portal del Socio: tras crear su contraseña, el socio debe completar "Actualizar
// datos" (perfilSocioMiddleware). La directiva puede volver a exigirlo.
async function asegurarDatosActualizadosSocios() {
  // Secuencial: dos ALTER sobre la misma tabla no ganan nada en paralelo.
  if (!await columnaExiste('socios_auth', 'datos_actualizados')) {
    await ejecutar('ALTER TABLE socios_auth ADD COLUMN datos_actualizados TINYINT(1) NOT NULL DEFAULT 0');
  }
  if (!await columnaExiste('socios_auth', 'datos_actualizados_en')) {
    await ejecutar('ALTER TABLE socios_auth ADD COLUMN datos_actualizados_en DATETIME NULL');
  }
}

// Registro de actividad (auditoriaMiddleware): quién creó, editó o eliminó qué.
async function asegurarTablaAuditoria() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS auditoria (
      id           BIGINT AUTO_INCREMENT PRIMARY KEY,
      fecha        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actor_tipo   ENUM('usuario', 'integrante') NOT NULL,
      actor_id     BIGINT NULL,
      actor_nombre VARCHAR(100) NULL,
      rol          VARCHAR(30) NULL,
      modulo       VARCHAR(40) NOT NULL,
      accion       VARCHAR(40) NOT NULL,
      metodo       VARCHAR(10) NOT NULL,
      ruta         VARCHAR(255) NOT NULL,
      registro_id  BIGINT NULL,
      persona_id   BIGINT NULL,
      evento_id    BIGINT NULL,
      detalle      TEXT NULL,
      resultado    VARCHAR(255) NULL,
      ip           VARCHAR(45) NULL,
      KEY idx_auditoria_modulo_fecha (modulo, fecha),
      KEY idx_auditoria_actor (actor_tipo, actor_id),
      KEY idx_auditoria_fecha (fecha)
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
  await asegurarDatosActualizadosSocios();
  await asegurarTablaAuditoria();
  await asegurarCamposPagos();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
