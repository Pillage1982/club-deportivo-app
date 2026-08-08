#!/usr/bin/env node
'use strict';

const path = require('path');
const { parseMembers, parseFinances, parseAttendance, parsePositions, ATTENDANCE_CUTOFF } = require('./excel');
const { parsePeopleSnapshot } = require('./snapshot');
const { compareMembers, indexByRut, reconcileAttendanceRuts } = require('./core');
const { generateReports } = require('./reports');
const { PERIODS, periodKey, allocatePaymentsToQuotas } = require('./paymentAllocation');

function args(argv) { const out = {}; for (const arg of argv) { const match = arg.match(/^--([^=]+)(?:=(.*))?$/); if (match) out[match[1]] = match[2] ?? true; } return out; }
function required(options, key) { if (!options[key]) throw new Error(`Falta --${key}=<ruta>`); return path.resolve(options[key]); }
function groupEvents(rows) {
  const map = new Map(); for (const row of rows) { const key=row.evento_origen_id || row.fecha; if (!map.has(key)) map.set(key, []); map.get(key).push(row); }
  return [...map.entries()].map(([eventId, marks]) => { const date=marks[0].fecha; return ({ evento_origen_id:eventId, nombre_evento: marks[0].evento, contexto_evento:marks[0].contexto_evento || '', fila_inicio_evento:marks[0].fila_inicio_evento || '', fila_fin_evento:Math.max(...marks.map(x=>x.fila_origen)), fecha_primera_marcacion: marks.map(x=>x.fecha_hora).sort()[0],
    fecha_ultima_marcacion: marks.map(x=>x.fecha_hora).sort().at(-1), cantidad_marcaciones: marks.length,
    cantidad_integrantes_unicos: new Set(marks.map(x=>x.rut).filter(Boolean)).size, incluido_en_temporada: marks[0].incluido,
    hora_disponible: marks.some(x=>x.hora_disponible),
    motivo_exclusion: marks[0].incluido ? 'Incluido; nombre del evento pendiente' : date < ATTENDANCE_CUTOFF ? 'Anterior al evento inicial 10-10-2025' : 'Posterior al último registro real de junio de 2026' }); }).sort((a,b)=>a.fecha_primera_marcacion.localeCompare(b.fecha_primera_marcacion) || a.fila_inicio_evento-b.fila_inicio_evento);
}
function calculateScores(people, attendance, payments) {
  const scores = new Map(); const add = (rut, points) => scores.set(rut, (scores.get(rut) || 0) + points);
  const allocation = allocatePaymentsToQuotas(payments, people);
  const paidQuotas = new Set(allocation.quotaStatus
    .filter(row => row.estado_cuota === 'pagado')
    .map(row => `${row.rut}|${row.cuota_periodo}`));
  const isCurrent = (rut, period) => {
    const target = PERIODS.findIndex(item => periodKey(item.year, item.month) === period);
    if (target < 0) return false;
    return PERIODS.slice(0, target + 1).every(item => paidQuotas.has(`${rut}|${periodKey(item.year, item.month)}`));
  };
  for (const mark of attendance) add(mark.rut, isCurrent(mark.rut, mark.fecha.slice(0,7)) ? 10 : 5);

  const quotaAllocations = new Map();
  for (const row of allocation.allocations.filter(item => item.cuota_periodo !== 'EXCEDENTE')) {
    const key = `${row.rut}|${row.cuota_periodo}`;
    if (!quotaAllocations.has(key)) quotaAllocations.set(key, []);
    quotaAllocations.get(key).push(row);
  }
  for (const [key, rows] of quotaAllocations) {
    if (!paidQuotas.has(key)) continue;
    const completion = rows.at(-1);
    if (completion.oportunidad === 'anticipado') add(completion.rut, 20);
    if (completion.oportunidad === 'oportuno') add(completion.rut, 10);
  }
  const annualBonusRuts = new Set();
  for (const payment of payments.filter(item => Number(item.monto) >= 120000)) {
    const rows = allocation.allocations.filter(item =>
      item.referencia_externa_pago === payment.referencia_externa && item.cuota_periodo !== 'EXCEDENTE'
    );
    const totalAssigned = rows.reduce((sum, item) => sum + Number(item.monto_asignado || 0), 0);
    const coveredPeriods = new Set(rows.filter(item => Number(item.monto_asignado) > 0).map(item => item.cuota_periodo));
    if (totalAssigned === 120000 && coveredPeriods.size === PERIODS.length) annualBonusRuts.add(payment.rut);
  }
  for (const rut of annualBonusRuts) add(rut, 100);
  return scores;
}

