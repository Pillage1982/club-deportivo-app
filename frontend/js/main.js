// Orquestador frontend: inicia la aplicación, aplica permisos por rol, precarga datos y controla sesión/navegación.
// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {

    window.location.href = 'login.html';

    return;

  }

  const rol = obtenerRolActual();

  const puedeVerOperacion = rol === 'admin' || rol === 'entrenador';

  const puedeVerFinanzas  = rol === 'admin' || rol === 'tesorero';

  verificarExpiracionToken();
  aplicarConfiguracionVisual();
  mostrarUsuario();
  aplicarRolesFrontend();
  aplicarRolesTabs();

  // Un solo fetch a /personas — luego ambas funciones usan el caché
  fetch(`${API_URL}/personas`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => { if (Array.isArray(data)) guardarCacheApi('personas', data); })
    .catch(() => {})
    .finally(() => {
      cargarPersonas();
      cargarTablaPersonas();
    });

  configurarBuscadorPersonas();
  configurarFiltrosEventos();
  configurarFiltrosPagos();
  configurarSelectorCuotaPago();
  configurarFiltrosCuotas();
  configurarFiltrosFinanzas();
  configurarFiltrosMultas();
  configurarFiltrosAsistencias();
  configurarFiltrosDashboardAsistencia();
  configurarFiltrosGastos();

  if (puedeVerOperacion) {
    // Un solo fetch a /eventos — luego ambas funciones usan el caché
    fetch(`${API_URL}/eventos`, { headers: getAuthHeaders() })
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) guardarCacheApi('eventos', data); })
      .catch(() => {})
      .finally(() => {
        cargarEventos();
        cargarTablaEventos();
      });
    cargarAsistencias();
  }

  if (puedeVerFinanzas) {
    cargarMultas();
    cargarFinanzas();
    cargarGraficos();
    cargarTablaPagos();
    cargarCuotas();
    cargarTablaGastos();
  }

  cargarDashboard();

  // Cargar panel "Sin asignar" cuando se activa ese subtab
  const tabSinEvento = document.querySelector('[href="#subtab_sin_evento"]');
  if (tabSinEvento) {
    tabSinEvento.addEventListener('shown.bs.tab', () => cargarPanelSinEvento());
  }

  // Cargar ranking puntaje cuando se activa ese subtab
  const tabPuntaje = document.querySelector('[href="#subtab_puntaje"]');
  if (tabPuntaje) {
    tabPuntaje.addEventListener('shown.bs.tab', () => {
      cargarRankingPuntaje();
      configurarBuscadorPuntaje();
    });
  }

  const tabFormaciones = document.querySelector('[href="#subtab_formaciones"]');
  if (tabFormaciones) {
    tabFormaciones.addEventListener('shown.bs.tab', () => inicializarFormaciones());
  }

};

function aplicarRolesTabs() {
  const rol = obtenerRolActual();
  const puedeVerOperacion = rol === 'admin' || rol === 'entrenador';
  const puedeVerFinanzas  = rol === 'admin' || rol === 'tesorero';

  if (!puedeVerOperacion) {
    document.getElementById('nav_tab_asistencia')?.classList.add('d-none');
    document.getElementById('nav_subtab_eventos')?.classList.add('d-none');
    document.getElementById('nav_subtab_asistencias')?.classList.add('d-none');
    document.getElementById('nav_subtab_form_evento')?.classList.add('d-none');
    document.getElementById('nav_subtab_sin_evento')?.classList.add('d-none');
    document.getElementById('nav_subtab_puntaje')?.classList.add('d-none');
  }

  if (!puedeVerFinanzas) {
    document.getElementById('nav_subtab_pagos')?.classList.add('d-none');
    document.getElementById('nav_subtab_multas')?.classList.add('d-none');
    document.getElementById('nav_subtab_finanzas')?.classList.add('d-none');
    document.getElementById('nav_subtab_gastos')?.classList.add('d-none');
    document.getElementById('nav_subtab_form_pago')?.classList.add('d-none');
    document.getElementById('nav_subtab_form_gasto')?.classList.add('d-none');
  }
}
