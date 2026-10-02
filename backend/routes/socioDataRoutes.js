// Datos propios del Portal del Socio: ficha, finanzas, asistencia y puntaje (solo
// lectura), "Actualizar datos" (lo único que el socio puede editar) y las cartas
// de la pestaña "Documentos" (justificación, postulación a bloques). Montado
// bajo /socio-auth en server.js (no /socio: esa ruta la sirve el frontend
// estático de frontend/socio/, ver comentario ahí).
// Todas exigen token de socio (tipo:'socio'); nunca aceptan el token admin ni
// un persona_id por parámetro.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/socioDataController');
const perfilController = require('../controllers/socioPerfilController');
const documentosController = require('../controllers/socioDocumentosController');
const uploadJustificativo = require('../middleware/uploadJustificativo');
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

// Pestaña "Documentos": cartas de justificación y postulación a bloques,
// comprobantes de depósito para tesorería (se guardan y se envían por correo) +
// Estatutos en PDF.
router.get('/documentos', exigirPerfilSocio(), documentosController.datosFormularios);
router.post(
  '/documentos/justificaciones',
  exigirPerfilSocio(),
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
  documentosController.enviarJustificacion
);
router.post('/documentos/postulaciones', exigirPerfilSocio(), documentosController.enviarPostulacion);
router.post(
  '/documentos/comprobantes',
  exigirPerfilSocio(),
  (req, res, next) => {
    uploadJustificativo.comprobantesDeposito.single('comprobante')(req, res, (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera los 5 MB'
          : (err.message || 'No se pudo subir el archivo');
        return res.status(400).json({ mensaje });
      }
      next();
    });
  },
  documentosController.enviarComprobante
);
router.get('/documentos/estatutos', exigirPerfilSocio(), documentosController.descargarEstatutos);

module.exports = router;
