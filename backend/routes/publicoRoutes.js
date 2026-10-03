// Rutas /publico: datos de solo lectura y sin sesión para el sitio gdcayquina.cl.
// Tienen su propio CORS abierto porque el CORS global puede estar restringido a
// FRONTEND_URL (la app), y el sitio público vive en otro dominio.
const express = require('express');
const cors = require('cors');
const router = express.Router();
const eventoController = require('../controllers/eventoController');

router.use(cors({ origin: '*', methods: ['GET'] }));

router.get('/actividades', eventoController.listarProximosPublicos);

module.exports = router;
