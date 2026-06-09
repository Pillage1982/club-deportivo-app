const express = require('express');
const router = express.Router();
const controller = require('../controllers/cuotaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

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
  controller.generarCuotasMensuales
);

module.exports = router;