// Acceso MySQL de recuperación de clave ("¿Olvidaste tu contraseña?"): tokens de un
// solo uso para directiva (tipo 'usuario') y socios (tipo 'socio'). Se guarda solo
// el hash del token; vencimiento y uso se comparan con NOW() de la BD para no
// depender de la zona horaria de Node.
const db = require('../config/db');

const MINUTOS_VIGENCIA = 30;

// Crea un token nuevo e invalida los anteriores sin usar de la misma cuenta:
// solo el último enlace enviado sirve.
exports.crear = (tipo, referenciaId, tokenHash, callback) => {
  db.query(
    `UPDATE recuperaciones_clave SET usado_en = NOW()
     WHERE tipo = ? AND referencia_id = ? AND usado_en IS NULL`,
    [tipo, referenciaId],
    errInvalidar => {
      if (errInvalidar) return callback(errInvalidar);
      db.query(
        `INSERT INTO recuperaciones_clave (tipo, referencia_id, token_hash, expira_en)
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
        [tipo, referenciaId, tokenHash, MINUTOS_VIGENCIA],
        callback
      );
    }
  );
};

exports.buscarVigente = (tipo, tokenHash, callback) => {
  db.query(
    `SELECT id, referencia_id FROM recuperaciones_clave
     WHERE tipo = ? AND token_hash = ? AND usado_en IS NULL AND expira_en > NOW()
     LIMIT 1`,
    [tipo, tokenHash],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// Condicional: si dos pestañas usan el mismo enlace a la vez, solo una lo consume
// (affectedRows = 1); la otra recibe "enlace vencido".
exports.consumir = (id, callback) => {
  db.query(
    'UPDATE recuperaciones_clave SET usado_en = NOW() WHERE id = ? AND usado_en IS NULL AND expira_en > NOW()',
    [id],
    (err, result) => callback(err, !!(result && result.affectedRows === 1))
  );
};

exports.MINUTOS_VIGENCIA = MINUTOS_VIGENCIA;
