// Datos propios del Portal del Socio: ficha, finanzas y asistencia (solo lectura)
// y "Actualizar datos" (lo único que el socio puede editar). Montado bajo
// /socio-auth en server.js (no /socio: esa ruta la sirve el frontend estático de
// frontend/socio/, ver comentario ahí).
// Todas exigen token de socio (tipo:'socio'); nunca aceptan el token admin ni
// un persona_id por parámetro. Sin /mi-puntaje: esta rama no tiene módulo de
// puntaje (es específico de cliente/calamena).
const express = require('express');
const router = express.Router();

const controller = require('../controllers/socioDataController');
const perfilController = require('../controllers/socioPerfilController');
const depositosController = require('../controllers/socioDepositosController');
const uploadDeposito = require('../middleware/uploadDeposito');
const authSocioMiddleware = require('../middleware/authSocioMiddleware');
const exigirPerfilSocio = require('../middleware/perfilSocioMiddleware');

router.use(authSocioMiddleware);

// "Actualizar datos": exige contraseña propia, pero no datos al día (es donde se completan).
router.get('/mis-datos', exigirPerfilSocio({ datos: false }), perfilController.obtenerMisDatos);
router.put('/mis-datos', exigirPerfilSocio({ datos: false }), perfilController.actualizarMisDatos);

// Página personal: solo con contraseña propia y datos actualizados (primer ingreso completo).
router.get('/mi-ficha', exigirPerfilSocio(), controller.miFicha);
router.get('/mi-finanzas', exigirPerfilSocio(), controller.miFinanzas);
router.get('/mi-asistencia', exigirPerfilSocio(), controller.miAsistencia);

// Depósitos: datos de la cuenta y envío del comprobante a tesorería (multipart).
router.get('/depositos', exigirPerfilSocio(), depositosController.obtener);
router.post(
  '/depositos',
  exigirPerfilSocio(),
  (req, res, next) => {
    uploadDeposito.single('comprobante')(req, res, (err) => {
      if (err) {
        const mensaje = err.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo supera los 5 MB'
          : (err.message || 'No se pudo subir el archivo');
        return res.status(400).json({ mensaje });
      }
      next();
    });
  },
  depositosController.enviar
);

module.exports = router;
