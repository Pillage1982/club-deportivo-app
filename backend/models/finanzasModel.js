// Acceso MySQL financiero: lee la vista consolidada vista_estado_financiero.
const db = require('../config/db');

exports.obtenerEstadoFinanciero = (callback) => {

  const query = `
    SELECT *
    FROM vista_estado_financiero
  `;

  db.query(query, callback);

};

// Datos del integrante para la ficha de historial financiero (incluye inactivos y
// en receso: la ficha sirve también para revisar a quien ya no participa).
exports.obtenerDatosPersona = (personaId, callback) => {
  db.query(
    `SELECT id, rut, nombres, apellido_paterno, apellido_materno, bloque,
            COALESCE(estado, 'activo') AS estado, es_honorario
     FROM personas WHERE id = ? LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};
