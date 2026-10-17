// Acceso MySQL de los comprobantes de depósito que los socios envían a tesorería
// desde el Portal del Integrante (pestaña Documentos).
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

// `desde` ('YYYY-MM-DD'): el portal lista solo la temporada vigente.
exports.listarSocio = (personaId, desde) =>
  ejecutar(`
    SELECT id, monto, fecha_deposito, concepto, email_enviado, creado_en, pago_id
    FROM comprobantes_deposito
    WHERE persona_id = ? AND (fecha_deposito >= ? OR creado_en >= ?)
    ORDER BY creado_en DESC
    LIMIT 50
  `, [personaId, desde, desde]);

// =====================================
// PANEL (tesorería): usar el comprobante como respaldo de un pago
// =====================================

// Todos los comprobantes enviados; pendientes (sin pago) primero.
exports.listarPanel = () =>
  ejecutar(`
    SELECT cd.id, cd.persona_id, cd.monto, cd.fecha_deposito, cd.concepto,
           cd.creado_en, cd.pago_id,
           p.nombres, p.apellido_paterno, p.apellido_materno
    FROM comprobantes_deposito cd
    JOIN personas p ON p.id = cd.persona_id
    ORDER BY (cd.pago_id IS NULL) DESC, cd.creado_en DESC
  `);

exports.listarPendientesPersona = personaId =>
  ejecutar(`
    SELECT id, monto, fecha_deposito, concepto, creado_en
    FROM comprobantes_deposito
    WHERE persona_id = ? AND pago_id IS NULL
    ORDER BY creado_en DESC
  `, [personaId]);

exports.obtenerPorId = id =>
  ejecutar('SELECT id, persona_id, adjunto_path, pago_id FROM comprobantes_deposito WHERE id = ?', [id])
    .then(rows => rows[0] || null);

// Solo vincula si sigue pendiente: evita que dos pagos usen el mismo comprobante.
exports.vincularPago = (id, pagoId) =>
  ejecutar('UPDATE comprobantes_deposito SET pago_id = ? WHERE id = ? AND pago_id IS NULL', [pagoId, id])
    .then(result => result.affectedRows > 0);

// Al eliminar el pago o cambiarle el comprobante, el depósito vuelve a pendiente.
exports.desvincularPago = pagoId =>
  ejecutar('UPDATE comprobantes_deposito SET pago_id = NULL WHERE pago_id = ?', [pagoId]);
