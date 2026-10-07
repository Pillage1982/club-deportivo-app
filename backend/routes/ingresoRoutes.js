// Rutas /ingresos: ingresos de terceros (donaciones, premios, proyectos adjudicados) con comprobante.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/ingresoController');
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
    uploadComprobante.fields([
      { name: 'comprobante', maxCount: 1 },
      { name: 'documento', maxCount: 1 }
    ])(req, res, (err) => {
      if (err) {
        return res.status(400).json({ mensaje: err.message || 'No se pudo subir el archivo' });
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

router.get(
  '/:id/documento',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.descargarDocumento
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;
