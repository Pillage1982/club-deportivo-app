// Registro del email del directivo (primer ingreso al panel): se llega aquí desde
// login.js o cambiar-password.js cuando el usuario no tiene email
// (usuario.debeRegistrarEmail). Al guardar, el backend entrega un token nuevo sin
// la restricción y se entra al panel.
const API_URL = window.API_URL || window.location.origin;

// Si además tiene pendiente el cambio de clave, ese paso va primero.
try {
  if (JSON.parse(localStorage.getItem('usuario') || '{}').debeCambiarPassword) {
    window.location.replace('cambiar-password.html');
  }
} catch (e) {}

function registrarEmail() {
  const email = document.getElementById('email').value.trim().toLowerCase();
  const confirmar = document.getElementById('email_confirmar').value.trim().toLowerCase();
  const respuesta = document.getElementById('respuesta');

  if (!email || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    respuesta.innerHTML = alertaHtml('warning', 'Ingresa un email válido');
    return;
  }

  if (email !== confirmar) {
    respuesta.innerHTML = alertaHtml('warning', 'Los emails no coinciden');
    return;
  }

  const boton = document.getElementById('btn_registrar_email');
  boton.disabled = true;
  boton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  fetch(`${API_URL}/usuarios/registrar-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ email })
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        salir();
        return null;
      }
      if (data.codigo === 'CAMBIO_PASSWORD_REQUERIDO') {
        window.location.href = 'cambiar-password.html';
        return null;
      }
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar el email');
      return data;
    })
    .then(data => {
      if (!data) return;
      localStorage.setItem('token', data.token);
      localStorage.setItem('usuario', JSON.stringify(data.usuario));
      window.location.href = 'index.html';
    })
    .catch(err => {
      boton.disabled = false;
      boton.innerHTML = 'Guardar y continuar';
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
    registrarEmail();
  }
});
