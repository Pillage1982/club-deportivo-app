// Primer ingreso del Portal del Socio en el servidor (no solo en el frontend):
// mientras el socio no cree su PIN y no complete "Actualizar datos", la API no
// entrega su ficha, finanzas, asistencia ni puntaje. Va después de
// authSocioMiddleware (necesita req.socio). Responde 403 con `codigo` para que
// el frontend redirija a la pantalla que corresponde.
const socioAuthModel = require('../models/socioAuthModel');

function exigirPerfilSocio({ datos = true } = {}) {
  return (req, res, next) => {
    socioAuthModel.obtenerEstadoPerfil(req.socio.persona_id, (err, estado) => {
      if (err) {
        console.error('Error verificando estado del perfil del socio:', err);
        return res.status(500).json({ mensaje: 'Error al verificar el acceso' });
      }
      if (!estado || Number(estado.pin_cambiado) !== 1) {
        return res.status(403).json({ codigo: 'PIN_PENDIENTE', mensaje: 'Debes crear tu PIN antes de continuar' });
      }
      if (datos && Number(estado.datos_actualizados) !== 1) {
        return res.status(403).json({ codigo: 'DATOS_PENDIENTES', mensaje: 'Debes actualizar tus datos antes de continuar' });
      }
      next();
    });
  };
}

module.exports = exigirPerfilSocio;
