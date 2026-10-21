// Puntaje por pago de cuotas (Art. 9.2/9.3 Estatutos GDC 2016), compartido por el
// registro de pagos y la aplicación de saldos a favor.
const puntajeModel = require('../models/puntajeModel');

const NOMBRES_MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// 'YYYY-MM-DD' en hora de Chile.
function fechaChile(fecha = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(fecha);
}

// Puntos de una cuota según cuándo se pagó (`fechaPago`, por defecto hoy):
// antes de su mes +20 (anticipado), en su mes +10 (oportuno), después 0.
function calcularPuntosCuota(mes, anio, fechaPago = new Date()) {
  const [anioPago, mesPago] = fechaChile(fechaPago).split('-').map(Number);
  mes = Number(mes);
  anio = Number(anio);

  const anticipado = anioPago < anio || (anioPago === anio && mesPago < mes);
  const oportuno   = anioPago === anio && mesPago === mes;

  if (anticipado) return { puntos: 20, detalle: `Cuota ${NOMBRES_MES[mes]} ${anio} pagada anticipadamente` };
  if (oportuno)   return { puntos: 10, detalle: `Cuota ${NOMBRES_MES[mes]} ${anio} pagada oportunamente` };
  return null; // fuera de plazo — sin puntaje
}

// Fecha (hora de Chile) con que se registra el puntaje de una cuota: la del pago,
// pero nunca antes del 1 de octubre de la temporada de esa cuota. Así una cuota de
// la temporada pagada por adelantado antes de la Misa a la Chilena (inicio de
// temporada) suma en el ranking de su temporada y no queda fuera del corte.
function fechaPuntajeCuota(cuota, fechaPago = new Date()) {
  const fecha = fechaChile(fechaPago);
  const anioInicio = Number(cuota.mes) >= 10 ? Number(cuota.anio) : Number(cuota.anio) - 1;
  const inicioTemporada = `${anioInicio}-10-01`;
  return fecha > inicioTemporada ? fecha : inicioTemporada;
}

// El puntaje de asistencia depende de tener la cuota al día: se recalcula cuando
// cambian las cuotas pagadas del integrante.
function recalcularAsistenciasPersona(personaId) {
  return puntajeModel.eliminarPuntajesAsistenciasAusentes(personaId)
    .then(() => puntajeModel.recalcularPuntajesAsistencia(personaId))
    .catch(error => console.error('Error recalculando puntaje de asistencias:', error));
}

module.exports = {
  calcularPuntosCuota,
  fechaPuntajeCuota,
  recalcularAsistenciasPersona
};
