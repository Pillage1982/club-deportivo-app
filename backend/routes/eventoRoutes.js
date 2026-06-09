const express = require('express');
const router = express.Router();
const controller = require('../controllers/eventoController');
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