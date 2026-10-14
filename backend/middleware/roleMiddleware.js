// Middleware de autorización: permite continuar solo a los roles indicados por cada ruta.
// Las rutas nombran los roles base (admin, tesorero, entrenador); los demás roles
// (secretaria, director1-3) heredan los permisos de su base según config/roles.js.
// Además, un rol sin permiso de eliminar no puede hacer ninguna petición DELETE.
const { rolBase, puedeEliminar } = require('../config/roles');

module.exports = (...rolesPermitidos) => (req, res, next) => {
  const rolUsuario = req.usuario && req.usuario.rol;

  if (!rolesPermitidos.includes(rolBase(rolUsuario))) {
    return res.status(403).send('No tienes permisos');
  }

  if (req.method === 'DELETE' && !puedeEliminar(rolUsuario)) {
    return res.status(403).json({ mensaje: 'Tu rol no permite eliminar registros' });
  }

  next();
};
