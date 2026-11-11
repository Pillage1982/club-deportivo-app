// SOLO LECTURA. Agrupa los archivos de una carpeta por su SHA-256 y reporta los
// que son idénticos byte a byte (el mismo comprobante reenviado). No escribe nada,
// no toca la base de datos, no necesita credenciales ni variables de entorno.
//
// Uso:
//   node hash-comprobantes-duplicados.js <carpeta>
// Ejemplo en producción (Hostinger):
//   node hash-comprobantes-duplicados.js /home/u402516660/uploads_gdc/app/comprobantes_deposito
//
// Luego se cruzan los nombres de archivo con la columna adjunto_path de la BD
// (consulta D del diagnóstico) para saber qué folio es cada uno.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
if (!dir) {
  console.error('Uso: node hash-comprobantes-duplicados.js <carpeta>');
  process.exit(1);
}

function sha256(archivo) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(archivo));
  return h.digest('hex');
}

let nombres;
try {
  nombres = fs.readdirSync(dir).filter(n => {
    try { return fs.statSync(path.join(dir, n)).isFile(); } catch { return false; }
  });
} catch (e) {
  console.error('No se pudo leer la carpeta:', e.message);
  process.exit(1);
}

console.log(`Carpeta : ${dir}`);
console.log(`Archivos: ${nombres.length}`);

const porHash = new Map();
let ilegibles = 0;
for (const nombre of nombres) {
  let hash;
  try { hash = sha256(path.join(dir, nombre)); } catch { ilegibles++; continue; }
  if (!porHash.has(hash)) porHash.set(hash, []);
  porHash.get(hash).push(nombre);
}

const grupos = [...porHash.entries()].filter(([, arr]) => arr.length > 1);
if (ilegibles) console.log(`Ilegibles: ${ilegibles}`);
console.log(`Grupos de archivos IDENTICOS (mismo SHA-256): ${grupos.length}`);
console.log('='.repeat(72));

for (const [hash, arr] of grupos) {
  console.log(`\nSHA-256: ${hash}  (${arr.length} copias)`);
  for (const n of arr) console.log(`  comprobantes_deposito/${n}`);
}
if (!grupos.length) console.log('\nNo hay archivos identicos por contenido.');
