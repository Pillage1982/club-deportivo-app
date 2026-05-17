const express =
  require('express');

const router =
  express.Router();

const controller =
  require('../controllers/pagoController');

const authMiddleware =
  require('../middleware/authMiddleware');

const roleMiddleware =
  require('../middleware/roleMiddleware');

// =========================
// OBTENER PAGOS
// =========================

router.get(

  '/',

  authMiddleware,

  controller.obtener

);

// =========================
// CREAR PAGO
// =========================

router.post(

  '/',

  authMiddleware,

  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.crear

);

// =========================
// ACTUALIZAR PAGO
// =========================

router.put(

  '/:id',

  authMiddleware,

  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.actualizar

);

// =========================
// ELIMINAR PAGO
// =========================

router.delete(

  '/:id',

  authMiddleware,

  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.eliminar

);

module.exports = router;