// Tareas programadas (cron externo). Protegidas por token dentro del controlador,
// no por authMiddleware: las invoca una máquina, no un usuario con sesión.
const express = require('express');
const router = express.Router();
const tareasController = require('../controllers/tareasController');

router.get('/cumpleanos', tareasController.enviarCumpleanos);

module.exports = router;
