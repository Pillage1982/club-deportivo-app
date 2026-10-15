// Carpeta de los archivos subidos (comprobantes, justificativos, depósitos del Portal).
// En Hostinger cada despliegue por zip reemplaza la carpeta de la app y BORRA
// backend/uploads: en el servidor se define la variable de entorno UPLOADS_DIR con
// una ruta fuera de la app (ej. /home/<usuario>/domains/<sitio>/uploads).
// Sin la variable (desarrollo local) se usa backend/uploads.
require('dotenv').config();
const fs = require('fs');
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

// Tipo de contenido según la extensión guardada (que el servidor fija según el
// tipo validado al subir), nunca según lo que diga el cliente.
const MIME_POR_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

// Envía un archivo subido como descarga. Se lee con fs.readFile (máx. 5MB) en vez
// de res.sendFile: en Hostinger (Node bajo LiteSpeed) sendFile fallaba con archivos
// que sí existían y el motivo no quedaba registrado. Cualquier error se registra
// con su código y ruta para verlo en "Registros de tiempo de ejecución".
function enviarArchivoSubido(res, rutaRelativa, nombreDescarga, mensajeNoEncontrado = 'Comprobante no encontrado') {
  let ruta;
  try {
    ruta = rutaUpload(rutaRelativa);
  } catch (err) {
    console.error(`[uploads] Ruta rechazada "${rutaRelativa}": ${err.message}`);
    return res.status(404).json({ mensaje: mensajeNoEncontrado });
  }

  fs.readFile(ruta, (err, contenido) => {
    if (err) {
      console.error(`[uploads] No se pudo leer ${ruta}: ${err.code || ''} ${err.message}`);
      if (!res.headersSent) res.status(404).json({ mensaje: mensajeNoEncontrado });
      return;
    }
    const extension = path.extname(ruta).toLowerCase();
    // Content-Type explícito y Content-Disposition: attachment como defensa
    // adicional si el archivo se abre por navegación directa en vez de fetch()+blob().
    res.set('Content-Disposition', `attachment; filename="${nombreDescarga}${extension}"`);
    res.type(MIME_POR_EXTENSION[extension] || 'application/octet-stream');
    res.send(contenido);
  });
}

module.exports = { DIRECTORIO_UPLOADS, rutaUpload, enviarArchivoSubido };
