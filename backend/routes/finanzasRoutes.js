// Ruta /api/finanzas: expone el estado financiero consolidado a roles autorizados.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/finanzasController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listar
);

// Ficha de historial financiero de un integrante (cuotas, abonos y pagos)
router.get(
  '/historial/:persona_id',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.historialPersona
);

module.exports = router;
