// =====================================
// ROUTES ASISTENCIAS API
// =====================================

const express = require('express');

// Router Express módulo asistencias
const router = express.Router();

// Controlador lógica asistencias
const controller =
  require('../controllers/asistenciaController');

  // Middleware autenticación JWT
const authMiddleware =
  require('../middleware/authMiddleware');

  // Middleware autorización roles
const roleMiddleware =
  require('../middleware/roleMiddleware');

// =====================================
// LISTAR ASISTENCIAS
// =====================================

router.get(
  '/',

  // Ruta protegida JWT
  authMiddleware,

  // Solo admin y entrenador
  // pueden visualizar asistencias
  roleMiddleware('admin', 'entrenador'),
  controller.listar
);

// =====================================
// REGISTRAR ASISTENCIA
// =====================================
router.post(
  '/',
  authMiddleware,

  // Solo admin y entrenador
  // pueden registrar asistencias
  roleMiddleware('admin', 'entrenador'),
  
  // Registra asistencia evento
  controller.registrar
);

// Exporta rutas módulo asistencias
module.exports = router;