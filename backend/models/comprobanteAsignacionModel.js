// Reparto de un comprobante entre uno o varios integrantes (tabla comprobante_asignaciones)
// y datos de apoyo para calcular el permiso (beneficiario + pagadores_autorizados).
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

// Integrante que será beneficiario de una asignación. Acepta id o RUT.
// Devuelve null si no existe o está dado de baja ('inactivo').
exports.obtenerIntegrante = ({ id, rut }) => {
  const where = id ? 'p.id = ?' : 'p.rut = ?';
  const valor = id || rut;
  return ejecutar(`
    SELECT p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.apoderado_id,
           DATE_FORMAT(p.fecha_nacimiento, '%Y-%m-%d') AS fecha_nacimiento,
           p.estado
    FROM personas p
    WHERE ${where}
    LIMIT 1
  `, [valor]).then(rows => {
    const persona = rows[0];
    if (!persona || persona.estado === 'inactivo') return null;
    return persona;
  });
};

// Integrantes cuyo apoderado es esta persona (para el reparto del Portal).
exports.menoresACargo = apoderadoId =>
  ejecutar(`
    SELECT id, rut, nombres, apellido_paterno, apellido_materno
    FROM personas
    WHERE apoderado_id = ? AND estado <> 'inactivo'
    ORDER BY nombres, apellido_paterno
  `, [apoderadoId]);

// ¿El tesorero ya autorizó a este pagador a pagar por este beneficiario?
exports.pagadorAutorizado = (pagadorId, beneficiarioId) =>
  ejecutar(
    'SELECT 1 FROM pagadores_autorizados WHERE pagador_id = ? AND beneficiario_id = ? LIMIT 1',
    [pagadorId, beneficiarioId]
  ).then(rows => rows.length > 0);

// Asignaciones de un comprobante (para "Mis comprobantes" y el panel de tesorería).
exports.listarPorComprobante = comprobanteId =>
  ejecutar(`
    SELECT a.id, a.integrante_id, a.monto_asignado, a.estado, a.cuota_id, a.pago_id,
           p.nombres, p.apellido_paterno, p.apellido_materno
    FROM comprobante_asignaciones a
    JOIN personas p ON p.id = a.integrante_id
    WHERE a.comprobante_id = ?
    ORDER BY a.id
  `, [comprobanteId]);

// Una asignación con datos de su comprobante (para aprobar / rechazar / confirmar).
exports.obtenerPorId = id =>
  ejecutar(`
    SELECT a.id, a.comprobante_id, a.integrante_id, a.monto_asignado, a.estado, a.pago_id,
           cd.persona_id AS comprobante_persona_id, cd.adjunto_path, cd.concepto
    FROM comprobante_asignaciones a
    JOIN comprobantes_deposito cd ON cd.id = a.comprobante_id
    WHERE a.id = ?
  `, [id]).then(rows => rows[0] || null);

// Aprobar una asignación en revisión (solo si aún no tiene pago).
exports.aprobar = (id, revisadoPor) =>
  ejecutar(
    `UPDATE comprobante_asignaciones
       SET estado='aprobada', revisado_por=?, revisado_en=NOW()
     WHERE id=? AND estado='pendiente_revision' AND pago_id IS NULL`,
    [revisadoPor, id]
  );

// Rechazar una asignación (mientras no tenga pago).
exports.rechazar = (id, revisadoPor) =>
  ejecutar(
    `UPDATE comprobante_asignaciones
       SET estado='rechazada', revisado_por=?, revisado_en=NOW()
     WHERE id=? AND pago_id IS NULL`,
    [revisadoPor, id]
  );

// Al confirmar: vincular el pago creado para ese beneficiario.
exports.marcarConPago = (id, pagoId) =>
  ejecutar(
    `UPDATE comprobante_asignaciones SET pago_id=?, estado='aprobada', revisado_en=NOW() WHERE id=?`,
    [pagoId, id]
  );

// El tesorero autoriza a un pagador a pagar por un beneficiario (pagos futuros = automatica).
exports.autorizarPagador = (pagadorId, beneficiarioId, autorizadoPor) =>
  ejecutar(
    `INSERT IGNORE INTO pagadores_autorizados (pagador_id, beneficiario_id, autorizado_por) VALUES (?, ?, ?)`,
    [pagadorId, beneficiarioId, autorizadoPor]
  );
