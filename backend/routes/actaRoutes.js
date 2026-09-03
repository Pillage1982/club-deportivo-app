// Rutas /actas: lectura para todos los roles, alta/baja solo admin.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/actaController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const uploadActa = require('../middleware/uploadActa');

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.listar
);

router.get(
  '/eventos-disponibles',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eventosDisponibles
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin'),
  (req, res, next) => {
    uploadActa.single('archivo')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ mensaje: err.message || 'No se pudo subir el adjunto' });
      }
      next();
    });
  },
  controller.crear
);

router.get(
  '/:id/adjunto',
  authMiddleware,
  roleMiddleware('admin', 'tesorero', 'entrenador'),
  controller.descargarAdjunto
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;
