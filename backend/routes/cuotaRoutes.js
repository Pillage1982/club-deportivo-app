// Rutas /api/cuotas: consulta, generación y administración de cuotas con permisos financieros.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/cuotaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/pendientes/:persona_id',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listarPendientesPorPersona
);

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listar
);

router.post(
  '/generar-mes',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.generarMensualidad
);

router.post(
  '/generar-temporada',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.generarTemporadaCompleta
);

module.exports = router;
