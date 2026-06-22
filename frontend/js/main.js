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
