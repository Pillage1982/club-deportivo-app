'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calcularPuntosAsistencia,
  ordenarFormacionEstatutaria,
  esBailarinNuevo,
  primerSabadoDeJunio,
  calcularPuntajeEnsayos,
  POLITICA_TEMPORADA_2025_2026,
  PERIODOS_CUOTAS_2025_2026,
  esPagoAnualInicioCiclo
} = require('../../utils/estatutoGdcRules');

test('articulo 8.4 aplica puntajes exactos de asistencia', () => {
  assert.equal(calcularPuntosAsistencia('presente', true).puntos, 10);
  assert.equal(calcularPuntosAsistencia('presente', false).puntos, 5);
  assert.equal(calcularPuntosAsistencia('atrasado', true).puntos, 7);
  assert.equal(calcularPuntosAsistencia('atrasado', false).puntos, 3);
  assert.equal(calcularPuntosAsistencia('justificado', true).puntos, 5);
  assert.equal(calcularPuntosAsistencia('justificado', false).puntos, 1);
  assert.equal(calcularPuntosAsistencia('vestimenta_distinta', true).puntos, 3);
  assert.equal(calcularPuntosAsistencia('vestimenta_distinta', false).puntos, 1);
  assert.equal(calcularPuntosAsistencia('licencia_medica', false).puntos, 6);
  assert.equal(calcularPuntosAsistencia('retiro_sin_aviso', true).puntos, -3);
  assert.equal(calcularPuntosAsistencia('ausente', true), null);
});

test('temporada 2025-2026 inicia ensayos el primer sabado de junio', () => {
  assert.equal(primerSabadoDeJunio(2026), '2026-06-06');
  assert.equal(POLITICA_TEMPORADA_2025_2026.primer_ensayo_general, '2026-06-06');
});

test('division de ensayos por tres usa redondeo convencional', () => {
  assert.equal(calcularPuntajeEnsayos([10, 7]), 6); // 5,666...
  assert.equal(calcularPuntajeEnsayos([7, 6]), 4);  // 4,333...
  assert.equal(calcularPuntajeEnsayos([10, 5]), 5); // exacto
});

test('politica 2025-2026 excluye Ayquina y fija Condor', () => {
  assert.equal(POLITICA_TEMPORADA_2025_2026.considerar_ayquina, false);
  assert.equal(POLITICA_TEMPORADA_2025_2026.bloque_posicion_fija, 'condor');
  assert.equal(POLITICA_TEMPORADA_2025_2026.monto_anual, 120000);
});

test('articulo 9.1.1 e considera nuevo desde septiembre de la temporada', () => {
  assert.equal(esBailarinNuevo('2024-09-01', 2024, '2025-08-31'), true);
  assert.equal(esBailarinNuevo('2025-03-15', 2024, '2025-08-31'), true);
  assert.equal(esBailarinNuevo('2023-08-31', 2024, '2025-08-31'), false);
});

test('tambien considera nuevo a quien aun no cumple un ano al corte', () => {
  assert.equal(esBailarinNuevo('2024-08-15', 2024, '2025-08-01'), true);
  assert.equal(esBailarinNuevo('2024-08-01', 2024, '2025-08-01'), false);
  assert.equal(esBailarinNuevo(null, 2024, '2025-08-01'), false);
});

test('articulo 9.3 escenario a: pagar las 10 cuotas antes del inicio del ciclo cuenta como pago anual', () => {
  const hoyAntesDeOctubre = new Date('2025-09-15T12:00:00Z');
  const hoyMismoMesInicio = new Date('2025-10-31T12:00:00Z');
  assert.equal(esPagoAnualInicioCiclo(PERIODOS_CUOTAS_2025_2026, PERIODOS_CUOTAS_2025_2026, hoyAntesDeOctubre), true);
  assert.equal(esPagoAnualInicioCiclo(PERIODOS_CUOTAS_2025_2026, PERIODOS_CUOTAS_2025_2026, hoyMismoMesInicio), true);
});

test('articulo 9.3 escenario a: no aplica si el mes de inicio ya paso o falta algun periodo', () => {
  const hoyDespuesDeOctubre = new Date('2025-11-05T12:00:00Z');
  assert.equal(esPagoAnualInicioCiclo(PERIODOS_CUOTAS_2025_2026, PERIODOS_CUOTAS_2025_2026, hoyDespuesDeOctubre), false);

  const periodosIncompletos = PERIODOS_CUOTAS_2025_2026.slice(0, 9);
  assert.equal(esPagoAnualInicioCiclo(periodosIncompletos, PERIODOS_CUOTAS_2025_2026, new Date('2025-09-15T12:00:00Z')), false);
});

test('articulo 9.1.3 alterna ranking entre sectores A y B', () => {
  const ranking = Array.from({ length: 36 }, (_, index) => ({ id: index + 1 }));
  const formacion = ordenarFormacionEstatutaria(ranking);
  assert.deepEqual(
    formacion.map(item => item.posicion_ranking),
    [1,3,5,7,9,11,12,10,8,6,4,2,13,15,17,19,21,23,24,22,20,18,16,14,25,27,29,31,33,35,36,34,32,30,28,26]
  );
});
