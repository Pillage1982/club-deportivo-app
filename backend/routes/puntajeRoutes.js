// Rutas /api/puntaje: ranking y detalle del sistema de puntos GDC.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/puntajeController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'entrenador'),
  controller.listarRanking
);

router.get(
  '/historial/:persona_id',
  authMiddleware,
  roleMiddleware('admin', 'entrenador'),
  controller.listarHistorial
);

module.exports = router;
