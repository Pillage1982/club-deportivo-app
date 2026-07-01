// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {

    window.location.href = 'login.html';

    return;

  }

  const rol =
    obtenerRolActual();

  const puedeVerOperacion =
    rol === 'admin' || rol === 'entrenador';

  const puedeVerFinanzas =
    rol === 'admin' || rol === 'tesorero';

  aplicarConfiguracionVisual();
  mostrarUsuario();
  aplicarRolesFrontend();
  aplicarRolesTabs();

  cargarPersonas();
  cargarTablaPersonas();

  configurarBuscadorPersonas();
  configurarFiltrosEventos();
  configurarFiltrosPagos();
  configurarFiltrosCuotas();
  configurarFiltrosFinanzas();

  if (puedeVerOperacion) {
    cargarEventos();
    cargarAsistencias();
    cargarTablaEventos();
  }

  if (puedeVerFinanzas) {
    cargarMultas();
    cargarFinanzas();
    cargarGraficos();
    cargarTablaPagos();
    cargarCuotas();
  }

  cargarDashboard();

};

function aplicarRolesTabs() {
  const rol = obtenerRolActual();
  const puedeVerOperacion = rol === 'admin' || rol === 'entrenador';
  const puedeVerFinanzas = rol === 'admin' || rol === 'tesorero';

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
