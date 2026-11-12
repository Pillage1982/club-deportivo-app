// Puntaje por pago de cuotas (Art. 9.2/9.3 Estatutos GDC 2016), compartido por el
// registro de pagos y la aplicación de saldos a favor.
const puntajeModel = require('../models/puntajeModel');

const NOMBRES_MES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// 'YYYY-MM-DD' en hora de Chile. Si `fecha` ya es una fecha de calendario
// ('YYYY-MM-DD…', p. ej. la del comprobante que declara el integrante), se usa tal
// cual, sin convertir zona horaria (evita que una fecha de fin de mes retroceda un
// día al interpretarla como UTC).
function fechaChile(fecha = new Date()) {
  if (typeof fecha === 'string') {
    const m = fecha.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(fecha);
}

// Normaliza la fecha real del pago que llega del formulario (la del comprobante):
// 'YYYY-MM-DD', nunca en el futuro ni absurda. Si falta o es inválida, usa hoy
// (hora de Chile). Es la base del PUNTAJE de cuota, no de la caja (pagos.fecha).
function normalizarFechaPago(valor) {
  const hoy = fechaChile();
  if (typeof valor !== 'string') return hoy;
  const m = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return hoy;
  const fecha = m[1];
  if (fecha > hoy) return hoy;          // un pago no se hace "mañana"
  if (fecha < '2015-01-01') return hoy; // fecha absurda
  return fecha;
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
  normalizarFechaPago,
  recalcularAsistenciasPersona
};
