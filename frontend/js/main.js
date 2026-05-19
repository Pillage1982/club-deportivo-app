// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {

    window.location.href = 'login.html';

    return;

  }

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
  cargarTablaEventos();
  cargarTablaPagos();

};