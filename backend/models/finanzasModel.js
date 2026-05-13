const db = require('../config/db');

exports.obtenerEstadoFinanciero = (callback) => {

  const query = `
    SELECT *
    FROM vista_estado_financiero
  `;

  db.query(query, callback);

};