// Limita el formulario público "Súmate a la promesa" por IP: cada envío manda un
// correo a la directiva, así que sin freno se podría inundar sus casillas.
const rateLimit = require('express-rate-limit');

module.exports = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensaje: 'Demasiadas solicitudes desde esta conexión. Intenta nuevamente en una hora.' }
});
