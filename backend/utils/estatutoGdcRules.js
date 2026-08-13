'use strict';

// Estatuto GDC 2016, articulo 8.4.
function calcularPuntosAsistencia(estado, cuotaAlDia) {
  const conCuota = Boolean(cuotaAlDia);
  const reglas = {
    presente: [10, 5, 'Presente'],
    atrasado: [7, 3, 'Atraso'],
    justificado: [5, 1, 'Justificación'],
    vestimenta_distinta: [3, 1, 'Vestimenta distinta']
  };
  if (reglas[estado]) {
    const [alDia, sinCuota, nombre] = reglas[estado];
    return {
      puntos: conCuota ? alDia : sinCuota,
      detalle: `${nombre} ${conCuota ? '+ cuota al día' : 'sin cuota al día'}`
    };
  }
  if (estado === 'licencia_medica') return { puntos: 6, detalle: 'Licencia médica' };
  if (estado === 'retiro_sin_aviso') return { puntos: -3, detalle: 'Retiro sin aviso' };
  return null;
}

// Estatuto GDC 2016, articulo 9.1.3: seis impares ascendentes en sector A
// y seis pares descendentes en sector B por cada fila de 12 bailarines.
function ordenarFormacionEstatutaria(ranking) {
  const resultado = [];
  for (let inicio = 1; inicio <= ranking.length; inicio += 12) {
    const fin = Math.min(inicio + 11, ranking.length);
    const impares = [];
    const pares = [];
    for (let posicion = inicio; posicion <= fin; posicion += 1) {
      (posicion % 2 ? impares : pares).push(posicion);
    }
    for (const posicionRanking of [...impares, ...pares.reverse()]) {
      resultado.push({
        ...ranking[posicionRanking - 1],
        posicion_ranking: posicionRanking,
        sector: posicionRanking % 2 ? 'A' : 'B'
      });
    }
  }
  return resultado;
}

function fechaUtc(valor) {
  const texto = String(valor || '').substring(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return null;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

// Acuerdo operativo para aplicar el articulo 9.1.1 e. La temporada comienza
// el 1 de septiembre del primer ano indicado.
function esBailarinNuevo(fechaIngreso, anioInicioTemporada, fechaCorte) {
  const ingreso = fechaUtc(fechaIngreso);
  const corte = fechaUtc(fechaCorte);
  const anio = Number(anioInicioTemporada);
  if (!ingreso || !corte || !Number.isInteger(anio)) return false;

  const inicioTemporada = new Date(Date.UTC(anio, 8, 1));
  const cumpleUnAnio = new Date(ingreso.getTime());
  cumpleUnAnio.setUTCFullYear(cumpleUnAnio.getUTCFullYear() + 1);

  return ingreso >= inicioTemporada || cumpleUnAnio > corte;
}

function primerSabadoDeJunio(anio) {
  const fecha = new Date(Date.UTC(Number(anio), 5, 1));
  const diasHastaSabado = (6 - fecha.getUTCDay() + 7) % 7;
  fecha.setUTCDate(fecha.getUTCDate() + diasHastaSabado);
  return fecha.toISOString().substring(0, 10);
}

// Acuerdo operativo 2025-2026: redondeo convencional del resultado total de
// ensayos dividido por tres (decimal 5 o mayor sube; 4 o menor baja).
function calcularPuntajeEnsayos(puntosEnsayos) {
  const total = (puntosEnsayos || []).reduce((suma, puntos) => suma + Number(puntos || 0), 0);
  return Math.round(total / 3);
}

const POLITICA_TEMPORADA_2025_2026 = Object.freeze({
  inicio: '2025-09-01',
  fin: '2026-08-31',
  primer_ensayo_general: primerSabadoDeJunio(2026),
  monto_anual: 120000,
  cuotas: 10,
  monto_cuota: 12000,
  considerar_ayquina: false,
  eventos_provisionales_puntuan: false,
  bloque_posicion_fija: 'condor',
  ajuste_caporal_requiere_asamblea: true
});

// Art. 9.3: los 10 periodos de cuota de la temporada vigente. Se actualiza cada
// temporada (ver tambien POLITICA_TEMPORADA_2025_2026 y PERIODOS_FINANCIEROS_GDC
// en frontend/js/reportes.js, que deben moverse juntos al pasar de temporada).
const PERIODOS_CUOTAS_2025_2026 = Object.freeze([
  { mes: 10, anio: 2025 }, { mes: 11, anio: 2025 }, { mes: 12, anio: 2025 },
  { mes: 1, anio: 2026 }, { mes: 2, anio: 2026 }, { mes: 3, anio: 2026 },
  { mes: 4, anio: 2026 }, { mes: 5, anio: 2026 }, { mes: 6, anio: 2026 }, { mes: 7, anio: 2026 }
]);

// Art. 9.3, escenario (a) de la tabla de simulacion de pagos: cancelar las cuotas
// completas de la temporada al inicio del ciclo anual otorga el bono de anticipado
// a las 10 cuotas -incluida la del propio mes de inicio- en vez del calculo mes a
// mes (200 puntos totales en vez de 100 oportuno + 90 anticipado).
function esPagoAnualInicioCiclo(periodosPagados, periodosTemporada, fechaHoy) {
  if (!Array.isArray(periodosPagados) || periodosPagados.length !== periodosTemporada.length) return false;
  const cubreTemporadaCompleta = periodosTemporada.every(periodo =>
    periodosPagados.some(p => Number(p.mes) === periodo.mes && Number(p.anio) === periodo.anio)
  );
  if (!cubreTemporadaCompleta) return false;
  const [primerPeriodo] = periodosTemporada;
  const anioHoy = fechaHoy.getFullYear();
  const mesHoy  = fechaHoy.getMonth() + 1;
  return anioHoy < primerPeriodo.anio || (anioHoy === primerPeriodo.anio && mesHoy <= primerPeriodo.mes);
}

const PONDERACION_BLOQUES = Object.freeze({
  'naupas - chinas naupas (satanas)': 100,
  'huari (luciferes)': 90,
  'chinas supay': 80,
  jukumari: 70,
  'virtudes - pecados': 60,
  tentaciones: 50,
  'doble cara': 40,
  diablesas: 30,
  diablos: 20,
  "k'achas viudas - yana conciencia": 10
});

module.exports = {
  calcularPuntosAsistencia,
  ordenarFormacionEstatutaria,
  esBailarinNuevo,
  primerSabadoDeJunio,
  calcularPuntajeEnsayos,
  POLITICA_TEMPORADA_2025_2026,
  PONDERACION_BLOQUES,
  PERIODOS_CUOTAS_2025_2026,
  esPagoAnualInicioCiclo
};
