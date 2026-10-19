// Rutas /api/asistencias: asocian endpoints protegidos con asistenciaController y roles autorizados.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/asistenciaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.listar
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.registrar
);

// Marca o quita "vestimenta distinta" / "retiro sin aviso" (Art. 8.4) en una
// asistencia presente/atrasada. Body: { activo: true|false }.
router.patch(
  '/:id/vestimenta',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.marcarEstadoManual('vestimenta_distinta')
);

router.patch(
  '/:id/retiro',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.marcarEstadoManual('retiro_sin_aviso')
);

module.exports = router;
