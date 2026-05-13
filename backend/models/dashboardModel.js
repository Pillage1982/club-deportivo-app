const db = require('../config/db');

exports.obtenerResumen = (callback) => {

  const query = `
    SELECT

      (SELECT COUNT(*) FROM personas)
      AS total_personas,

      (SELECT COUNT(*) FROM eventos)
      AS total_eventos,

      (SELECT COUNT(*) FROM multas)
      AS total_multas,

      (
        SELECT IFNULL(SUM(monto),0)
        FROM multas
      ) AS deuda_total
  `;

  db.query(query, callback);

};