// Cambio de PIN: obligatorio en el primer ingreso (la clave actual es el RUT sin
// puntos ni guion; sin opción de cancelar), voluntario después (?voluntario=1,
// clave actual = PIN propio, con link para volver a Inicio).

const esVoluntario = new URLSearchParams(window.location.search).get('voluntario') === '1';

if (esVoluntario) {
  document.getElementById('texto_intro').textContent = 'Puedes cambiar tu PIN cuando quieras.';
  const pinActualInput = document.getElementById('pin_actual');
  pinActualInput.placeholder = 'PIN actual';
  pinActualInput.setAttribute('inputmode', 'numeric');
  pinActualInput.maxLength = 6;
  const link = document.getElementById('link_cancelar');
  link.style.display = 'inline';
  link.addEventListener('click', e => {
    e.preventDefault();
    window.location.href = 'index.html';
  });
}

function cambiarPinSocio() {
  const pinActual = document.getElementById('pin_actual').value.trim();
  const pinNuevo = document.getElementById('pin_nuevo').value.trim();
  const pinNuevoConfirmar = document.getElementById('pin_nuevo_confirmar').value.trim();
  const respuesta = document.getElementById('respuesta');

  if (!pinActual || !pinNuevo || !pinNuevoConfirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'Completa los tres campos');
    return;
  }

  if (!/^[0-9]{6}$/.test(pinNuevo)) {
    respuesta.innerHTML = alertaHtml('warning', 'El PIN nuevo debe tener exactamente 6 dígitos');
    return;
  }

  if (pinNuevo !== pinNuevoConfirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'El PIN nuevo no coincide con la confirmación');
    return;
  }

  const boton = document.getElementById('btn_cambiar_pin');
  boton.disabled = true;
  boton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  fetch(`${API_URL}/socio-auth/cambiar-pin`, {
    method: 'POST',
    headers: getAuthHeadersSocio(),
    body: JSON.stringify({ pinActual, pinNuevo })
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo cambiar el PIN');
      return data;
    })
    .then(() => {
      localStorage.setItem('socio_pin_cambiado', '1');
      // Primer ingreso: después del PIN viene "Actualizar datos".
      window.location.href = localStorage.getItem('socio_datos_actualizados') === '1'
        ? 'index.html'
        : 'actualizar-datos.html';
    })
    .catch(err => {
      boton.disabled = false;
      boton.innerHTML = 'Guardar nuevo PIN';
      console.error(err);
      respuesta.innerHTML = alertaHtml('danger', err.message);
    });
}

function alertaHtml(tipo, mensaje) {
  const icono = tipo === 'danger' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill';
  return `
    <div class="alert alert-${tipo} mt-3">
      <i class="bi bi-${icono}"></i>
      ${escaparHtml(mensaje)}
    </div>
  `;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    cambiarPinSocio();
  }
});
