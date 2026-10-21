// Rutas /api/pagos: operaciones de pagos y sus permisos de acceso.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/pagoController');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const uploadComprobante = require('../middleware/uploadComprobante');
const fs = require('fs');

// Comprobante opcional (imagen o PDF) en el campo 'comprobante'. Verifica la firma
// binaria del archivo y, si la petición termina en error (validación, cuota ya
// pagada...), borra el archivo para no dejar huérfanos en uploads/comprobantes.
function recibirComprobante(req, res, next) {
  uploadComprobante.single('comprobante')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ mensaje: err.message || 'No se pudo subir el comprobante' });
    }
    // La ruta del archivo la fija solo el servidor: nunca se acepta desde el cliente
    // (podría apuntar a cualquier archivo del servidor al descargarlo).
    delete req.body.comprobante_path;
    if (!req.file) return next();

    res.on('finish', () => {
      if (res.statusCode >= 400) fs.unlink(req.file.path, () => {});
    });

    let firmaValida = false;
    try {
      firmaValida = await uploadComprobante.verificarFirmaArchivo(req.file.path, req.file.mimetype);
    } catch (e) {
      firmaValida = false;
    }
    if (!firmaValida) {
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }
    req.body.comprobante_path = `comprobantes/${req.file.filename}`;
    next();
  });
}

router.get(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.obtener
);

router.get(
  '/reporte-cuotas',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.obtenerReporteCuotas
);

router.post(
  '/',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  recibirComprobante,
  controller.crear
);

router.post(
  '/anual',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  recibirComprobante,
  controller.crearAnual
);

// Comprobantes que los socios envían desde el Portal (pendientes de registrar o ya usados)
router.get(
  '/depositos',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listarDepositos
);

router.get(
  '/depositos/persona/:personaId',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.listarDepositosPendientesPersona
);

router.get(
  '/depositos/:id/archivo',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.descargarDeposito
);

router.get(
  '/:id/comprobante',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  controller.descargarComprobante
);

// Adjuntar o reemplazar el comprobante de cualquier pago, incluidos los vinculados
// a cuotas (que no se pueden editar por PUT).
router.post(
  '/:id/comprobante',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  recibirComprobante,
  controller.adjuntarComprobante
);

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('admin', 'tesorero'),
  recibirComprobante,
  controller.actualizar
);

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('admin'),
  controller.eliminar
);

module.exports = router;
