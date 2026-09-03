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

  verificarExpiracionToken();
  aplicarConfiguracionVisual();
  mostrarUsuario();
  aplicarRolesFrontend();

  cargarPersonas();
  cargarTablaPersonas();

  configurarBuscadorPersonas();
  configurarFiltrosEventos();
  configurarFiltrosPagos();
  configurarFiltrosCuotas();
  configurarFiltrosAsistencias();
  configurarFiltrosGastos();
  configurarFiltrosIngresos();
  configurarFiltrosActas();

  if (puedeVerOperacion) {
    cargarEventos();
    cargarAsistencias();
    cargarTablaEventos();
  }

  if (puedeVerFinanzas) {
    cargarTablaPagos();
    cargarCuotas();
    cargarTablaGastos();
    cargarTablaIngresos();
  }

  // Lectura de actas abierta a todos los roles (no solo financieros/operación);
  // el selector de reuniones disponibles solo lo necesita quien puede crear (admin)
  if (rol === 'admin') {
    cargarEventosDisponiblesActa();
  }
  cargarTablaActas();

  cargarDashboard();

};
