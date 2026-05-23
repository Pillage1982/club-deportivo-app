// =====================================
// ROUTES PERSONAS API
// =====================================

const express =
  require('express');

  // Router Express módulo personas
const router =
  express.Router();

  // Controlador lógica personas
const controller =
  require('../controllers/personaController');

  // Middleware autenticación JWT
const authMiddleware =
  require('../middleware/authMiddleware');

  // Middleware autorización roles
const roleMiddleware =
  require('../middleware/roleMiddleware');

// =====================================
// LISTAR PERSONAS
// =====================================

router.get(

  '/',

  // Ruta protegida JWT
  authMiddleware,

  // Devuelve listado socios
  controller.listar

);

// =====================================
// REGISTRAR PERSONA
// =====================================

router.post(

  '/',

  authMiddleware,

  // Solo administrador
  // puede registrar socios
  roleMiddleware(
    'admin'
  ),

  controller.crear

);

// =====================================
// ACTUALIZAR PERSONA
// =====================================

router.put(

  '/:id',

  authMiddleware,

  // Solo administrador
  // puede actualizar socios
  roleMiddleware(
    'admin'
  ),

  controller.actualizar

);

// =====================================
// ELIMINAR PERSONA
// =====================================

router.delete(

  '/:id',

  authMiddleware,

  // Solo administrador
  // puede eliminar socios
  roleMiddleware(
    'admin'
  ),

  controller.eliminar

);

// Exporta rutas módulo personas
module.exports = router;