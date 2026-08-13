// Rutas /api/pagos: operaciones de pagos y sus permisos de acceso.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.obtener
);

router.get(
  '/reporte-cuotas',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.obtenerReporteCuotas
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.crear
);

router.post(
  '/anual',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.crearAnual
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
