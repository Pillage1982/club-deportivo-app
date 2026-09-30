// Acceso MySQL de usuarios: busca credenciales para el proceso de autenticación.
const db = require('../config/db');

exports.buscarUsuario = (usuario, callback) => {

  const query = `
    SELECT *
    FROM usuarios
    WHERE usuario = ?
  `;

  db.query(query, [usuario], callback);

};

exports.buscarPorId = (id, callback) => {
  db.query('SELECT * FROM usuarios WHERE id = ?', [id], callback);
};

// El propio usuario cambiando su clave: deja cumplido el cambio obligatorio.
exports.actualizarPasswordPropia = (id, passwordHash, callback) => {
  db.query(
    'UPDATE usuarios SET password = ?, debe_cambiar_password = 0 WHERE id = ?',
    [passwordHash, id],
    callback
  );
};

// Primer ingreso: el directivo registra su email (para recuperar la contraseña).
exports.actualizarEmail = (id, email, callback) => {
  db.query('UPDATE usuarios SET email = ? WHERE id = ?', [email, id], callback);
};
