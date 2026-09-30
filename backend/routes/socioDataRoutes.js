// Datos propios del Portal del Socio: ficha, finanzas, asistencia y puntaje (solo
// lectura) y "Actualizar datos" (lo único que el socio puede editar). Montado
// bajo /socio-auth en server.js (no /socio: esa ruta la sirve el frontend
// estático de frontend/socio/, ver comentario ahí).
// Todas exigen token de socio (tipo:'socio'); nunca aceptan el token admin ni
// un persona_id por parámetro.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/socioDataController');
const perfilController = require('../controllers/socioPerfilController');
const authSocioMiddleware = require('../middleware/authSocioMiddleware');
const exigirPerfilSocio = require('../middleware/perfilSocioMiddleware');

router.use(authSocioMiddleware);

// "Actualizar datos": exige PIN propio, pero no datos al día (es donde se completan).
router.get('/mis-datos', exigirPerfilSocio({ datos: false }), perfilController.obtenerMisDatos);
router.put('/mis-datos', exigirPerfilSocio({ datos: false }), perfilController.actualizarMisDatos);

// Página personal: solo con PIN propio y datos actualizados (primer ingreso completo).
router.get('/mi-ficha', exigirPerfilSocio(), controller.miFicha);
router.get('/mi-finanzas', exigirPerfilSocio(), controller.miFinanzas);
router.get('/mi-asistencia', exigirPerfilSocio(), controller.miAsistencia);
router.get('/mi-puntaje', exigirPerfilSocio(), controller.miPuntaje);

module.exports = router;
