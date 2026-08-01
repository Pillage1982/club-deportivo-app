// Rutas /api/gastos: CRUD, subida y descarga protegida de comprobantes.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/gastoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const uploadComprobante = require('../middleware/uploadComprobante');

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
    uploadComprobante.single('comprobante')(req, res, (err) => {
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
