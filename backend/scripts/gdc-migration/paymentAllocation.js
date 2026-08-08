'use strict';

const PERIODS = [
  { month: 10, year: 2025, amount: 12000 }, { month: 11, year: 2025, amount: 12000 },
  { month: 12, year: 2025, amount: 12000 }, { month: 1, year: 2026, amount: 12000 },
  { month: 2, year: 2026, amount: 12000 }, { month: 3, year: 2026, amount: 12000 },
  { month: 4, year: 2026, amount: 12000 }, { month: 5, year: 2026, amount: 12000 },
  { month: 6, year: 2026, amount: 12000 }, { month: 7, year: 2026, amount: 12000 }
];

function periodKey(year, month) { return `${year}-${String(month).padStart(2, '0')}`; }
function periodIndex(year, month) { return PERIODS.findIndex(period => period.year === year && period.month === month); }

function allocatePaymentsToQuotas(payments, financialMembers = []) {
  const memberByRut = new Map(financialMembers.filter(row => row.rut).map(row => [row.rut, row]));
  const eligibleRuts = new Set([
    ...payments.map(payment => payment.rut),
    ...financialMembers.filter(row => row.rut_valido && !/honorario|receso/i.test(String(row.estado || ''))).map(row => row.rut)
  ]);
  const allocations = [], quotaStatus = [];
  for (const rut of [...eligibleRuts].sort()) {
    const member = memberByRut.get(rut) || {};
    const quotas = PERIODS.map((period, index) => ({ ...period, index, paid: 0, remaining: period.amount }));
    const movements = payments.filter(payment => payment.rut === rut && Number(payment.monto) > 0)
      .sort((left, right) => periodIndex(left.anio, left.mes) - periodIndex(right.anio, right.mes) || left.fila_origen - right.fila_origen);
    for (const payment of movements) {
      let available = Number(payment.monto);
      const paymentIndex = periodIndex(payment.anio, payment.mes);
      for (const quota of quotas) {
        if (available <= 0) break;
        if (quota.remaining <= 0) continue;
        const assigned = Math.min(available, quota.remaining);
        quota.paid += assigned; quota.remaining -= assigned; available -= assigned;
        const timing = paymentIndex < quota.index ? 'anticipado' : paymentIndex === quota.index ? 'oportuno' : 'atrasado';
        allocations.push({ rut, integrante: member.nombre || payment.nombre || '', pago_periodo: periodKey(payment.anio, payment.mes),
          pago_monto_original: payment.monto, cuota_periodo: periodKey(quota.year, quota.month), monto_cuota: quota.amount,
          monto_asignado: assigned, oportunidad: timing, referencia_externa_pago: payment.referencia_externa,
          archivo_origen: payment.archivo_origen, hoja_origen: payment.hoja_origen, fila_origen: payment.fila_origen,
          valor_original: payment.valor_original });
      }
      if (available > 0) allocations.push({ rut, integrante: member.nombre || payment.nombre || '', pago_periodo: periodKey(payment.anio, payment.mes),
        pago_monto_original: payment.monto, cuota_periodo: 'EXCEDENTE', monto_cuota: 0, monto_asignado: available,
        oportunidad: 'revision_excedente', referencia_externa_pago: payment.referencia_externa, archivo_origen: payment.archivo_origen,
        hoja_origen: payment.hoja_origen, fila_origen: payment.fila_origen, valor_original: payment.valor_original });
    }
    for (const quota of quotas) quotaStatus.push({ rut, integrante: member.nombre || '', bloque: member.bloque || '', cuota_periodo: periodKey(quota.year, quota.month),
      monto_cuota: quota.amount, monto_pagado: quota.paid, saldo_cuota: quota.remaining,
      estado_cuota: quota.remaining === 0 ? 'pagado' : quota.paid > 0 ? 'parcial' : 'pendiente' });
  }
  return { allocations, quotaStatus };
}

module.exports = { PERIODS, periodKey, periodIndex, allocatePaymentsToQuotas };
