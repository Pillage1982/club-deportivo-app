// =====================================
// CONFIGURACION GLOBAL API BACKEND
// =====================================

const API_URL = 'http://localhost:3000';


/// =====================================
// ALERTAS VISUALES BOOTSTRAP
// =====================================

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

  // Inserta alerta visual en pantalla
  container.appendChild(alerta);

  // Elimina automáticamente la alerta
  setTimeout(() => {

    alerta.remove();

  }, 4000);

}

// =====================================
// HEADERS AUTENTICADOS JWT
// =====================================

function getAuthHeaders() {

  // Envia token JWT para autenticar peticiones
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

// =====================================
// MOSTRAR USUARIO AUTENTICADO
// =====================================

function mostrarUsuario() {

  const usuario =
    JSON.parse(
      localStorage.getItem('usuario')
    );

  if (usuario) {

    // Muestra usuario y rol en interfaz
    document.getElementById(
      'usuario_logeado'
      ).innerText =
      `${usuario.usuario} (${usuario.rol})`;

  }

}

// =====================================
// CONTROL VISUAL DE MODULOS POR ROL
// =====================================

function aplicarRolesFrontend() {

  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  // Entrenador no puede acceder a finanzas ni multas
  if (usuario.rol === 'entrenador') {

    document.getElementById(
      'modulo_multas'
    ).style.display = 'none';

    document.getElementById(
      'modulo_finanzas'
    ).style.display = 'none';

  }

  // Tesorero no puede registrar asistencias
  if (usuario.rol === 'tesorero') {

    document.getElementById(
      'modulo_asistencia'
    ).style.display = 'none';

  }

}