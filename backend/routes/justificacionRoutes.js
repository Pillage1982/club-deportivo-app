// Rutas /justificaciones: revisión en el panel admin de las cartas del Portal del
// Socio (justificaciones y postulaciones a bloques). Mismos roles que asistencia,
// porque aprobar una justificación modifica la asistencia y el puntaje.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/justificacionController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('admin', 'entrenador'));

router.get('/', controller.listar);
router.get('/postulaciones', controller.listarPostulaciones);
router.get('/:id/adjunto', controller.descargarAdjunto);
router.post('/:id/aprobar', controller.aprobar);
router.post('/:id/rechazar', controller.rechazar);

module.exports = router;
