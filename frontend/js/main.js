// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {

    window.location.href = 'login.html';

    return;

  }

  aplicarConfiguracionVisual();
  cargarPersonas();
  cargarEventos();
  cargarAsistencias();
  cargarMultas();
  cargarFinanzas();
  cargarDashboard();
  cargarGraficos();
  mostrarUsuario();
  aplicarRolesFrontend();
  cargarTablaPersonas();
  configurarBuscadorPersonas();
  cargarTablaEventos();
  cargarTablaPagos();
  cargarCuotas();

};
