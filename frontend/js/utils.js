const API_URL = 'http://localhost:3000';


// =========================
// ALERTAS VISUALES
// =========================

function mostrarAlerta(mensaje,tipo = 'success') {

  const container =
    document.getElementById(
      'alert_container'
    );

  const alerta =
    document.createElement('div');

  alerta.className =

    `alert alert-${tipo} alert-dismissible fade show shadow`;

  alerta.role = 'alert';

  alerta.innerHTML = `

    ${mensaje}

    <button
      type="button"
      class="btn-close"
      data-bs-dismiss="alert">
    </button>

  `;

  container.appendChild(alerta);

  setTimeout(() => {

    alerta.remove();

  }, 4000);

}

// =========================
// autenticacion headers
// =========================

function getAuthHeaders() {

  return {

    'Content-Type': 'application/json',

    Authorization:
      `Bearer ${localStorage.getItem('token')}`

  };

}

// ==============================
// LOGOUT -- CERRAR SESION
// ==============================

function logout() {

  localStorage.removeItem('token');

  localStorage.removeItem('usuario');

  window.location.href = 'login.html';

}

// =========================
// MOSTRAR USUARIO
// =========================

function mostrarUsuario() {

  const usuario =
    JSON.parse(
      localStorage.getItem('usuario')
    );

  if (usuario) {

    document.getElementById(
      'usuario_logeado'
    ).innerText =
      `${usuario.usuario} (${usuario.rol})`;

  }

}

// =========================
// FUNCION ROLES
// =========================

function aplicarRolesFrontend() {

  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  // =========================
  // ENTRENADOR
  // =========================

  if (usuario.rol === 'entrenador') {

    document.getElementById(
      'modulo_multas'
    ).style.display = 'none';

    document.getElementById(
      'modulo_finanzas'
    ).style.display = 'none';

  }

  // =========================
  // TESORERO
  // =========================

  if (usuario.rol === 'tesorero') {

    document.getElementById(
      'modulo_asistencia'
    ).style.display = 'none';

  }

}