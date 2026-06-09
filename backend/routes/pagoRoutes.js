const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listar
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.crear
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.actualizar
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;