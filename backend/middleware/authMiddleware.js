// =====================================
// LIBRERIA JWT AUTENTICACION
// =====================================

const jwt = require('jsonwebtoken');

// =====================================
// MIDDLEWARE AUTENTICACION JWT
// =====================================

module.exports = (req, res, next) => {

  // Obtiene header Authorization
  const authHeader = req.headers.authorization;

  // Bloquea acceso sin token
 if (!authHeader) {
   return res.status(401).json({
    mensaje: 'Token requerido'
    });

  }

  // Extrae token JWT desde Bearer
  const token = authHeader.split(' ')[1];

  try {

    // Verifica validez token JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // Guarda usuario autenticado
    // para siguientes middlewares
    req.usuario = decoded;

    // Continúa ejecución ruta protegida
    next();

  } catch (err) {

  return res.status(401).json({
    mensaje: 'Token inválido'
  });

}

};