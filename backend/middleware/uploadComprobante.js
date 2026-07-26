const path = require('path');
const fs = require('fs');

let multer = null;

try {
  multer = require('multer');
} catch (e) {
  console.warn('[Gastos] multer no disponible. Ejecute npm install en el servidor.');
}

const carpetaComprobantes = path.join(__dirname, '..', 'uploads', 'comprobantes');

const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

function fileFilter(req, file, cb) {
  if (!tiposPermitidos.includes(file.mimetype)) {
    return cb(new Error('Formato no permitido. Solo imágenes (jpg, png, webp) o PDF.'));
  }
  cb(null, true);
}

let uploadComprobante;

if (multer) {
  fs.mkdirSync(carpetaComprobantes, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, carpetaComprobantes),
    filename: (req, file, cb) => {
      const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${sufijo}${path.extname(file.originalname).toLowerCase()}`);
    }
  });

  uploadComprobante = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
  });
} else {
  // Si multer no está instalado, no bloquea el arranque del servidor: solo
  // informa el error al intentar subir un comprobante (mismo patrón que
  // nodemailer en emailService.js para este tipo de drift de dependencias).
  uploadComprobante = {
    single: () => (req, res, next) => {
      next(new Error('Subida de comprobantes no disponible: falta ejecutar npm install en el servidor.'));
    }
  };
}

module.exports = uploadComprobante;
