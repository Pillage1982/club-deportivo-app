// Rutas /socio-auth: login del Portal del Socio (RUT + clave), cambio de PIN, y
// herramientas admin (restablecer acceso, re-solicitar actualización de datos y
// seguimiento de accesos).
const express = require('express');
const router = express.Router();

const controller = require('../controllers/socioAuthController');
const authSocioMiddleware = require('../middleware/authSocioMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const loginRateLimiter = require('../middleware/loginRateLimiter');

// Público (rate-limited: sin esto un PIN de 6 dígitos es fuerza-bruteable)
router.post('/login', loginRateLimiter, controller.login);

// Socio autenticado con su propio token (tipo:'socio')
router.post('/cambiar-pin', authSocioMiddleware, controller.cambiarPin);

// Admin: restablecer acceso y seguimiento (token admin normal + rol)
router.post(
  '/admin/restablecer/:personaId',
  authMiddleware,
  roleMiddleware('admin'),
  controller.restablecerAccesoAdmin
);

router.post(
  '/admin/solicitar-actualizacion',
  authMiddleware,
  roleMiddleware('admin'),
  controller.solicitarActualizacionAdmin
);

router.post(
  '/admin/solicitar-actualizacion/:personaId',
  authMiddleware,
  roleMiddleware('admin'),
  controller.solicitarActualizacionAdmin
);

router.get(
  '/admin/estado',
  authMiddleware,
  roleMiddleware('admin'),
  controller.listarEstado
);

module.exports = router;
