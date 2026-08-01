// Acceso MySQL de gastos: CRUD y rutas almacenadas de comprobantes.
const db = require('../config/db');

exports.obtenerGastos = (callback) => {
  const query = `
    SELECT id, descripcion, categoria, monto, fecha, responsable, comprobante_path
    FROM gastos
    ORDER BY fecha DESC, id DESC
  `;
  db.query(query, callback);
};

exports.obtenerGastoPorId = (id, callback) => {
  db.query(
    'SELECT * FROM gastos WHERE id = ?',
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

exports.crearGasto = (data, callback) => {
  const query = `
    INSERT INTO gastos
    (descripcion, categoria, monto, fecha, responsable, comprobante_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  db.query(
    query,
    [
      data.descripcion,
      data.categoria,
      data.monto,
      data.fecha,
      data.responsable || null,
      data.comprobante_path || null
    ],
    callback
  );
};

exports.eliminarGasto = (id, callback) => {
  db.query('DELETE FROM gastos WHERE id = ?', [id], callback);
};
