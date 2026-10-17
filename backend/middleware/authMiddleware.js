// Middleware de autenticación: valida el JWT y deja el usuario autenticado disponible en req.user.
// =====================================
// LIBRERIA JWT AUTENTICACION
// =====================================

const jwt = require('jsonwebtoken');
const usuarioModel = require('../models/usuarioModel');

// Versión de sesión por usuario (usuarios.sesion_version), en caché 60 s para no
// consultar la BD en cada petición. "Reiniciar acceso" la sube y borra la caché
// de ese usuario: sus tokens anteriores dejan de servir de inmediato.
const CACHE_SESION_MS = 60 * 1000;
const cacheSesion = new Map();

async function sesionVersionVigente(id) {
  const enCache = cacheSesion.get(id);
  if (enCache && Date.now() - enCache.t < CACHE_SESION_MS) return enCache.v;
  const v = await usuarioModel.obtenerSesionVersion(id);
  cacheSesion.set(id, { v, t: Date.now() });
  return v;
}

function olvidarSesion(id) {
  cacheSesion.delete(id);
}

// =====================================
// MIDDLEWARE AUTENTICACION JWT
// =====================================

// permitirCambioPendiente: solo las rutas del primer ingreso (cambio de clave y
// registro del email) aceptan un token con `cambiarPassword` o `registrarEmail`;
// el resto lo rechaza.
function crearMiddleware({ permitirCambioPendiente = false } = {}) {
  return async (req, res, next) => {

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

    // Sesión reiniciada o usuario eliminado: el token ya no vale. Tokens emitidos
    // antes de existir sesion_version no traen sv y cuentan como versión 0.
    let vigente;
    try {
      vigente = await sesionVersionVigente(decoded.id);
    } catch (errDb) {
      console.error('Error validando sesión del usuario:', errDb);
      // 503 y no 401: una caída de la BD no debe cerrar la sesión en el panel.
      return res.status(503).json({ mensaje: 'Servicio no disponible, intenta nuevamente' });
    }
    if (vigente === null || (Number(decoded.sv) || 0) !== vigente) {
      return res.status(401).json({
        mensaje: 'Token inválido'
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
module.exports.olvidarSesion = olvidarSesion;
