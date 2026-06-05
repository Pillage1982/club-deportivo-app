// =====================================
// CONFIGURACION GLOBAL API BACKEND
// =====================================

const API_URL = window.API_URL || window.location.origin;


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

/// =====================================
// CONTROL VISUAL DE MODULOS POR ROL
// =====================================

function aplicarRolesFrontend() {

  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  const btnGenerarCuotas =
    document.getElementById(
      'btn_generar_cuotas'
    );

  if (btnGenerarCuotas) {

    if (
      usuario.rol !== 'admin' &&
      usuario.rol !== 'tesorero'
    ) {

      btnGenerarCuotas.style.display = 'none';

    }

  }

  // Entrenador no puede acceder a finanzas ni multas
  if (usuario.rol === 'entrenador') {

  const modulosOcultar = [
    'modulo_multas',
    'modulo_finanzas',
    'modulo_pagos'
  ];

  modulosOcultar.forEach(id => {

    const modulo =
      document.getElementById(id);

    if (modulo) {

      modulo.style.display = 'none';

    }

  });

}

  // Tesorero no puede registrar asistencias
  if (usuario.rol === 'tesorero') {

    document.getElementById(
      'modulo_asistencia'
    ).style.display = 'none';

  }

}

// =====================================
// FORMATEAR FECHAS
// =====================================

function formatearFecha(fecha) {

  if (!fecha) {

    return '';

  }

  const fechaLimpia =
    fecha.split('T')[0];

  const partes =
    fechaLimpia.split('-');

  if (partes.length !== 3) {

    return fechaLimpia;

  }

  const anio =
    partes[0];

  const mes =
    partes[1];

  const dia =
    partes[2];

  return `${dia}-${mes}-${anio}`;

}