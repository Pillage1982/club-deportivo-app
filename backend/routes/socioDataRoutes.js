// Datos propios de solo lectura para el Portal del Socio (ficha, finanzas,
// asistencia, puntaje). Montado bajo /socio-auth en server.js (no /socio: esa
// ruta la sirve el frontend estático de frontend/socio/, ver comentario ahí).
// Todas exigen token de socio (tipo:'socio'); nunca aceptan el token admin ni
// un persona_id por parámetro.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/socioDataController');
const authSocioMiddleware = require('../middleware/authSocioMiddleware');

router.use(authSocioMiddleware);

router.get('/mi-ficha', controller.miFicha);
router.get('/mi-finanzas', controller.miFinanzas);
router.get('/mi-asistencia', controller.miAsistencia);
router.get('/mi-puntaje', controller.miPuntaje);

module.exports = router;
