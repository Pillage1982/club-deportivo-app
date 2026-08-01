// Acceso MySQL financiero: lee la vista consolidada vista_estado_financiero.
const db = require('../config/db');

exports.obtenerEstadoFinanciero = (callback) => {

  const query = `
    SELECT *
    FROM vista_estado_financiero
  `;

  db.query(query, callback);

};
