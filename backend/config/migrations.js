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
    { nombre: 'es_honorario',      sql: "ADD COLUMN es_honorario TINYINT(1) NOT NULL DEFAULT 0" },
    // Campos de la ficha de inscripción GDC (planilla "Nuevos 2027")
    { nombre: 'rut_apoderado',     sql: "ADD COLUMN rut_apoderado VARCHAR(20) NULL AFTER telefono_apoderado" },
    { nombre: 'observacion',       sql: "ADD COLUMN observacion VARCHAR(255) NULL" },
    { nombre: 'bautizo',           sql: "ADD COLUMN bautizo TINYINT(1) NOT NULL DEFAULT 0" },
    { nombre: 'comunion',          sql: "ADD COLUMN comunion TINYINT(1) NOT NULL DEFAULT 0" },
    { nombre: 'confirmacion',      sql: "ADD COLUMN confirmacion TINYINT(1) NOT NULL DEFAULT 0" }
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

  // Marcador de inicio de temporada (casilla "Inicia temporada" del formulario de
  // actividades). Reemplaza el corte por nombre "Despedida de Pueblo": al crear la
  // columna se marcan una sola vez las Despedidas ya cargadas (para conservar las
  // temporadas pasadas) y la Misa a la Chilena de sept-2026, que abre 2026-2027.
  // Después lo administra la directiva desde el formulario.
  if (!colsEventos.has('inicia_temporada')) {
    await ejecutar(`
      ALTER TABLE eventos
      ADD COLUMN inicia_temporada TINYINT(1) NOT NULL DEFAULT 0
    `);
    await ejecutar(`
      UPDATE eventos
      SET inicia_temporada = 1
      WHERE LOWER(nombre) LIKE 'despedida de pueblo%'
         OR (LOWER(nombre) LIKE 'misa a la chilena%' AND fecha >= '2026-09-01' AND fecha < '2026-11-01')
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

// Ingresos de terceros: dinero que entra al club sin venir de la cuota o multa
// de un integrante (donaciones, premios, proyectos adjudicados). Por eso no
// tiene persona_id y no afecta la deuda ni el puntaje de ningún socio.
async function asegurarTablaIngresos() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS ingresos (
      id                INT AUTO_INCREMENT PRIMARY KEY,
      descripcion       VARCHAR(200) NOT NULL,
      categoria         VARCHAR(50) NOT NULL,
      origen            VARCHAR(150) NOT NULL,
      monto             DECIMAL(10,2) NOT NULL,
      fecha             DATE NOT NULL,
      responsable       VARCHAR(150) NULL,
      comprobante_path  VARCHAR(255) NULL,
      registrado_por    INT NULL,
      created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ingresos_fecha (fecha)
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

// Art. 9.3, escenario a: las diez cuotas del pago anual al inicio valen 20
// puntos cada una. Las futuras ya tienen 20; esta migracion corrige octubre.
async function ajustarPagoAnualInicioCiclo() {
  await ejecutar(`
    UPDATE puntajes pt
    JOIN cuotas c ON c.id = pt.cuota_id
    JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
    JOIN pagos pg ON pg.id = d.pago_id
    JOIN (
      SELECT d2.pago_id
      FROM pago_detalle d2
      WHERE d2.tipo = 'cuota'
      GROUP BY d2.pago_id
      HAVING COUNT(DISTINCT d2.referencia_id) = 10
         AND SUM(d2.monto_pagado) >= 120000
    ) anual ON anual.pago_id = pg.id
    SET pt.puntos = 20,
        pt.detalle = 'Cuota pagada anticipadamente (art. 9.3, pago anual al inicio)'
    WHERE c.anio = 2025 AND c.mes = 10
      AND YEAR(pg.fecha) = 2025 AND MONTH(pg.fecha) = 10
      AND pg.monto_total >= 120000
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

// Actualización de datos obligatoria en el Portal del Socio (después de crear el
// PIN): mientras datos_actualizados=0 el socio no ve su página personal. El admin
// puede volver a exigirla (ej. cada temporada) poniendo el flag en 0.
async function asegurarDatosActualizadosSocios() {
  const cols = await columnasExistentes('socios_auth');
  // Secuencial: dos ALTER sobre la misma tabla no ganan nada en paralelo.
  if (!cols.has('datos_actualizados')) {
    await ejecutar('ALTER TABLE socios_auth ADD COLUMN datos_actualizados TINYINT(1) NOT NULL DEFAULT 0');
  }
  if (!cols.has('datos_actualizados_en')) {
    await ejecutar('ALTER TABLE socios_auth ADD COLUMN datos_actualizados_en DATETIME NULL');
  }
}

// "¿Olvidaste tu contraseña?" (directiva y socios): enlace de un solo uso por email.
// Solo se guarda el SHA-256 del token (un respaldo filtrado no sirve para resetear
// cuentas). tipo+referencia_id apunta a usuarios.id o personas.id según el caso.
// usuarios.email: la directiva no tenía email registrado, sin él no hay a dónde
// enviar el enlace.
async function asegurarRecuperacionClave() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS recuperaciones_clave (
      id            BIGINT AUTO_INCREMENT PRIMARY KEY,
      tipo          ENUM('usuario', 'socio') NOT NULL,
      referencia_id BIGINT NOT NULL,
      token_hash    CHAR(64) NOT NULL,
      expira_en     DATETIME NOT NULL,
      usado_en      DATETIME NULL,
      creado_en     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_recuperacion_token (token_hash),
      KEY idx_recuperacion_referencia (tipo, referencia_id)
    )
  `);
  const cols = await columnasExistentes('usuarios');
  if (!cols.has('email')) {
    await ejecutar('ALTER TABLE usuarios ADD COLUMN email VARCHAR(150) NULL');
  }
}

// Cambio de clave obligatorio en el primer ingreso del panel admin (mismo criterio
// que el PIN del Portal del Socio). DEFAULT 1: al crear la columna, todos los
// usuarios existentes quedan obligados a cambiar su clave en el próximo login, y
// todo usuario nuevo creado por SQL (clave genérica de la directiva) también.
async function asegurarCambioPasswordUsuarios() {
  const cols = await columnasExistentes('usuarios');
  if (!cols.has('debe_cambiar_password')) {
    await ejecutar('ALTER TABLE usuarios ADD COLUMN debe_cambiar_password TINYINT(1) NOT NULL DEFAULT 1');
  }
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

// Corte oficial de temporada (art. 9.1.1): la actividad marcada con
// inicia_temporada = 1 (hasta 2026 la "Despedida de Pueblo"; desde 2026-2027 la
// "Misa a la Chilena") abre una temporada y es su primera actividad puntuable.
// Se toma la mas reciente que ya ocurrio como fecha de corte; los puntajes de esa
// fecha en adelante son de la temporada vigente y son los unicos que suman en el
// ranking oficial. Si no hay ninguna marcada, no se aplica corte (se preserva el
// comportamiento historico) para no vaciar el ranking antes de tiempo.
async function reconstruirVistaRankingPuntaje() {
  await ejecutar(`
    CREATE OR REPLACE VIEW vista_ranking_puntaje AS
    SELECT
      p.id,
      p.rut,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.bloque,
      CASE
        WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
        ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE())
      END AS puntos_antiguedad,
      COALESCE(SUM(CASE WHEN pt.cuota_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_cuotas,
      COALESCE(SUM(CASE WHEN pt.asistencia_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_asistencia,
      COALESCE(SUM(pt.puntos), 0) + CASE
        WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
        ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE())
      END AS puntaje_total,
      COUNT(pt.id)                AS total_registros
    FROM personas p
    LEFT JOIN puntajes pt
      ON p.id = pt.persona_id
      AND pt.fecha >= (
        SELECT COALESCE(MAX(DATE(e.fecha)), '1900-01-01')
        FROM eventos e
        WHERE e.inicia_temporada = 1
          AND DATE(e.fecha) <= CURDATE()
      )
    WHERE p.activo = 1 AND COALESCE(p.estado, 'activo') = 'activo'
    GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque, p.fecha_ingreso
    ORDER BY puntaje_total DESC
  `);
}

// Pestaña "Documentos" del Portal del Socio: cartas que antes se entregaban en
// papel. id = Nº de folio. Una justificación aprobada cambia la asistencia del
// evento a justificado/licencia_medica (Art. 8.4); evento_id NULL = "Otro"
// (actividad que no está en el sistema). Solo se reciben hasta el cierre de
// asistencia (Art. 8.7), lo valida el controller, no la tabla.
async function asegurarTablasDocumentosSocio() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS justificaciones (
      id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
      persona_id            BIGINT NOT NULL,
      evento_id             BIGINT NULL,
      referencia            ENUM('ensayo', 'reunion', 'salida', 'otro') NOT NULL,
      referencia_otro       VARCHAR(150) NULL,
      fecha_actividad       DATE NOT NULL,
      tipo_solicitado       ENUM('justificado', 'licencia_medica') NOT NULL DEFAULT 'justificado',
      condicion             ENUM('bailarin', 'socio') NOT NULL,
      motivo                TEXT NOT NULL,
      quien_entrega         VARCHAR(150) NULL,
      adjunto_path          VARCHAR(255) NULL,
      estado                ENUM('pendiente', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente',
      estado_aplicado       ENUM('justificado', 'licencia_medica') NULL,
      observacion_directiva VARCHAR(300) NULL,
      revisado_por          INT NULL,
      revisado_en           DATETIME NULL,
      email_enviado         TINYINT(1) NOT NULL DEFAULT 0,
      creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_justificacion_persona (persona_id),
      KEY idx_justificacion_estado (estado),
      KEY idx_justificacion_evento (evento_id),
      CONSTRAINT fk_justificacion_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
      CONSTRAINT fk_justificacion_evento FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL
    )
  `);
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS postulaciones_bloque (
      id             BIGINT AUTO_INCREMENT PRIMARY KEY,
      persona_id     BIGINT NOT NULL,
      bloque_actual  VARCHAR(100) NULL,
      es_nuevo       TINYINT(1) NOT NULL DEFAULT 0,
      opcion_1       VARCHAR(100) NOT NULL,
      opcion_2       VARCHAR(100) NULL,
      celular        VARCHAR(20) NULL,
      email          VARCHAR(150) NULL,
      email_enviado  TINYINT(1) NOT NULL DEFAULT 0,
      creado_en      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_postulacion_persona (persona_id),
      CONSTRAINT fk_postulacion_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `);
  // Comprobantes de depósito/transferencia que el socio envía a tesorería. Solo
  // aviso: no crea el pago; tesorería lo registra en el panel al confirmarlo.
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS comprobantes_deposito (
      id              BIGINT AUTO_INCREMENT PRIMARY KEY,
      persona_id      BIGINT NOT NULL,
      monto           INT NOT NULL,
      fecha_deposito  DATE NOT NULL,
      concepto        VARCHAR(200) NULL,
      adjunto_path    VARCHAR(255) NOT NULL,
      email_enviado   TINYINT(1) NOT NULL DEFAULT 0,
      creado_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_comprobante_persona (persona_id),
      CONSTRAINT fk_comprobante_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
    )
  `);
}

// Solicitudes "Súmate a la promesa" del sitio gdcayquina.cl: datos básicos del
// postulante (y del apoderado si es menor). Al aprobarla se crea el integrante;
// el resto de los datos los completa él mismo en su primer ingreso al Portal.
async function asegurarTablaSolicitudesIngreso() {
  await ejecutar(`
    CREATE TABLE IF NOT EXISTS solicitudes_ingreso (
      id                    BIGINT AUTO_INCREMENT PRIMARY KEY,
      rut                   VARCHAR(12) NOT NULL,
      nombres               VARCHAR(100) NOT NULL,
      apellido_paterno      VARCHAR(100) NOT NULL,
      apellido_materno      VARCHAR(100) NULL,
      fecha_nacimiento      DATE NOT NULL,
      telefono              VARCHAR(20) NOT NULL,
      email                 VARCHAR(150) NOT NULL,
      comparsa_interes      VARCHAR(150) NULL,
      mensaje               VARCHAR(500) NULL,
      nombre_apoderado      VARCHAR(150) NULL,
      rut_apoderado         VARCHAR(12) NULL,
      telefono_apoderado    VARCHAR(20) NULL,
      estado                ENUM('pendiente', 'aprobada', 'rechazada') NOT NULL DEFAULT 'pendiente',
      persona_id            BIGINT NULL,
      observacion_directiva VARCHAR(300) NULL,
      revisado_por          INT NULL,
      revisado_en           DATETIME NULL,
      email_enviado         TINYINT(1) NOT NULL DEFAULT 0,
      creado_en             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      KEY idx_solicitud_rut (rut),
      KEY idx_solicitud_estado (estado),
      CONSTRAINT fk_solicitud_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE SET NULL
    )
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
  await ajustarPagoAnualInicioCiclo();
  await asegurarTablaGastos();
  await asegurarTablaIngresos();
  await asegurarTablasFormaciones();
  await asegurarTablaSociosAuth();
  await asegurarDatosActualizadosSocios();
  await asegurarCambioPasswordUsuarios();
  await asegurarRecuperacionClave();
  await asegurarCamposPagos();
  await asegurarTablasDocumentosSocio();
  await asegurarTablaSolicitudesIngreso();
  await consolidarTiposCuota();
  await reconstruirVistaRankingPuntaje();
  await reconstruirVistaEstadoFinanciero();
}

module.exports = ejecutarMigraciones;
