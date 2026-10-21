// Rutas /cartas-permiso: revisión en el panel de las cartas de permiso para el
// colegio pedidas desde el Portal. Solo los roles admin y secretaria (exactos) y
// la cuenta de soporte: la carta sale firmada por el presidente.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/cartaPermisoController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(controller.exigirHabilitada, authMiddleware, controller.soloQuienesAprueban);

router.get('/', controller.listar);
router.get('/:id/pdf', controller.descargarPdf);
router.post('/:id/aprobar', controller.aprobar);
router.post('/:id/rechazar', controller.rechazar);

module.exports = router;
