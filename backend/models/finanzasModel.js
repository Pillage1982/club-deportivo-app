const db = require('../config/db');

exports.obtenerEstadoFinanciero = (callback) => {

  const query = `
    SELECT *
    FROM vista_estado_financiero
  `;

  db.query(query, callback);

};

// =====================================
// FICHA DE HISTORIAL FINANCIERO DE UN INTEGRANTE
// =====================================
// Incluye integrantes en receso o retirados (activo = 0): la ficha sirve también
// para revisar el historial de quien ya no está.

exports.obtenerDatosPersona = (personaId, callback) => {
  db.query(
    `SELECT id, rut, nombres, apellido_paterno, apellido_materno, bloque,
            COALESCE(estado, 'activo') AS estado, COALESCE(es_honorario, 0) AS es_honorario
     FROM personas WHERE id = ? LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// Deuda actual completa (misma fórmula que vista_estado_financiero), sin importar
// el período elegido para las tablas.
exports.obtenerResumenDeuda = (personaId, callback) => {
  db.query(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM multas WHERE persona_id = ? AND estado = 'pendiente') AS total_multas,
       (SELECT COALESCE(SUM(monto), 0) FROM cuotas WHERE persona_id = ?) AS total_cuotas,
       (SELECT COALESCE(SUM(monto_total), 0) FROM pagos WHERE persona_id = ? AND tipo_pago = 'cuota') AS total_pagado`,
    [personaId, personaId, personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// Cuotas desde `desde` ('YYYY-MM-DD', por su mes/año) con lo abonado a cada una.
exports.obtenerCuotas = (personaId, desde, callback) => {
  const [anio, mes] = String(desde).split('-').map(Number);
  db.query(
    `SELECT c.id, c.mes, c.anio, c.monto, c.estado,
            COALESCE(SUM(d.monto_pagado), 0) AS monto_pagado
     FROM cuotas c
     LEFT JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
     WHERE c.persona_id = ? AND c.anio * 100 + c.mes >= ?
     GROUP BY c.id, c.mes, c.anio, c.monto, c.estado
     ORDER BY c.anio, c.mes`,
    [personaId, anio * 100 + mes],
    callback
  );
};

// Pagos desde `desde` con los meses que cubrió cada uno (pago_detalle).
exports.obtenerPagos = (personaId, desde, callback) => {
  db.query(
    `SELECT pa.id, pa.fecha, pa.monto_total, pa.metodo, pa.tipo_pago, pa.detalle,
            pa.comprobante_path IS NOT NULL AS tiene_comprobante,
            GROUP_CONCAT(
              CONCAT(c.mes, '/', c.anio, ' ($', d.monto_pagado, ')')
              ORDER BY c.anio, c.mes SEPARATOR ', '
            ) AS cuotas_cubiertas
     FROM pagos pa
     LEFT JOIN pago_detalle d ON d.pago_id = pa.id AND d.tipo = 'cuota'
     LEFT JOIN cuotas c ON c.id = d.referencia_id
     WHERE pa.persona_id = ? AND pa.fecha >= ?
     GROUP BY pa.id, pa.fecha, pa.monto_total, pa.metodo, pa.tipo_pago, pa.detalle, pa.comprobante_path
     ORDER BY pa.fecha DESC`,
    [personaId, `${desde} 00:00:00`],
    callback
  );
};
