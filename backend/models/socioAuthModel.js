// Acceso MySQL para la autenticación del Portal del Socio: PIN, intentos fallidos y bloqueo temporal.
// Tabla separada de `personas` a propósito (ver migrations.js) para que el hash del PIN
// nunca viaje junto con el resto de la ficha del integrante.
// Sin fila en socios_auth = el socio aún no crea su PIN y su clave es el RUT
// (ver socioAuthController.js); la fila se crea al guardar el primer PIN.
const db = require('../config/db');

const MAX_INTENTOS_FALLIDOS = 5;
const MINUTOS_BLOQUEO = 15;

// Trae lo necesario para intentar un login: hash, estado de bloqueo y si ya creó
// su PIN. LEFT JOIN: quien no tiene fila en socios_auth entra con su RUT.
// Solo integrantes activos (igual criterio que el resto del sistema).
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
      sa.datos_actualizados,
      sa.bloqueado_hasta
    FROM personas p
    LEFT JOIN socios_auth sa ON sa.persona_id = p.id
    WHERE p.activo = 1
      AND REPLACE(REPLACE(UPPER(p.rut), '.', ''), '-', '') = ?
    LIMIT 1
  `;
  db.query(query, [rutLimpio], (err, results) => {
    callback(err, results ? results[0] : null);
  });
};

// "¿Olvidaste tu PIN?": datos mínimos para enviar el enlace de recuperación.
exports.buscarParaRecuperar = (rutLimpio, callback) => {
  db.query(
    `SELECT id AS persona_id, nombres, apellido_paterno, email
     FROM personas
     WHERE activo = 1 AND COALESCE(estado, 'activo') <> 'inactivo'
       AND REPLACE(REPLACE(UPPER(rut), '.', ''), '-', '') = ?
     LIMIT 1`,
    [rutLimpio],
    (err, results) => callback(err, results ? results[0] : null)
  );
};

// Incluye el RUT: mientras el socio no cree su PIN, la clave actual es el RUT.
exports.obtenerPorPersonaId = (personaId, callback) => {
  db.query(
    `SELECT p.id AS persona_id, p.rut, sa.pin_hash, sa.pin_cambiado
     FROM personas p
     LEFT JOIN socios_auth sa ON sa.persona_id = p.id
     WHERE p.id = ? AND p.activo = 1
     LIMIT 1`,
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

// El socio guarda su PIN propio (primer ingreso obligatorio, o voluntario
// después). Crea la fila si no existía: es el paso que deja atrás la clave = RUT.
exports.guardarPinPropio = (personaId, pinHash, callback) => {
  const query = `
    INSERT INTO socios_auth (persona_id, pin_hash, pin_cambiado, intentos_fallidos, bloqueado_hasta, ultimo_login)
    VALUES (?, ?, 1, 0, NULL, NOW())
    ON DUPLICATE KEY UPDATE
      pin_hash = VALUES(pin_hash),
      pin_cambiado = 1,
      intentos_fallidos = 0,
      bloqueado_hasta = NULL
  `;
  db.query(query, [personaId, pinHash], callback);
};

// Admin: "olvidé mi PIN" / desbloqueo. Borrar la fila devuelve al socio al
// estado inicial (clave = RUT) y limpia intentos y bloqueo.
exports.restablecerAcceso = (personaId, callback) => {
  db.query('DELETE FROM socios_auth WHERE persona_id = ?', [personaId], callback);
};

// Estado del primer ingreso del socio autenticado: lo usa perfilSocioMiddleware
// para no entregar datos personales hasta que cree su PIN y actualice sus datos.
exports.obtenerEstadoPerfil = (personaId, callback) => {
  db.query(
    'SELECT pin_cambiado, datos_actualizados FROM socios_auth WHERE persona_id = ? LIMIT 1',
    [personaId],
    (err, results) => callback(err, results ? results[0] : null)
  );
};

// Admin: vuelve a exigir la actualización de datos en el próximo ingreso. Con
// personaId a uno solo; sin él, a todos los que ya la habían hecho.
exports.solicitarActualizacionDatos = (personaId, callback) => {
  if (personaId) {
    return db.query('UPDATE socios_auth SET datos_actualizados = 0 WHERE persona_id = ?', [personaId], callback);
  }
  db.query('UPDATE socios_auth SET datos_actualizados = 0 WHERE datos_actualizados = 1', callback);
};

// Vista de seguimiento para el admin: quién ya creó su PIN propio (primer
// ingreso completo), si está bloqueado y cuándo fue la última vez que entró.
exports.listarEstadoAcceso = (callback) => {
  const query = `
    SELECT
      p.id AS persona_id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
      p.telefono, sa.ultimo_login, sa.bloqueado_hasta, sa.datos_actualizados_en,
      CASE WHEN sa.pin_cambiado = 1 THEN 1 ELSE 0 END AS pin_propio,
      CASE WHEN sa.datos_actualizados = 1 THEN 1 ELSE 0 END AS datos_actualizados
    FROM personas p
    LEFT JOIN socios_auth sa ON sa.persona_id = p.id
    WHERE p.activo = 1
    ORDER BY p.apellido_paterno, p.nombres
  `;
  db.query(query, callback);
};
