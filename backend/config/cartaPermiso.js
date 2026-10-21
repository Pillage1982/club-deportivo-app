// Carta de permiso para el colegio (heredada de la versión base, oct-2026).
// DESHABILITADA en la Unión Morenada Centralista hasta que la agrupación entregue
// su propia carta (texto, firmante, timbre, sitio web): ver
// documentacion/pendientes_morenada.md. Con habilitada: false las rutas responden
// 404 y el Portal y el panel ocultan la opción. Debe coincidir con
// frontend/js/config.js → cartaPermiso.habilitada.
//
// La firma del presidente es real: no se versiona y vive en UPLOADS_DIR (fuera de
// la app, el zip de despliegue la borraría). Subirla a <UPLOADS_DIR>/firmas/.
// Sin la firma no se puede aprobar ninguna carta.
const path = require('path');
const { rutaUpload } = require('./uploads');
const CLIENTE = require('./cliente');

const ASSETS = path.join(__dirname, '..', 'assets');

module.exports = Object.freeze({
  habilitada: false,
  // Años de devoción: cumplidos desde la fundación a la fecha de la carta.
  fechaFundacion: '2000-09-09',
  ciudad: CLIENTE.ciudadCarta,
  // Pendientes de la agrupación (ver bitácora).
  sitioWeb: '',
  firmante: {
    nombre: '',
    cargo: 'Presidente'
  },
  // Roles que aprueban o rechazan (exactos: los directores no).
  rolesAprueban: ['admin', 'secretaria'],
  // Rango máximo del permiso, en días (la fiesta dura alrededor de una semana).
  diasMaximoPermiso: 31,
  rutaFirma: () => rutaUpload('firmas/firma_presidente.png'),
  // Timbre de la agrupación: pendiente (backend/assets/timbre.png).
  rutaTimbre: path.join(ASSETS, 'timbre.png'),
  rutaLogo: path.join(__dirname, '..', '..', 'frontend', 'img', CLIENTE.logo),
  fuentes: {
    texto: path.join(ASSETS, 'fonts', 'LibreCaslonText_400Regular.ttf'),
    textoNegrita: path.join(ASSETS, 'fonts', 'LibreCaslonText_700Bold.ttf'),
    membrete: path.join(ASSETS, 'fonts', 'Poppins-SemiBold.ttf'),
    membreteNormal: path.join(ASSETS, 'fonts', 'Poppins-Regular.ttf')
  }
});
