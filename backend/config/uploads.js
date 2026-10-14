// Carpeta de los archivos subidos (comprobantes, justificativos, depósitos del Portal).
// En Hostinger cada despliegue por zip reemplaza la carpeta de la app y BORRA
// backend/uploads: en el servidor se define la variable de entorno UPLOADS_DIR con
// una ruta fuera de la app (ej. /home/<usuario>/domains/<sitio>/uploads).
// Sin la variable (desarrollo local) se usa backend/uploads.
require('dotenv').config();
const path = require('path');

const DIRECTORIO_UPLOADS = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', 'uploads');

// Ruta absoluta de un archivo guardado como 'subcarpeta/archivo' en la BD. Rechaza
// rutas que intenten salir de la carpeta de uploads (ej. '../.env').
function rutaUpload(rutaRelativa) {
  const ruta = path.resolve(DIRECTORIO_UPLOADS, String(rutaRelativa || ''));
  if (ruta !== DIRECTORIO_UPLOADS && !ruta.startsWith(DIRECTORIO_UPLOADS + path.sep)) {
    throw new Error('Ruta de archivo fuera de la carpeta de uploads');
  }
  return ruta;
}

module.exports = { DIRECTORIO_UPLOADS, rutaUpload };
