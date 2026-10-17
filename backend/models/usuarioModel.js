// Acceso MySQL de usuarios: busca credenciales para el proceso de autenticación.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

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

// Versión de sesión vigente (authMiddleware la compara con el claim sv del token).
exports.obtenerSesionVersion = id =>
  ejecutar('SELECT sesion_version FROM usuarios WHERE id = ?', [id])
    .then(rows => (rows[0] ? Number(rows[0].sesion_version) || 0 : null));

exports.listarUsuarios = () =>
  ejecutar(`
    SELECT id, usuario, rol, email, debe_cambiar_password
    FROM usuarios
    ORDER BY usuario
  `);

// Reiniciar acceso: clave temporal (cambio obligatorio al entrar), sin email (el
// anterior podría ser de quien no corresponde), sesiones abiertas invalidadas y
// enlaces de recuperación pendientes anulados.
exports.reiniciarAcceso = async (id, passwordHash) => {
  const r = await ejecutar(`
    UPDATE usuarios
    SET password = ?, debe_cambiar_password = 1, email = NULL,
        sesion_version = sesion_version + 1
    WHERE id = ?
  `, [passwordHash, id]);
  if (!r.affectedRows) return false;
  await ejecutar(`
    UPDATE recuperaciones_clave SET usado_en = NOW()
    WHERE tipo = 'usuario' AND referencia_id = ? AND usado_en IS NULL
  `, [id]);
  return true;
};

// Primer ingreso: el directivo registra su email (para recuperar la contraseña).
exports.actualizarEmail = (id, email, callback) => {
  db.query('UPDATE usuarios SET email = ? WHERE id = ?', [email, id], callback);
};
