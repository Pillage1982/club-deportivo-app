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

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;