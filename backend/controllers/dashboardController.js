// Controlador HTTP del dashboard: entrega el resumen consolidado preparado por dashboardModel.
const dashboardModel = require('../models/dashboardModel');

const ROLES_BALANCE = ['admin', 'tesorero'];

// Balance general del club (caja): todo lo que entró (pagos de socios +
// ingresos de terceros) contra todo lo que salió (gastos). Se calcula en cada
// consulta sobre las tablas vivas, así que siempre refleja el último registro.
function armarBalance(fila) {
  const pagosSocios     = Number(fila.total_pagos_socios || 0);
  const ingresosTerceros = Number(fila.total_ingresos_terceros || 0);
  const gastos          = Number(fila.total_gastos || 0);
  const totalIngresos   = pagosSocios + ingresosTerceros;

  return {
    pagos_socios: pagosSocios,
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

    const { total_pagos_socios, total_ingresos_terceros, total_gastos, ...resumen } = results[0];

    // El entrenador también usa el dashboard, pero no debe ver montos de caja
    if (ROLES_BALANCE.includes(req.usuario && req.usuario.rol)) {
      resumen.balance = armarBalance({ total_pagos_socios, total_ingresos_terceros, total_gastos });
    }

    res.json(resumen);

  });

};
