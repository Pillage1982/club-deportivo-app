// Rutas /ingresos: CRUD, subida y descarga protegida de comprobantes.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/ingresoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const uploadIngreso = require('../middleware/uploadIngreso');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listar
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  (req, res, next) => {
    uploadIngreso.single('comprobante')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ mensaje: err.message || 'No se pudo subir el comprobante' });
      }
      next();
    });
  },
  controller.crear
);

router.get(
  '/:id/comprobante',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.descargarComprobante
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;
