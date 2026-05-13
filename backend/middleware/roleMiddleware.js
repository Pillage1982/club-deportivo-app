module.exports = (...rolesPermitidos) => {

  return (req, res, next) => {

    const rolUsuario = req.usuario.rol;

    if (!rolesPermitidos.includes(rolUsuario)) {

      return res.status(403).send(
        'No tienes permisos'
      );

    }

    next();

  };

};