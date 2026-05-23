// =====================================
// MIDDLEWARE AUTORIZACION POR ROLES
// =====================================

// Recibe lista dinámica
// de roles autorizados
module.exports = (...rolesPermitidos) => {

  return (req, res, next) => {

    // Obtiene rol usuario autenticado
    const rolUsuario = req.usuario.rol;

    // Bloquea acceso si rol
    // no tiene permisos
    if (!rolesPermitidos.includes(rolUsuario)) {

      // Error permisos insuficientes
      return res.status(403).send(
        'No tienes permisos'
      );

    }

    // Continúa ejecución
    // si rol autorizado
    next();

  };

};