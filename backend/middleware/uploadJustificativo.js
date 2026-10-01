// Adjunto opcional de las cartas de justificación (licencia médica, certificado...)
// enviadas desde el Portal del Socio. Mismas reglas que los comprobantes de gastos
// (tipos, 5MB, extensión según mimetype, firma binaria): se reutilizan de
// uploadComprobante para no mantener dos listas que puedan desalinearse.
const path = require('path');
const fs = require('fs');
const uploadComprobante = require('./uploadComprobante');

let multer = null;

try {
  multer = require('multer');
} catch (e) {
  console.warn('[Justificaciones] multer no disponible. Ejecute npm install en el servidor.');
}

const carpetaJustificativos = path.join(__dirname, '..', 'uploads', 'justificativos');
const { extensionPorMime, verificarFirmaArchivo } = uploadComprobante;

let uploadJustificativo;

if (multer) {
  fs.mkdirSync(carpetaJustificativos, { recursive: true });

  uploadJustificativo = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, carpetaJustificativos),
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
  uploadJustificativo = {
    single: () => (req, res, next) => {
      next(new Error('Subida de archivos no disponible: falta ejecutar npm install en el servidor.'));
    }
  };
}

uploadJustificativo.verificarFirmaArchivo = verificarFirmaArchivo;

module.exports = uploadJustificativo;
