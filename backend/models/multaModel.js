const db = require('../config/db');

exports.obtenerMultas = (callback) => {

  const query = `
    SELECT
      m.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      m.monto,
      m.motivo,
      m.fecha
    FROM multas m
    JOIN personas p ON m.persona_id = p.id
    ORDER BY m.fecha DESC
  `;

  db.query(query, callback);

};