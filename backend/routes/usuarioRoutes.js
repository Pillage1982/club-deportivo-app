// Rutas /api/usuarios: contiene el inicio de sesión público; las demás rutas usan JWT.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuarioController');
const authMiddleware = require('../middleware/authMiddleware');
const loginRateLimiter = require('../middleware/loginRateLimiter');

router.post('/login', loginRateLimiter, controller.login);

// Acepta el token con cambio de clave pendiente (única ruta que lo hace).
router.post(
  '/cambiar-password',
  loginRateLimiter,
  authMiddleware.permitirCambioPendiente,
  controller.cambiarPassword
);

module.exports = router;
