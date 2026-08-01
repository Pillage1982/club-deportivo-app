// Rutas /api/usuarios: contiene el inicio de sesión público; las demás rutas usan JWT.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuarioController');

router.post('/login', controller.login);

module.exports = router;
