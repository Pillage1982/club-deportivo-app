// "¿Olvidaste tu PIN?" del Portal del Socio (ver recuperacionClaveController).
// Sin ?token: pide el RUT y solicita el enlace. Con ?token: crea el PIN nuevo.
// Usa API_URL y escaparHtml de api.js.

const tokenRecuperacion = new URLSearchParams(window.location.search).get('token');

if (tokenRecuperacion) {
  document.getElementById('paso_solicitar').classList.add('d-none');
  document.getElementById('paso_restablecer').classList.remove('d-none');
  // Saca el token de la barra de direcciones (historial, capturas de pantalla).
  window.history.replaceState(null, '', window.location.pathname);
}

function solicitarEnlace() {
  const rut = document.getElementById('rut').value.trim();
  const respuesta = document.getElementById('respuesta');

  if (!rut) {
    respuesta.innerHTML = alertaHtml('warning', 'Ingresa tu RUT');
    return;
  }

  enviar('btn_solicitar', 'Enviar enlace', `${API_URL}/socio-auth/recuperar`, { rut }, data => {
    document.getElementById('paso_solicitar').classList.add('d-none');
    respuesta.innerHTML = alertaHtml('success', data.mensaje);
  });
}

function restablecerPin() {
  const pinNuevo = document.getElementById('pin_nuevo').value.trim();
  const confirmar = document.getElementById('pin_nuevo_confirmar').value.trim();
  const respuesta = document.getElementById('respuesta');

  if (!/^[0-9]{6}$/.test(pinNuevo)) {
    respuesta.innerHTML = alertaHtml('warning', 'El PIN debe tener exactamente 6 dígitos');
    return;
  }
  if (pinNuevo !== confirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'Los PIN no coinciden');
    return;
  }

  enviar('btn_restablecer', 'Guardar nuevo PIN', `${API_URL}/socio-auth/restablecer`,
    { token: tokenRecuperacion, pinNuevo }, data => {
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
  if (!document.getElementById('paso_restablecer').classList.contains('d-none')) restablecerPin();
  else if (!document.getElementById('paso_solicitar').classList.contains('d-none')) solicitarEnlace();
});
