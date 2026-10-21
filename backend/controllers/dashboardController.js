// Controlador HTTP del dashboard: entrega el resumen consolidado preparado por dashboardModel.
const dashboardModel = require('../models/dashboardModel');

const { rolBase } = require('../config/roles');
const ROLES_BALANCE = ['admin', 'tesorero'];

// Balance general del club (caja): el saldo del año anterior (ingresado a mano)
// más todo lo que entró (pagos de socios + pagos de inscripción de nuevos
// integrantes + ingresos de terceros) contra todo lo que salió (gastos). Se
// calcula en cada consulta sobre las tablas vivas, así que siempre refleja el
// último registro.
function armarBalance(fila) {
  const saldoAnterior   = Number(fila.saldo_anio_anterior || 0);
  const pagosSocios     = Number(fila.total_pagos_socios || 0);
  const pagosIntegracion = Number(fila.total_pagos_integracion || 0);
  const ingresosTerceros = Number(fila.total_ingresos_terceros || 0);
  const gastos          = Number(fila.total_gastos || 0);
  const totalIngresos   = saldoAnterior + pagosSocios + pagosIntegracion + ingresosTerceros;

  return {
    saldo_anio_anterior: saldoAnterior,
    pagos_socios: pagosSocios,
    pagos_integracion: pagosIntegracion,
    ingresos_terceros: ingresosTerceros,
    total_ingresos: totalIngresos,
    total_egresos: gastos,
    saldo_caja: totalIngresos - gastos
  };
}

exports.resumen = (req, res) => {

  dashboardModel.obtenerResumen((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    const { total_pagos_socios, total_pagos_integracion, total_ingresos_terceros, total_gastos, saldo_anio_anterior, ...resumen } = results[0];

    // El entrenador también usa el dashboard, pero no debe ver montos de caja
    if (ROLES_BALANCE.includes(rolBase(req.usuario && req.usuario.rol))) {
      resumen.balance = armarBalance({ total_pagos_socios, total_pagos_integracion, total_ingresos_terceros, total_gastos, saldo_anio_anterior });
    }

    res.json(resumen);

  });

};

// Saldo del año anterior (dinero heredado de la directiva anterior). Pesos
// enteros; puede ser negativo si se heredó una deuda.
exports.guardarSaldoAnioAnterior = (req, res) => {
  const monto = Number(req.body && req.body.monto);

  if (!Number.isFinite(monto) || Math.abs(monto) > 9999999999) {
    return res.status(400).json({ mensaje: 'Ingrese un monto válido' });
  }

  dashboardModel.guardarSaldoAnioAnterior(Math.round(monto), req.usuario && req.usuario.usuario, err => {
    if (err) {
      console.error('Error guardando saldo del año anterior:', err);
      return res.status(500).json({ mensaje: 'No se pudo guardar el saldo del año anterior' });
    }

    res.json({ mensaje: 'Saldo del año anterior actualizado' });
  });
};
