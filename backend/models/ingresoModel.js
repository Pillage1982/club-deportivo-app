// Acceso MySQL de ingresos de terceros (donaciones, premios, proyectos adjudicados):
// dinero que entra al club sin venir de la cuota o multa de un integrante.
const db = require('../config/db');

exports.obtenerIngresos = (callback) => {
  const query = `
    SELECT id, descripcion, categoria, origen, monto, fecha, responsable, comprobante_path, documento_path
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
    (descripcion, categoria, origen, monto, fecha, responsable, comprobante_path, documento_path, registrado_por)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  db.query(
    query,
    [
      data.descripcion,
      data.categoria,
      data.origen,
      data.monto,
      data.fecha,
      data.responsable || null,
      data.comprobante_path || null,
      data.documento_path || null,
      data.registrado_por || null
    ],
    callback
  );
};

exports.eliminarIngreso = (id, callback) => {
  db.query('DELETE FROM ingresos WHERE id = ?', [id], callback);
};
