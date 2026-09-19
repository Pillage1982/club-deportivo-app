// Limita intentos de login por IP (admin y socio) para dificultar fuerza bruta.
// Antes no existía ningún límite: un PIN/contraseña sin freno de intentos es
// atacable en minutos con un script simple.
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiados intentos de inicio de sesión. Intenta nuevamente en unos minutos.' }
});
