const db = require('../config/db');

exports.buscarUsuario = (usuario, callback) => {

  const query = `
    SELECT *
    FROM usuarios
    WHERE usuario = ?
  `;

  db.query(query, [usuario], callback);

};