// Acceso MySQL de los comprobantes de depósito que los socios envían a tesorería
// desde el Portal del Socio (pestaña Documentos).
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

exports.crear = data =>
  ejecutar(`
    INSERT INTO comprobantes_deposito (persona_id, monto, fecha_deposito, concepto, adjunto_path)
    VALUES (?, ?, ?, ?, ?)
  `, [data.persona_id, data.monto, data.fecha_deposito, data.concepto, data.adjunto_path])
    .then(result => result.insertId);

exports.obtenerFechaCreacion = id =>
  ejecutar('SELECT creado_en FROM comprobantes_deposito WHERE id = ?', [id])
    .then(rows => (rows[0] ? rows[0].creado_en : null));

exports.marcarEmail = id =>
  ejecutar('UPDATE comprobantes_deposito SET email_enviado = 1 WHERE id = ?', [id]);

exports.listarSocio = personaId =>
  ejecutar(`
    SELECT id, monto, fecha_deposito, concepto, email_enviado, creado_en
    FROM comprobantes_deposito
    WHERE persona_id = ?
    ORDER BY creado_en DESC
    LIMIT 50
  `, [personaId]);
