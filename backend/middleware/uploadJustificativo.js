// Adjuntos que envían los socios desde el Portal del Socio: respaldo de las cartas
// de justificación (licencia médica, certificado...) y comprobantes de depósito.
// Mismas reglas que los comprobantes de gastos (tipos, 5MB, extensión según
// mimetype, firma binaria): se reutilizan de uploadComprobante para no mantener
// dos listas que puedan desalinearse.
const path = require('path');
const fs = require('fs');
const uploadComprobante = require('./uploadComprobante');

let multer = null;

try {
  multer = require('multer');
} catch (e) {
  console.warn('[Portal del Socio] multer no disponible. Ejecute npm install en el servidor.');
}

const { extensionPorMime, verificarFirmaArchivo } = uploadComprobante;

// carpeta: subcarpeta de backend/uploads (ej. 'justificativos').
function crearUploadSocio(carpeta) {
  const destino = path.join(__dirname, '..', 'uploads', carpeta);
  let upload;

  if (multer) {
    fs.mkdirSync(destino, { recursive: true });

    upload = multer({
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
    upload = {
      single: () => (req, res, next) => {
        next(new Error('Subida de archivos no disponible: falta ejecutar npm install en el servidor.'));
      }
    };
  }

  upload.verificarFirmaArchivo = verificarFirmaArchivo;
  return upload;
}

const uploadJustificativo = crearUploadSocio('justificativos');
uploadJustificativo.comprobantesDeposito = crearUploadSocio('comprobantes_deposito');

module.exports = uploadJustificativo;
