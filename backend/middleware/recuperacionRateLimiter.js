// Limita las solicitudes de "¿Olvidaste tu contraseña?" por IP: cada una envía un
// correo, así que sin freno se podría usar para inundar la casilla de un socio o
// agotar la cuota diaria de envío de la cuenta de Gmail.
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.' }
});
