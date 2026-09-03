// Acceso MySQL de ingresos: dinero que entra sin ser cuota de un socio
// (proyectos adjudicados, donaciones, premios). CRUD y ruta de comprobante,
// mismo patron que gastoModel.js.
const db = require('../config/db');

exports.obtenerIngresos = (callback) => {
  const query = `
    SELECT id, descripcion, categoria, entidad, monto, fecha, responsable, comprobante_path
    FROM ingresos
    ORDER BY fecha DESC, id DESC
  `;
  db.query(query, callback);
};

exports.obtenerIngresoPorId = (id, callback) => {
  db.query(
    'SELECT * FROM ingresos WHERE id = ?',
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

exports.crearIngreso = (data, callback) => {
  const query = `
    INSERT INTO ingresos
    (descripcion, categoria, entidad, monto, fecha, responsable, comprobante_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    query,
    [
      data.descripcion,
      data.categoria,
      data.entidad || null,
      data.monto,
      data.fecha,
      data.responsable || null,
      data.comprobante_path || null
    ],
    callback
  );
};

exports.eliminarIngreso = (id, callback) => {
  db.query('DELETE FROM ingresos WHERE id = ?', [id], callback);
};
