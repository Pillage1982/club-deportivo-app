const express =
  require('express');

const router =
  express.Router();

const controller =
  require('../controllers/personaController');

const authMiddleware =
  require('../middleware/authMiddleware');

const roleMiddleware =
  require('../middleware/roleMiddleware');

// =========================
// OBTENER PERSONAS
// =========================

router.get(

  '/',

  authMiddleware,

  controller.listar

);

// =========================
// CREAR PERSONA
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
// ACTUALIZAR PERSONA
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
// ELIMINAR PERSONA
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