function run(argv = process.argv.slice(2)) {
  const options = args(argv); if (options.apply) throw new Error('--apply está preparado pero requiere BD, respaldo y confirmación explícita; ejecute primero --dry-run.');
  if (!options['dry-run']) throw new Error('Por seguridad debe indicar --dry-run.');
  if ((options.organization || '').toLowerCase() !== 'gdc') throw new Error('Esta rama monocliente sólo admite --organization=gdc.');
  const files = { members: required(options,'members-file'), payments: required(options,'payments-file'), attendance: required(options,'attendance-file'), positions: required(options,'positions-file') };
  const reportDir = path.resolve(options['report-dir'] || 'reports/gdc'); const snapshot = required(options,'db-snapshot');
  const db = parsePeopleSnapshot(snapshot), members = parseMembers(files.members), finance = parseFinances(files.payments), attendanceRaw = parseAttendance(files.attendance), positions = parsePositions(files.positions);
  const rutReconciliation = reconcileAttendanceRuts(attendanceRaw, [
    ...db.map(row=>({...row,source:'BD'})), ...members.map(row=>({...row,source:'NOMINA'})),
    ...finance.rows.map(row=>({...row,source:'FINANZAS'})), ...positions.map(row=>({...row,source:'POSICIONES'}))
  ]);
  const attendance = rutReconciliation.rows;
  const validAttendance = attendance.filter(x=>x.incluido && x.rut_valido); const dbIndex = indexByRut(db); const seen = new Map(), duplicates = [], duplicateReferences = new Set();
  for (const row of validAttendance) {
    const key = `${row.rut}|${row.evento_origen_id}`;
    const retained = seen.get(key);
    if (retained) { duplicateReferences.add(row.referencia_externa); duplicates.push({ ...row, duplicado_de_fila: retained.fila_origen, registro_conservado: retained.referencia_externa, motivo_exclusion: 'RUT repetido dentro del mismo evento delimitado por Demo' }); }
    else seen.set(key, row);
  }
  const cleanAttendance = validAttendance.filter(row => !duplicateReferences.has(row.referencia_externa)); const events = groupEvents(attendance);
  const lastJune = events.filter(x=>x.fecha_primera_marcacion.startsWith('2026-06')).at(-1) || null;
  const initialEvent = events.find(x=>x.fecha_primera_marcacion.startsWith(ATTENDANCE_CUTOFF)) || null;
  const comparison = compareMembers({ db, members, finances: finance.rows, attendance: cleanAttendance, positions });
  const invalidRuts = [...members, ...finance.rows, ...attendance, ...positions].filter(x=>!x.rut_valido);
  const financeByRut = indexByRut(finance.rows);
  const paymentReason = payment => {
    const person = dbIndex.get(payment.rut)?.[0]; const financial = financeByRut.get(payment.rut)?.[0];
    if (!payment.rut_valido) return 'RUT inválido';
    if (!person) return 'RUT sin integrante en BD';
    if (payment.no_aplica && !(person.es_honorario || String(person.estado).toLowerCase()==='receso' || /honorario|receso/i.test(String(financial?.estado||'')))) return 'No aplica sin condición honorario/receso';
    if (payment.no_aplica) return 'No aplica validado; no genera pago';
    if (payment.monto == null) return 'Texto no convertible a monto';
    return '';
  };
  const reviewedPayments = finance.payments.map(p=>({...p,motivo_revision:paymentReason(p)}));
  const paymentReview = reviewedPayments.filter(p => p.motivo_revision);
  const payments = reviewedPayments.filter(p => !p.motivo_revision);
  const paymentAllocation = allocatePaymentsToQuotas(payments, finance.rows);
  const memberIndex = indexByRut(members), financeMemberIndex = indexByRut(finance.rows), positionMemberIndex = indexByRut(positions);
  const attendanceUnmatched = cleanAttendance.filter(row=>!dbIndex.has(row.rut)).map(row => {
    const sources = [];
    if (memberIndex.has(row.rut)) sources.push('NOMINA');
    if (financeMemberIndex.has(row.rut)) sources.push('FINANZAS');
    if (positionMemberIndex.has(row.rut)) sources.push('POSICIONES');
    const action = sources.includes('NOMINA') ? 'VINCULAR_TRAS_CREAR_DESDE_NOMINA'
      : sources.length ? 'REVISION_MANUAL_CON_RESPALDO_OTRO_DOCUMENTO' : 'REVISION_MANUAL_SIN_RESPALDO';
    return { ...row, fuentes_cruce_integrante: sources.join(', '), accion_recomendada_integrante: action };
  });
  const unmatchedUnique = [...new Map(attendanceUnmatched.map(row=>[row.rut,row])).values()];
  const scores = calculateScores(db, cleanAttendance, payments);
  const scoreComparison = db.map(person => { const system=scores.get(person.rut)||0; return { temporada:'2025-2026',rut:person.rut,integrante:person.nombre,bloque:person.bloque,
    puntaje_sistema_preliminar:system,posicion_sistema_preliminar:'',puntaje_planilla_referencia:'NO APLICA',posicion_planilla_referencia:'NO APLICA',
    diferencia:'NO APLICA',coincide:'NO APLICA',estado_validacion:'PENDIENTE DE MIGRACION Y CALCULO EN BD',
    observacion:'Planilla Posiciones 2025 se usa sólo como referencia de estructura y presentación; sus valores no se comparan con la temporada 2025-2026.'}; });
  [...scoreComparison].sort((a,b)=>b.puntaje_sistema_preliminar-a.puntaje_sistema_preliminar).forEach((r,i)=>{r.posicion_sistema_preliminar=i+1;});
  const summary = { modo:'dry-run', organization:'gdc', fuente_bd:snapshot, archivos:files, integrantes_creados:comparison.filter(x=>x.accion_recomendada==='CREAR').length,
    integrantes_actualizados:comparison.filter(x=>x.accion_recomendada==='ACTUALIZAR').length, integrantes_omitidos:comparison.filter(x=>x.accion_recomendada==='SOLO_EN_BD').length,
    integrantes_en_revision:comparison.filter(x=>/REVISAR|SOLO_/.test(x.accion_recomendada)).length,pagos_importados:payments.length,pagos_omitidos:paymentReview.length,
    pagos_con_diferencias:paymentReview.length,asistencias_importadas:cleanAttendance.length,asistencias_duplicadas:duplicates.length,
    cuotas_periodo:10,monto_anual_cuotas:120000,monto_cuota_mensual:12000,
    periodo_financiero:'2025-10 a 2026-07',
    bonificacion_pago_anual:100,
    politica_fecha_pago_temporada:'Cada monto se considera pagado el dia 1 del mes de la columna de origen; fecha inferida, exclusiva para 2025-2026.',
    asignaciones_pago_cuota:paymentAllocation.allocations.filter(row=>row.cuota_periodo!=='EXCEDENTE').length,
    pagos_con_excedente:paymentAllocation.allocations.filter(row=>row.cuota_periodo==='EXCEDENTE').length,
    cuotas_pagadas_calculadas:paymentAllocation.quotaStatus.filter(row=>row.estado_cuota==='pagado').length,
    cuotas_parciales_calculadas:paymentAllocation.quotaStatus.filter(row=>row.estado_cuota==='parcial').length,
    asistencias_rut_corregido_por_cruce:rutReconciliation.corrected.filter(x=>x.incluido).length,
    asistencias_rut_sin_resolver:rutReconciliation.unresolved.filter(x=>x.incluido).length,
    asistencias_sin_integrante:attendanceUnmatched.length,
    integrantes_asistencia_sin_bd_unicos:unmatchedUnique.length,
    integrantes_asistencia_respaldados_nomina:unmatchedUnique.filter(x=>x.fuentes_cruce_integrante.includes('NOMINA')).length,
    integrantes_asistencia_respaldados_otro_documento:unmatchedUnique.filter(x=>x.fuentes_cruce_integrante && !x.fuentes_cruce_integrante.includes('NOMINA')).length,
    integrantes_asistencia_sin_respaldo_documental:unmatchedUnique.filter(x=>!x.fuentes_cruce_integrante).length,
    politica_hora_representativa:'Evento único: sábado 15:00, otro día 18:00. Varios eventos en la misma fecha: 15:00 y siguientes cada 2 horas según orden de bloques Demo.',
    politica_duplicados:'Conservar la primera marcación por RUT dentro de cada evento delimitado por Demo; excluir repeticiones posteriores',evento_inicial_10_10_2025:initialEvent,
    ultimo_evento_junio_2026:lastJune,errores:invalidRuts.length,
    advertencias:['No se escribió en la base de datos.','Asistencia no contiene nombres de evento.',
      initialEvent ? 'Se encontraron marcaciones del evento inicial 10-10-2025; su nombre queda pendiente.' : 'No hay marcaciones fechadas 10-10-2025 en el Excel de asistencia.',
      lastJune ? 'Se detectó el último registro real de junio de 2026.' : 'No hay registros fechados en junio de 2026; no se inventó un cierre.',
      'Planilla de posiciones se usa sólo como referencia estructural para el resultado 2025-2026; no se comparan sus puntajes históricos.','Los pagos se fechan convencionalmente el día 1 del mes informado; esta fecha es inferida y no debe reutilizarse en otra temporada.'],
    uso_planilla_posiciones:'Referencia de estructura y presentación para generar el resultado actual 2025-2026; no es fuente maestra ni objetivo numérico.' };
  generateReports(reportDir,{comparison,invalidRuts,attendanceValid:cleanAttendance,attendanceBefore:attendance.filter(x=>x.fecha<ATTENDANCE_CUTOFF),attendanceDuplicates:duplicates,
    attendanceInvalid:attendance.filter(x=>!x.rut_valido),attendanceRutCorrected:rutReconciliation.corrected.filter(x=>x.incluido),attendanceUnmatched,events,scoreComparison,payments,paymentReview,
    paymentAllocations:paymentAllocation.allocations,quotaStatus:paymentAllocation.quotaStatus,summary});
  console.log(JSON.stringify({reportDir, ...summary}, null, 2)); return summary;
}

if (require.main === module) { try { run(); } catch (error) { console.error(error.message); process.exitCode=1; } }
module.exports = { run, groupEvents, calculateScores };
