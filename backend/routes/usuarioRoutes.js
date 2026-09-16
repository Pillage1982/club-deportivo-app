// Rutas /api/usuarios: contiene el inicio de sesión público; las demás rutas usan JWT.
const express = require('express');
const router = express.Router();

const controller = require('../controllers/usuarioController');
const loginRateLimiter = require('../middleware/loginRateLimiter');

router.post('/login', loginRateLimiter, controller.login);

module.exports = router;
