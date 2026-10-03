// Multas por atraso e inasistencia. La agrupación no las aplica por ahora
// (oct-2026): con `habilitadas: false` no se generan al registrar asistencia ni
// al cerrar una actividad. Para reactivarlas, cambiar a true aquí y en
// APP_CONFIG.multas (frontend/js/config.js), que las vuelve a mostrar.
module.exports = Object.freeze({
  habilitadas: false
});
