// Rutas /api/usuarios: contiene el inicio de sesión público; las demás rutas usan JWT.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const loginRateLimiter = require('../middleware/loginRateLimiter');
const recuperacionRateLimiter = require('../middleware/recuperacionRateLimiter');
const recuperacion = require('../controllers/recuperacionClaveController');

router.post('/login', loginRateLimiter, controller.login);

// "¿Olvidaste tu contraseña?": público, envía un enlace de un solo uso por email.
router.post('/recuperar', recuperacionRateLimiter, recuperacion.solicitarUsuario);
router.post('/restablecer', loginRateLimiter, recuperacion.restablecerUsuario);

// Primer ingreso: únicas rutas que aceptan el token con pendientes
// (cambio de clave y/o registro del email).
router.post(
  '/cambiar-password',
  loginRateLimiter,
  authMiddleware.permitirCambioPendiente,
  controller.cambiarPassword
);

router.post(
  '/registrar-email',
  loginRateLimiter,
  authMiddleware.permitirCambioPendiente,
  controller.registrarEmail
);

// Soporte (cuenta Pillage): usuarios del panel y "Reiniciar acceso".
router.get('/soporte', authMiddleware, controller.soloSoporte, controller.listarUsuarios);
router.post('/soporte/:id/reiniciar', authMiddleware, controller.soloSoporte, controller.reiniciarAcceso);

module.exports = router;
