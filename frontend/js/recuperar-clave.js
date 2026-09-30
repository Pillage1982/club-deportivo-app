// "¿Olvidaste tu contraseña?" del panel de la directiva (ver recuperacionClaveController).
// Sin ?token: pide el usuario y solicita el enlace. Con ?token: crea la clave nueva.
const API_URL = window.API_URL || window.location.origin;

const PASSWORD_MIN_LARGO = 8;
const tokenRecuperacion = new URLSearchParams(window.location.search).get('token');

if (tokenRecuperacion) {
  document.getElementById('paso_solicitar').classList.add('d-none');
  document.getElementById('paso_restablecer').classList.remove('d-none');
  // Saca el token de la barra de direcciones (historial, capturas de pantalla).
  window.history.replaceState(null, '', window.location.pathname);
}

function solicitarEnlace() {
  const usuario = document.getElementById('usuario').value.trim();
  const respuesta = document.getElementById('respuesta');

  if (!usuario) {
    respuesta.innerHTML = alertaHtml('warning', 'Ingresa tu usuario');
    return;
  }

  enviar('btn_solicitar', 'Enviar enlace', `${API_URL}/usuarios/recuperar`, { usuario }, data => {
    document.getElementById('paso_solicitar').classList.add('d-none');
    respuesta.innerHTML = alertaHtml('success', data.mensaje);
  });
}

function restablecerClave() {
  const passwordNueva = document.getElementById('password_nueva').value;
  const confirmar = document.getElementById('password_nueva_confirmar').value;
  const respuesta = document.getElementById('respuesta');

  if (passwordNueva.length < PASSWORD_MIN_LARGO) {
    respuesta.innerHTML = alertaHtml('warning', `La contraseña debe tener al menos ${PASSWORD_MIN_LARGO} caracteres`);
    return;
  }
  if (passwordNueva !== confirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'Las contraseñas no coinciden');
    return;
  }

  enviar('btn_restablecer', 'Guardar nueva contraseña', `${API_URL}/usuarios/restablecer`,
    { token: tokenRecuperacion, passwordNueva }, data => {
      document.getElementById('paso_restablecer').classList.add('d-none');
      respuesta.innerHTML = alertaHtml('success', data.mensaje);
    });
}

function enviar(idBoton, textoBoton, url, cuerpo, alTerminar) {
  const boton = document.getElementById(idBoton);
  const respuesta = document.getElementById('respuesta');
  boton.disabled = true;
  boton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Enviando...`;

  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo)
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo completar la solicitud');
      return data;
    })
    .then(alTerminar)
    .catch(err => {
      boton.disabled = false;
      boton.innerHTML = textoBoton;
      respuesta.innerHTML = alertaHtml('danger', err.message);
    });
}

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function alertaHtml(tipo, mensaje) {
  const icono = tipo === 'success' ? 'check-circle-fill' : tipo === 'danger' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill';
  return `
    <div class="alert alert-${tipo} mt-3">
      <i class="bi bi-${icono}"></i>
      ${escaparHtml(mensaje)}
    </div>
  `;
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  if (!document.getElementById('paso_restablecer').classList.contains('d-none')) restablecerClave();
  else if (!document.getElementById('paso_solicitar').classList.contains('d-none')) solicitarEnlace();
});
