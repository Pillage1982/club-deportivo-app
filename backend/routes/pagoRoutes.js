// =====================================
// ROUTES PAGOS API
// =====================================

const express =
  require('express');

  // Router Express módulo pagos
const router =
  express.Router();

  // Controlador lógica pagos
const controller =
  require('../controllers/pagoController');

  // Middleware autenticación JWT
const authMiddleware =
  require('../middleware/authMiddleware');

  // Middleware autorización roles
const roleMiddleware =
  require('../middleware/roleMiddleware');

// =====================================
// LISTAR PAGOS
// =====================================

router.get(
  '/',

  // Ruta protegida JWT
  authMiddleware,
  roleMiddleware(
    'admin',
    'tesorero'
  ),
  controller.obtener
);

// =====================================
// REGISTRAR PAGO
// =====================================

router.post(

  '/',

  authMiddleware,

  // Solo admin y tesorero
  // pueden registrar pagos
  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.crear

);

// =====================================
// ACTUALIZAR PAGO
// =====================================

router.put(

  '/:id',

  authMiddleware,

  // Solo admin y tesorero
  // pueden actualizar pagos
  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.actualizar

);

// =====================================
// ELIMINAR PAGO
// =====================================

router.delete(

  '/:id',

  authMiddleware,

  // Solo admin y tesorero
  // pueden eliminar pagos
  roleMiddleware(
    'admin',
    'tesorero'
  ),

  controller.eliminar

);

// Exporta rutas módulo pagos
module.exports = router;