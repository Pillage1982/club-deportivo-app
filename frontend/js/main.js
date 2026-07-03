// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

let _rol, _puedeVerOperacion, _puedeVerFinanzas;
let _asistenciaIniciada = false;
let _tablasIniciadas    = false;

const MODULOS_ASISTENCIA = [
  'js/eventos.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'js/asistencias.js'
];

const MODULOS_TABLAS = [
  'js/eventos.js',
  'js/pagos.js',
  'js/cuotas.js'
];

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  _rol = obtenerRolActual();
  _puedeVerOperacion = _rol === 'admin' || _rol === 'entrenador';
  _puedeVerFinanzas  = _rol === 'admin' || _rol === 'tesorero';

  verificarExpiracionToken();
  aplicarConfiguracionVisual();
  mostrarUsuario();
  aplicarRolesFrontend();
  aplicarRolesTabs();

  cargarPersonas();
  cargarTablaPersonas();
  configurarBuscadorPersonas();
  cargarDashboard();
  if (_puedeVerFinanzas) cargarGraficos();

  document.querySelector('[href="#tab_asistencia"]')
    ?.addEventListener('show.bs.tab', inicializarAsistencia);
  document.querySelector('[href="#tab_tablas"]')
    ?.addEventListener('show.bs.tab', inicializarTablas);
  document.querySelector('[href="#tab_formularios"]')
    ?.addEventListener('show.bs.tab', inicializarTablas);

};

async function inicializarAsistencia() {
  await Promise.all(MODULOS_ASISTENCIA.map(cargarModulo));
  cargarEventos();
  if (!_asistenciaIniciada) {
    _asistenciaIniciada = true;
    cargarAsistencias();
  }
}

async function inicializarTablas() {
  await Promise.all(MODULOS_TABLAS.map(cargarModulo));
  if (!_tablasIniciadas) {
    _tablasIniciadas = true;
    configurarFiltrosEventos();
    configurarFiltrosPagos();
    configurarFiltrosCuotas();
    configurarFiltrosFinanzas();
  }
  if (_puedeVerOperacion) { cargarEventos(); cargarTablaEventos(); }
  if (_puedeVerFinanzas) { cargarMultas(); cargarFinanzas(); cargarTablaPagos(); cargarCuotas(); }
}

function aplicarRolesTabs() {
  const puedeVerOperacion = _rol === 'admin' || _rol === 'entrenador';
  const puedeVerFinanzas  = _rol === 'admin' || _rol === 'tesorero';

  if (!puedeVerOperacion) {
    document.getElementById('nav_tab_asistencia')?.classList.add('d-none');
    document.getElementById('nav_subtab_eventos')?.classList.add('d-none');
    document.getElementById('nav_subtab_asistencias')?.classList.add('d-none');
    document.getElementById('nav_subtab_form_evento')?.classList.add('d-none');
  }

  if (!puedeVerFinanzas) {
    document.getElementById('nav_subtab_pagos')?.classList.add('d-none');
    document.getElementById('nav_subtab_multas')?.classList.add('d-none');
    document.getElementById('nav_subtab_finanzas')?.classList.add('d-none');
    document.getElementById('nav_subtab_form_pago')?.classList.add('d-none');
  }
}
