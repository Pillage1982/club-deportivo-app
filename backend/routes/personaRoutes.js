// Rutas /api/personas: CRUD de integrantes y controles de rol.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/personaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.listar
);

// Histórico de integrantes retirados (eliminados lógicamente)
router.get(
  '/retirados',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.listarRetirados
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin'),
  controller.crear
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.actualizar
);

// Reintegro de un retirado (Tablas → Retirados)
router.patch(
  '/:id/reintegrar',
  authMiddleware,
  roleMiddleware('admin'),
  controller.reintegrar
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;
