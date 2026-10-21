// Ruta /api/dashboard: entrega el resumen permitido a los roles de la aplicación.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.resumen
);

router.put(
  '/saldo-anio-anterior',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.guardarSaldoAnioAnterior
);

module.exports = router;
