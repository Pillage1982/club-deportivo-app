// Acceso MySQL para la autenticación del Portal del Socio: PIN, intentos fallidos y bloqueo temporal.
// Tabla separada de `personas` a propósito (ver migrations.js) para que el hash del PIN
// nunca viaje junto con el resto de la ficha del integrante.
const db = require('../config/db');

const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO = 15;

// Trae lo necesario para intentar un login: hash, estado de bloqueo y si ya cambió
// el PIN inicial. Solo integrantes activos (igual criterio que el resto del sistema).
exports.obtenerParaLogin = (rutLimpio, callback) => {
  const query = `
    SELECT
      p.id AS persona_id,
      p.rut,
      p.nombres,
      p.apellido_paterno,
      p.estado,
      sa.pin_hash,
      sa.pin_cambiado,
      sa.bloqueado_hasta
    FROM personas p
    INNER JOIN socios_auth sa ON sa.persona_id = p.id
    WHERE p.activo = 1
      AND REPLACE(REPLACE(UPPER(p.rut), '.', ''), '-', '') = ?
    LIMIT 1
  `;
  db.query(query, [rutLimpio], (err, results) => {
    callback(err, results ? results[0] : null);
  });
};

exports.obtenerPorPersonaId = (personaId, callback) => {
  db.query(
    'SELECT persona_id, pin_hash, pin_cambiado FROM socios_auth WHERE persona_id = ? LIMIT 1',
    [personaId],
    (err, results) => callback(err, results ? results[0] : null)
  );
};

// Datos básicos de la persona para entregar/mostrar un PIN recién generado
// (nombre para el saludo, rut como usuario, telefono/email como canal de envío).
exports.obtenerDatosPersonaBasico = (personaId, callback) => {
  db.query(
    `SELECT id AS persona_id, rut, nombres, apellido_paterno, apellido_materno, email, telefono
     FROM personas WHERE id = ? AND activo = 1 LIMIT 1`,
    [personaId],
    (err, results) => callback(err, results ? results[0] : null)
  );
};

exports.registrarIntentoFallido = (personaId, callback) => {
  const query = `
    UPDATE socios_auth
    SET
      intentos_fallidos = intentos_fallidos + 1,
      bloqueado_hasta = CASE
        WHEN intentos_fallidos + 1 >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE)
        ELSE bloqueado_hasta
      END
    WHERE persona_id = ?
  `;
  db.query(query, [MAX_INTENTOS_FALLIDOS, MINUTOS_BLOQUEO, personaId], callback);
};

exports.registrarLoginExitoso = (personaId, callback) => {
  db.query(
    `UPDATE socios_auth
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_login = NOW()
     WHERE persona_id = ?`,
    [personaId],
    callback
  );
};

// Asigna (o regenera) el PIN de un socio: resetea intentos y bloqueo, y vuelve
// a exigir el cambio obligatorio de primer ingreso. Sirve tanto para el alta
// inicial como para "regenerar PIN" cuando el socio lo perdió.
exports.asignarPin = (personaId, pinHash, callback) => {
  const query = `
    INSERT INTO socios_auth (persona_id, pin_hash, pin_cambiado, intentos_fallidos, bloqueado_hasta)
    VALUES (?, ?, 0, 0, NULL)
    ON DUPLICATE KEY UPDATE
      pin_hash = VALUES(pin_hash),
      pin_cambiado = 0,
      intentos_fallidos = 0,
      bloqueado_hasta = NULL
  `;
  db.query(query, [personaId, pinHash], callback);
};

// El propio socio cambiando su PIN (primer ingreso obligatorio, o voluntario después).
exports.actualizarPinPropio = (personaId, pinHash, callback) => {
  db.query(
    'UPDATE socios_auth SET pin_hash = ?, pin_cambiado = 1 WHERE persona_id = ?',
    [pinHash, personaId],
    callback
  );
};

// Integrantes activos que todavía no tienen fila en socios_auth: la base del
// enrolamiento masivo (idempotente, nunca repite a quien ya tiene acceso).
exports.listarPersonasActivasSinAuth = (callback) => {
  const query = `
    SELECT p.id AS persona_id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.email, p.telefono
    FROM personas p
    LEFT JOIN socios_auth sa ON sa.persona_id = p.id
    WHERE p.activo = 1 AND sa.persona_id IS NULL
    ORDER BY p.apellido_paterno, p.nombres
  `;
  db.query(query, callback);
};

// Vista de seguimiento para el admin: quién tiene acceso, si ya hizo el primer
// ingreso (cambió el PIN) y cuándo fue la última vez que entró.
exports.listarEstadoAcceso = (callback) => {
  const query = `
    SELECT
      p.id AS persona_id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
      sa.pin_cambiado, sa.ultimo_login, sa.bloqueado_hasta,
      CASE WHEN sa.persona_id IS NULL THEN 0 ELSE 1 END AS tiene_acceso
    FROM personas p
    LEFT JOIN socios_auth sa ON sa.persona_id = p.id
    WHERE p.activo = 1
    ORDER BY p.apellido_paterno, p.nombres
  `;
  db.query(query, callback);
};
