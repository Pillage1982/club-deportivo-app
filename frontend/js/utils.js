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

if (!container) return;

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

function ocultarPorTitulo(texto) {
  document.querySelectorAll('h2').forEach(titulo => {
    if (titulo.textContent.trim() === texto) {
      const contenedor = titulo.closest('.module-section') || titulo.parentElement;

      if (contenedor) {
        contenedor.style.display = 'none';
      }
    }
  });
}

function ocultarSelector(selector) {
  document
    .querySelectorAll(selector)
    .forEach(elemento => {
      elemento.style.display = 'none';
    });
}

function ocultarElemento(id) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.style.display = 'none';
  }
}

function aplicarRolesFrontend() {
  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  const rol = usuario.rol;

  if (rol === 'admin') {
    return;
  }

  if (rol === 'tesorero') {
    ocultarSelector('.nav-asistencias');
    ocultarElemento('modulo_asistencia');
    ocultarElemento('modulo_eventos');
    ocultarElemento('form_personas');
    ocultarPorTitulo('Asistencias');
    ocultarPorTitulo('Gestión de Eventos');
  }

  if (rol === 'entrenador') {
    ocultarSelector('.nav-multas');
    ocultarSelector('.nav-finanzas');
    ocultarElemento('modulo_multas');
    ocultarElemento('modulo_finanzas');
    ocultarElemento('modulo_pagos');
  }

  const btnGenerarCuotas =
    document.getElementById('btn_generar_cuotas');

  if (
    btnGenerarCuotas &&
    rol !== 'admin' &&
    rol !== 'tesorero'
  ) {
    btnGenerarCuotas.style.display = 'none';
  }

  if (rol === 'tesorero' || rol === 'entrenador') {
  document
    .querySelectorAll('#tabla_personas button')
    .forEach(btn => {
      btn.style.display = 'none';
    });
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