// Middleware de autenticación: valida el JWT y deja el usuario autenticado disponible en req.user.
// =====================================
// LIBRERIA JWT AUTENTICACION
// =====================================

const jwt = require('jsonwebtoken');

// =====================================
// MIDDLEWARE AUTENTICACION JWT
// =====================================

// permitirCambioPendiente: solo las rutas del primer ingreso (cambio de clave y
// registro del email) aceptan un token con `cambiarPassword` o `registrarEmail`;
// el resto lo rechaza.
function crearMiddleware({ permitirCambioPendiente = false } = {}) {
  return (req, res, next) => {

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

    // Defensa en profundidad: un token de socio (tipo:'socio', ver
    // authSocioMiddleware) nunca debe pasar por rutas admin, aunque ambos
    // compartan JWT_SECRET y aunque las rutas ya estén separadas por diseño.
    if (decoded.tipo === 'socio') {
      return res.status(401).json({
        mensaje: 'Token inválido'
      });
    }

    // Cambio de clave obligatorio pendiente: no se usa el panel hasta cambiarla.
    if (decoded.cambiarPassword && !permitirCambioPendiente) {
      return res.status(403).json({
        mensaje: 'Debes cambiar tu clave antes de continuar',
        codigo: 'CAMBIO_PASSWORD_REQUERIDO'
      });
    }

    // Email pendiente (primer ingreso): se registra antes de usar el panel.
    if (decoded.registrarEmail && !permitirCambioPendiente) {
      return res.status(403).json({
        mensaje: 'Debes registrar tu email antes de continuar',
        codigo: 'EMAIL_REQUERIDO'
      });
    }

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
}

module.exports = crearMiddleware();
module.exports.permitirCambioPendiente = crearMiddleware({ permitirCambioPendiente: true });
