// Rutas /socio-auth: login del Portal del Socio, cambio de PIN, y herramientas
// admin de enrolamiento (generación individual/masiva y seguimiento de accesos).
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

// Admin: enrolamiento y seguimiento (token admin normal + rol)
router.post(
  '/admin/generar/:personaId',
  authMiddleware,
  roleMiddleware('admin'),
  controller.generarPinAdmin
);

router.post(
  '/admin/enrolamiento-masivo',
  authMiddleware,
  roleMiddleware('admin'),
  controller.enrolamientoMasivo
);

router.get(
  '/admin/estado',
  authMiddleware,
  roleMiddleware('admin'),
  controller.listarEstado
);

module.exports = router;
