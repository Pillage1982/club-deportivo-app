// Helpers compartidos del Portal del Socio: token propio (socio_token, nunca el
// 'token' admin), headers, formato y expiración de sesión. Deliberadamente
// autocontenido (no incluye ../js/utils.js) para no depender de estado ni
// convenciones del panel admin.
const API_URL = window.location.origin;

// =====================================
// SESIÓN
// =====================================
function getSocioToken() {
  return localStorage.getItem('socio_token');
}

function getAuthHeadersSocio() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getSocioToken()}`
  };
}

function guardarSesionSocio(data) {
  localStorage.setItem('socio_token', data.token);
  localStorage.setItem('socio_nombre', `${data.socio.nombres} ${data.socio.apellido_paterno}`.trim());
  localStorage.setItem('socio_pin_cambiado', data.pinCambiado ? '1' : '0');
}

function cerrarSesionSocio() {
  localStorage.removeItem('socio_token');
  localStorage.removeItem('socio_nombre');
  localStorage.removeItem('socio_pin_cambiado');
  window.location.href = 'login.html';
}

// Redirige a login si no hay token, o a cambiar-pin si el primer PIN sigue sin
// cambiarse. Llamar al inicio de cada página protegida (index.html, cambiar-pin.html).
function requireSocioLogin({ permitirPinPendiente = false } = {}) {
  if (!getSocioToken()) {
    window.location.href = 'login.html';
    return false;
  }
  if (!permitirPinPendiente && localStorage.getItem('socio_pin_cambiado') === '0') {
    window.location.href = 'cambiar-pin.html';
    return false;
  }
  return true;
}

// =====================================
// EXPIRACIÓN DE TOKEN (JWT de socio dura 10 días, ver socioAuthController)
// =====================================
function decodificarJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function verificarExpiracionSocio() {
  const token = getSocioToken();
  if (!token) return;
  const payload = decodificarJwt(token);
  if (!payload?.exp) return;
  const msRestantes = payload.exp * 1000 - Date.now();
  if (msRestantes <= 0) { cerrarSesionSocio(); return; }
  setTimeout(cerrarSesionSocio, msRestantes);
}

// Cierra sesión automáticamente si /socio-auth responde 401 (token vencido o inválido).
// Acotado por URL a propósito: esta página solo llama a /socio-auth, pero así queda
// explícito que no debe interferir si алguna vez se agrega otro fetch aquí.
(function interceptarFetchSocio() {
  const fetchOriginal = window.fetch;
  window.fetch = async function (...args) {
    const response = await fetchOriginal.apply(this, args);
    const url = String(args[0] || '');
    if (response.status === 401 && url.includes('/socio-auth')) {
      cerrarSesionSocio();
    }
    return response;
  };
})();

// =====================================
// FORMATO
// =====================================
function escapeHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

function formatearFecha(fecha) {
  if (!fecha) return '';
  const fechaLimpia = String(fecha).split('T')[0];
  const partes = fechaLimpia.split('-');
  if (partes.length !== 3) return fechaLimpia;
  const [anio, mes, dia] = partes;
  return `${dia}-${mes}-${anio}`;
}

function formatearFechaHora(fecha) {
  if (!fecha) return '';
  const fechaObjeto = new Date(String(fecha).replace(' ', 'T'));
  if (Number.isNaN(fechaObjeto.getTime())) return formatearFecha(fecha);
  const dia = String(fechaObjeto.getDate()).padStart(2, '0');
  const mes = String(fechaObjeto.getMonth() + 1).padStart(2, '0');
  const anio = fechaObjeto.getFullYear();
  const horas = String(fechaObjeto.getHours()).padStart(2, '0');
  const minutos = String(fechaObjeto.getMinutes()).padStart(2, '0');
  return `${dia}-${mes}-${anio} ${horas}:${minutos}`;
}

function formatearMonto(monto) {
  return `$${Number(monto || 0).toLocaleString('es-CL')}`;
}

const NOMBRES_MESES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function nombreMes(mes) {
  return NOMBRES_MESES[Number(mes)] || mes;
}
