// Saldo a favor: la parte de un pago de cuota que no quedó asignada a ninguna cuota
// (pagó más de lo pendiente, o pagó antes de que se generaran las cuotas). Se aplica
// a las cuotas pendientes más antiguas del mismo integrante, igual que un pago sin
// meses marcados: las que alcanza a cubrir quedan pagadas y la siguiente con abono.
const db = require('../config/db');
const puntajeModel = require('../models/puntajeModel');
const { calcularPuntosCuota, fechaPuntajeCuota, recalcularAsistenciasPersona } = require('../utils/puntajeCuotas');

function consultar(conexion, sql, params = []) {
  return new Promise((resolve, reject) => {
    conexion.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

// La BD entrega fechas como texto 'YYYY-MM-DD HH:MM:SS': se toma el día y se fija
// a mediodía de Chile para que el cálculo de puntaje use ese mismo día.
function fechaDelPago(fecha) {
  const dia = String(fecha || '').substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00-04:00`) : new Date();
}

// Reparte los saldos sobre las cuotas, de la más antigua a la más reciente, usando
// primero el pago más antiguo. Devuelve una fila por cada monto aplicado.
function calcularAplicaciones(saldos, cuotas) {
  const cuotasPorPersona = new Map();
  cuotas.forEach(c => {
    if (!cuotasPorPersona.has(c.persona_id)) cuotasPorPersona.set(c.persona_id, []);
    cuotasPorPersona.get(c.persona_id).push({ ...c, saldo: Number(c.saldo) });
  });

  const aplicaciones = [];
  saldos.forEach(pago => {
    let disponible = Number(pago.sobrante);
    const pendientes = cuotasPorPersona.get(pago.persona_id) || [];

    for (const cuota of pendientes) {
      if (disponible <= 0) break;
      if (cuota.saldo <= 0) continue;
      const monto = Math.min(disponible, cuota.saldo);
      cuota.saldo -= monto;
      disponible -= monto;
      aplicaciones.push({
        pago_id: pago.pago_id,
        persona_id: pago.persona_id,
        fecha_pago: pago.fecha,
        cuota_id: cuota.id,
        mes: Number(cuota.mes),
        anio: Number(cuota.anio),
        monto,
        completa: cuota.saldo === 0
      });
    }
  });
  return aplicaciones;
}

// { personaId }: solo ese integrante (por defecto, todos).
// { simular: true }: calcula sin escribir nada (vista previa para confirmar).
exports.aplicarSaldosAFavor = ({ personaId = null, simular = false } = {}) =>
  new Promise((resolve, reject) => {
    db.getConnection((errConexion, conexion) => {
      if (errConexion) return reject(errConexion);

      const cerrar = err => ((err && err.fatal) ? conexion.destroy() : conexion.release());
      const fallar = err => conexion.rollback(() => { cerrar(err); reject(err); });

      conexion.beginTransaction(async errTx => {
        if (errTx) { cerrar(errTx); return reject(errTx); }
        try {
          const saldos = await consultar(conexion, `
            SELECT pa.id AS pago_id, pa.persona_id, pa.fecha,
                   pa.monto_total - COALESCE(SUM(d.monto_pagado), 0) AS sobrante
            FROM pagos pa
            LEFT JOIN pago_detalle d ON d.pago_id = pa.id
            WHERE pa.tipo_pago = 'cuota'${personaId ? ' AND pa.persona_id = ?' : ''}
            GROUP BY pa.id, pa.persona_id, pa.fecha, pa.monto_total
            HAVING sobrante > 0
            ORDER BY pa.persona_id, pa.fecha, pa.id
          `, personaId ? [personaId] : []);

          if (!saldos.length) {
            conexion.rollback(() => cerrar());
            return resolve({ aplicaciones: [], simulado: simular });
          }

          const personas = [...new Set(saldos.map(s => s.persona_id))];
          const cuotas = await consultar(conexion, `
            SELECT c.id, c.persona_id, c.mes, c.anio,
                   GREATEST(c.monto - COALESCE(SUM(d.monto_pagado), 0), 0) AS saldo
            FROM cuotas c
            LEFT JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
            WHERE c.persona_id IN (?) AND c.estado IN ('pendiente', 'vencido')
            GROUP BY c.id, c.persona_id, c.mes, c.anio, c.monto
            HAVING saldo > 0
            ORDER BY c.persona_id, c.anio, c.mes
          `, [personas]);

          const aplicaciones = calcularAplicaciones(saldos, cuotas);

          if (simular || !aplicaciones.length) {
            conexion.rollback(() => cerrar());
            return resolve({ aplicaciones, simulado: simular });
          }

          for (const a of aplicaciones) {
            await consultar(conexion,
              "INSERT INTO pago_detalle (pago_id, tipo, referencia_id, monto_pagado) VALUES (?, 'cuota', ?, ?)",
              [a.pago_id, a.cuota_id, a.monto]);
            if (a.completa) {
              await consultar(conexion,
                "UPDATE cuotas SET estado = 'pagado' WHERE id = ? AND estado IN ('pendiente', 'vencido')",
                [a.cuota_id]);
            }
          }

          conexion.commit(errCommit => {
            if (errCommit) return fallar(errCommit);
            cerrar();
            registrarPuntaje(aplicaciones);
            resolve({ aplicaciones, simulado: false });
          });
        } catch (err) {
          fallar(err);
        }
      });
    });
  });

// Puntaje de cada cuota que quedó pagada, según la fecha del pago que la cubrió
// (un saldo a favor es plata pagada por adelantado). Sin bloquear la respuesta.
function registrarPuntaje(aplicaciones) {
  const personas = new Set();
  aplicaciones.filter(a => a.completa).forEach(a => {
    personas.add(a.persona_id);
    const fechaPago = fechaDelPago(a.fecha_pago);
    const resultado = calcularPuntosCuota(a.mes, a.anio, fechaPago);
    if (!resultado) return;
    puntajeModel.insertarPuntajeCuota({
      persona_id: a.persona_id,
      cuota_id: a.cuota_id,
      puntos: resultado.puntos,
      detalle: `${resultado.detalle} (saldo a favor)`,
      fecha: fechaPuntajeCuota(a, fechaPago)
    }).catch(e => console.error('Error puntaje saldo a favor:', e));
  });
  personas.forEach(id => recalcularAsistenciasPersona(id));
}

// Resumen para mostrar al usuario: monto total, integrantes y cuotas.
// Una cuota puede recibir montos de varios pagos: cuenta como pagada si alguno la
// completó, y como abonada solo si quedó incompleta.
exports.resumir = aplicaciones => {
  const pagadas = new Set(aplicaciones.filter(a => a.completa).map(a => a.cuota_id));
  const abonadas = new Set(aplicaciones.filter(a => !pagadas.has(a.cuota_id)).map(a => a.cuota_id));
  return {
    monto: aplicaciones.reduce((suma, a) => suma + a.monto, 0),
    integrantes: new Set(aplicaciones.map(a => a.persona_id)).size,
    cuotas_pagadas: pagadas.size,
    cuotas_abonadas: abonadas.size
  };
};

exports._calcularAplicaciones = calcularAplicaciones; // para pruebas
