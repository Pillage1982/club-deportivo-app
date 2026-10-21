// Carta de permiso para el colegio (Fiesta de la Virgen de Guadalupe de Ayquina).
// Texto calcado de la carta oficial de 2023; estilo del mockup aprobado por el
// cliente (documentacion/carta_permiso_colegio/ESPECIFICACION.md).
//
// La firma del presidente es real: no se versiona y vive en UPLOADS_DIR (fuera de
// la app, el zip de despliegue la borraría). Subirla a <UPLOADS_DIR>/firmas/.
// Sin la firma no se puede aprobar ninguna carta.
const path = require('path');
const { rutaUpload } = require('./uploads');

const ASSETS = path.join(__dirname, '..', 'assets');

module.exports = Object.freeze({
  // Años de devoción: cumplidos desde la fundación a la fecha de la carta.
  fechaFundacion: '1961-10-22',
  ciudad: 'Calama',
  sitioWeb: 'www.grandiabladacalameña.cl',
  firmante: {
    nombre: 'Jorge Luis Montalbán Cofre',
    cargo: 'Presidente'
  },
  // Roles que aprueban o rechazan (exactos: los directores no).
  rolesAprueban: ['admin', 'secretaria'],
  // Rango máximo del permiso, en días (la fiesta dura alrededor de una semana).
  diasMaximoPermiso: 31,
  rutaFirma: () => rutaUpload('firmas/firma_presidente.png'),
  rutaTimbre: path.join(ASSETS, 'timbre_gdc.png'),
  rutaLogo: path.join(__dirname, '..', '..', 'frontend', 'img', 'logo-calamena.jpeg'),
  fuentes: {
    texto: path.join(ASSETS, 'fonts', 'LibreCaslonText_400Regular.ttf'),
    textoNegrita: path.join(ASSETS, 'fonts', 'LibreCaslonText_700Bold.ttf'),
    membrete: path.join(ASSETS, 'fonts', 'Poppins-SemiBold.ttf'),
    membreteNormal: path.join(ASSETS, 'fonts', 'Poppins-Regular.ttf')
  }
});
