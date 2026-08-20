// Carga de comprobantes de gastos con Multer: valida destino, extensión y disponibilidad de la dependencia.
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

// Extensión guardada según el mimetype ya validado, nunca según el nombre
// original del archivo (que es controlado por quien lo sube y puede declarar
// cualquier extensión, incl. .html, para forzar cómo el navegador la renderiza).
const extensionPorMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

// Firmas binarias (magic bytes) reales de cada tipo permitido. El mimetype
// declarado en la petición es un header enviado por el cliente y no garantiza
// que el contenido sea realmente ese tipo; esto verifica el archivo ya escrito
// en disco antes de dejarlo asociado a un gasto.
async function verificarFirmaArchivo(rutaArchivo, mimetypeDeclarado) {
  if (mimetypeDeclarado === 'image/jpeg') {
    const buffer = await leerPrimerosBytes(rutaArchivo, 3);
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimetypeDeclarado === 'image/png') {
    const buffer = await leerPrimerosBytes(rutaArchivo, 8);
    const firma = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    return buffer.length >= 8 && firma.every((byte, i) => buffer[i] === byte);
  }
  if (mimetypeDeclarado === 'image/webp') {
    const buffer = await leerPrimerosBytes(rutaArchivo, 12);
    return buffer.length >= 12
      && buffer.toString('ascii', 0, 4) === 'RIFF'
      && buffer.toString('ascii', 8, 12) === 'WEBP';
  }
  if (mimetypeDeclarado === 'application/pdf') {
    const buffer = await leerPrimerosBytes(rutaArchivo, 4);
    return buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '%PDF';
  }
  return false;
}

function leerPrimerosBytes(rutaArchivo, cantidad) {
  return new Promise((resolve, reject) => {
    fs.open(rutaArchivo, 'r', (errOpen, fd) => {
      if (errOpen) return reject(errOpen);
      const buffer = Buffer.alloc(cantidad);
      fs.read(fd, buffer, 0, cantidad, 0, (errRead, bytesLeidos) => {
        fs.close(fd, () => {
          if (errRead) return reject(errRead);
          resolve(buffer.subarray(0, bytesLeidos));
        });
      });
    });
  });
}

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
      cb(null, `${sufijo}${extensionPorMime[file.mimetype] || ''}`);
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

uploadComprobante.verificarFirmaArchivo = verificarFirmaArchivo;
uploadComprobante.extensionPorMime = extensionPorMime;

module.exports = uploadComprobante;
