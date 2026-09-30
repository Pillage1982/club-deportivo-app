// Validaciones y normalizaciones de datos de integrantes compartidas entre el
// panel admin (personaController) y el Portal del Socio (socioPerfilController).

function limpiarTexto(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ');
}

function limpiarRut(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function validarRut(rut) {
  const limpio = limpiarRut(rut);

  if (!/^[0-9]{7,8}[0-9K]$/.test(limpio)) {
    return false;
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

  return dv === dvEsperado;
}

// '12.345.678-k' -> '12345678-K' (mismo formato en que se guardan los RUT en personas).
function formatearRut(rut) {
  const limpio = limpiarRut(rut);
  return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
}

function validarEmail(email) {
  if (!email) return true;

  // La regex anterior solo excluia espacios y '@', permitiendo HTML/JS
  // (ej. "<svg/onload=...>@a.b") que luego se guardaba tal cual y se
  // renderizaba sin escapar en el frontend (stored XSS). Se restringe a
  // los caracteres reales de un email, sin '<', '>', comillas ni backticks.
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function validarNombre(valor) {
  const texto = limpiarTexto(valor);
  return texto.length >= 2 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/.test(texto);
}

// Celular chileno en formato único +569XXXXXXXX (pedido del cliente GDC).
// Acepta 9XXXXXXXX, 569XXXXXXXX o +56 9 XXXX XXXX con espacios/guiones.
// Devuelve null si no es un celular válido.
function normalizarCelular(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (/^9[0-9]{8}$/.test(digitos)) return `+56${digitos}`;
  if (/^569[0-9]{8}$/.test(digitos)) return `+${digitos}`;
  return null;
}

// 'AAAA-MM-DD' válida, no futura y posterior a 1900. Se compara como texto
// para no depender de la zona horaria del servidor.
function validarFechaNacimientoISO(fecha) {
  const texto = String(fecha || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [anio, mes, dia] = texto.split('-').map(Number);
  const f = new Date(Date.UTC(anio, mes - 1, dia));
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return false;
  return anio >= 1900 && texto <= fechaHoyISO();
}

function fechaHoyISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

function edadDesde(fechaNacimiento) {
  const [anio, mes, dia] = String(fechaNacimiento).substring(0, 10).split('-').map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
  return edad;
}

module.exports = {
  limpiarTexto,
  limpiarRut,
  validarRut,
  formatearRut,
  validarEmail,
  validarNombre,
  normalizarCelular,
  validarFechaNacimientoISO,
  edadDesde
};
