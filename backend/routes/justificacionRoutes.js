// Rutas /justificaciones: revisión en el panel admin de las cartas del Portal del
// Socio (justificaciones y postulaciones a bloques). Mismos roles que asistencia,
// porque aprobar una justificación modifica la asistencia y el puntaje.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/justificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const uploadJustificativo = require('../middleware/uploadJustificativo');

router.use(authMiddleware, roleMiddleware('admin', 'entrenador'));

router.get('/', controller.listar);
// Ingreso manual de cartas que llegan fuera del Portal (quedan aprobadas).
router.get('/manual/opciones', controller.opcionesManual);
router.post(
  '/manual',
  (req, res, next) => {
    uploadJustificativo.single('adjunto')(req, res, (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera los 5 MB'
          : (err.message || 'No se pudo subir el archivo');
        return res.status(400).json({ mensaje });
      }
      next();
    });
  },
  controller.registrarManual
);
router.get('/postulaciones', controller.listarPostulaciones);
router.post('/postulaciones/:id/aceptar', controller.aceptarPostulacion);
router.post('/postulaciones/:id/rechazar', controller.rechazarPostulacion);
router.get('/:id/adjunto', controller.descargarAdjunto);
router.post('/:id/aprobar', controller.aprobar);
router.post('/:id/rechazar', controller.rechazar);

module.exports = router;
