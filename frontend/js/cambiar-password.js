// Cambio de clave obligatorio del panel admin: se llega aquí desde login.js cuando
// el usuario entra con la clave genérica (debe_cambiar_password=1). Al guardar,
// el backend entrega un token nuevo sin la restricción y se entra al panel (o a
// registrar-email.html si el usuario aún no tiene email).
const API_URL = window.API_URL || window.location.origin;

const PASSWORD_MIN_LARGO = 8;

function cambiarPassword() {
  const passwordActual = document.getElementById('password_actual').value;
  const passwordNueva = document.getElementById('password_nueva').value;
  const passwordNuevaConfirmar = document.getElementById('password_nueva_confirmar').value;
  const respuesta = document.getElementById('respuesta');

  if (!passwordActual || !passwordNueva || !passwordNuevaConfirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'Completa los tres campos');
    return;
  }

  if (passwordNueva.length < PASSWORD_MIN_LARGO) {
    respuesta.innerHTML = alertaHtml('warning', `La clave nueva debe tener al menos ${PASSWORD_MIN_LARGO} caracteres`);
    return;
  }

  if (passwordNueva !== passwordNuevaConfirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'La clave nueva no coincide con la confirmación');
    return;
  }

  const boton = document.getElementById('btn_cambiar_password');
  boton.disabled = true;
  boton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  fetch(`${API_URL}/usuarios/cambiar-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ passwordActual, passwordNueva })
  })
    .then(async res => {
      const data = await res.json();
      if (res.status === 401 && data.mensaje === 'Token inválido') {
        salir();
        return null;
      }
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo cambiar la clave');
      return data;
    })
    .then(data => {
      if (!data) return;
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      window.location.href = data.usuario.debeRegistrarEmail ? 'registrar-email.html' : 'index.html';
    })
    .catch(err => {
      boton.disabled = false;
      boton.innerHTML = 'Guardar nueva clave';
      console.error(err);
      respuesta.innerHTML = alertaHtml('danger', err.message);
    });
}

function salir() {
  localStorage.removeItem('token');
  localStorage.removeItem('usuario');
  window.location.href = 'login.html';
}

function escaparTexto(texto) {
  const div = document.createElement('div');
  div.textContent = texto;
  return div.innerHTML;
}

function alertaHtml(tipo, mensaje) {
  const icono = tipo === 'danger' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill';
  return `
    <div class="alert alert-${tipo} mt-3">
      <i class="bi bi-${icono}"></i>
      ${escaparTexto(mensaje)}
    </div>
  `;
}

document.getElementById('link_salir').addEventListener('click', e => {
  e.preventDefault();
  salir();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    cambiarPassword();
  }
});
