// Comprobantes de depósito que los socios envían desde el Portal (uploads/comprobantes_deposito).
// Mismas reglas que los comprobantes de pagos y gastos (tipos, 5MB, extensión según
// mimetype, firma binaria): se reutilizan de uploadComprobante para no mantener
// dos listas que puedan desalinearse.
const path = require('path');
const fs = require('fs');
const { DIRECTORIO_UPLOADS } = require('../config/uploads');
const uploadComprobante = require('./uploadComprobante');

let multer = null;

try {
  multer = require('multer');
} catch (e) {
  console.warn('[Portal del Socio] multer no disponible. Ejecute npm install en el servidor.');
}

const { extensionPorMime, verificarFirmaArchivo } = uploadComprobante;
const destino = path.join(DIRECTORIO_UPLOADS, 'comprobantes_deposito');

let uploadDeposito;

if (multer) {
  fs.mkdirSync(destino, { recursive: true });

  uploadDeposito = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destino),
      filename: (req, file, cb) => {
        const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${sufijo}${extensionPorMime[file.mimetype] || ''}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      if (!extensionPorMime[file.mimetype]) {
        return cb(new Error('Formato no permitido. Solo imágenes (jpg, png, webp) o PDF.'));
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });
} else {
  uploadDeposito = {
    single: () => (req, res, next) => {
      next(new Error('Subida de archivos no disponible: falta ejecutar npm install en el servidor.'));
    }
  };
}

uploadDeposito.verificarFirmaArchivo = verificarFirmaArchivo;

module.exports = uploadDeposito;
