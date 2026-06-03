const express =
  require('express');

const router =
  express.Router();

const controller =
  require('../controllers/cuotaController');

const authMiddleware =
  require('../middleware/authMiddleware');

const roleMiddleware =
  require('../middleware/roleMiddleware');

// =====================================
// LISTAR CUOTAS
// =====================================

router.get(
  '/',
  authMiddleware,
  roleMiddleware(
    'admin',
    'tesorero'
  ),
  controller.listar
);

// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

router.post(
  '/generar',
  authMiddleware,
  roleMiddleware(
    'admin',
    'tesorero'
  ),
  controller.generarMensualidad
);

module.exports = router;