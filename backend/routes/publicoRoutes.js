// Rutas /publico: sin sesión, para el sitio gdcayquina.cl.
// Tienen su propio CORS abierto porque el CORS global puede estar restringido a
// FRONTEND_URL (la app), y el sitio público vive en otro dominio. Van montadas
// antes de express.json() global, por eso el router lee el JSON por su cuenta.
const express = require('express');
const cors = require('cors');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const solicitudIngresoController = require('../controllers/solicitudIngresoController');
const solicitudIngresoRateLimiter = require('../middleware/solicitudIngresoRateLimiter');

router.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
router.use(express.json({ limit: '20kb' }));

// Solo lectura: nombre, tipo, fecha y lugar de las próximas actividades.
router.get('/actividades', eventoController.listarProximosPublicos);

// Formulario "Súmate a la promesa".
router.post('/solicitud-ingreso', solicitudIngresoRateLimiter, solicitudIngresoController.crearPublica);

module.exports = router;
