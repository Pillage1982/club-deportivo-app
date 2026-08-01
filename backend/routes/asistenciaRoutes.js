// Rutas /api/asistencias: asocian endpoints protegidos con asistenciaController y roles autorizados.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/asistenciaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'entrenador'),
  controller.listar
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'entrenador'),
  controller.registrar
);

module.exports = router;
