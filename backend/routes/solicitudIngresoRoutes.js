// Rutas /solicitudes-ingreso: revisión en el panel admin de las solicitudes
// "Súmate a la promesa" del sitio. Solo admin, igual que crear integrantes.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/solicitudIngresoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');

router.use(authMiddleware, roleMiddleware('admin'));

router.get('/', controller.listar);
router.post('/:id/aprobar', controller.aprobar);
router.post('/:id/rechazar', controller.rechazar);

module.exports = router;
