const express =
  require('express');

const router =
  express.Router();

const controller =
  require('../controllers/eventoController');

const authMiddleware =
  require('../middleware/authMiddleware');

const roleMiddleware =
  require('../middleware/roleMiddleware');

// =========================
// OBTENER EVENTOS
// =========================

router.get(

  '/',

  authMiddleware,

  controller.listar

);

// =========================
// CREAR EVENTO
// =========================

router.post(

  '/',

  authMiddleware,

  roleMiddleware(
    'admin'
  ),

  controller.crear

);

// =========================
// ACTUALIZAR EVENTO
// =========================

router.put(

  '/:id',

  authMiddleware,

  roleMiddleware(
    'admin'
  ),

  controller.actualizar

);

// =========================
// ELIMINAR EVENTO
// =========================

router.delete(

  '/:id',

  authMiddleware,

  roleMiddleware(
    'admin'
  ),

  controller.eliminar

);

module.exports = router;