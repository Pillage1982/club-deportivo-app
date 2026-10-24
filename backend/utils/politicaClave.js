// Política de contraseña del Portal del Socio (reemplazó al PIN de 6 dígitos,
// sep-2026): mínimo 8 caracteres con mayúscula, minúscula, número y símbolo, y
// sin contener el RUT. Mismas reglas en frontend/socio/js/api.js (REQUISITOS_CLAVE).

const LARGO_MINIMO = 8;
// bcrypt ignora lo que pase de 72 bytes: un tope evita claves "largas" que en
// realidad no se validan completas.
const LARGO_MAXIMO = 64;

const REQUISITOS = [
  { texto: `al menos ${LARGO_MINIMO} caracteres`, cumple: c => c.length >= LARGO_MINIMO },
  { texto: 'una letra mayúscula', cumple: c => /[A-ZÁÉÍÓÚÑ]/.test(c) },
  { texto: 'una letra minúscula', cumple: c => /[a-záéíóúñ]/.test(c) },
  { texto: 'un número', cumple: c => /[0-9]/.test(c) },
  { texto: 'un símbolo (por ejemplo ! @ # $ % . -)', cumple: c => /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(c) }
];

// Devuelve el mensaje de error, o null si la clave cumple la política.
// `rut` (opcional): la clave no puede contener el cuerpo del RUT del socio.
function validarClaveSocio(clave, rut) {
  const texto = String(clave || '');

  if (texto.length > LARGO_MAXIMO) {
    return `La contraseña no puede tener más de ${LARGO_MAXIMO} caracteres`;
  }

  const faltantes = REQUISITOS.filter(r => !r.cumple(texto)).map(r => r.texto);
  if (faltantes.length) {
    return `La contraseña debe tener ${faltantes.join(', ')}`;
  }

  const cuerpoRut = String(rut || '').replace(/[^0-9]/g, '').slice(0, -1);
  if (cuerpoRut.length >= 7 && texto.replace(/[^0-9]/g, '').includes(cuerpoRut)) {
    return 'La contraseña no puede contener tu RUT';
  }

  return null;
}

module.exports = { validarClaveSocio, LARGO_MINIMO, LARGO_MAXIMO };
