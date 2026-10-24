const finanzasModel = require('../models/finanzasModel');

exports.listar = (req, res) => {

  finanzasModel.obtenerEstadoFinanciero((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);

  });

};

// =====================================
// FICHA DE HISTORIAL FINANCIERO DE UN INTEGRANTE
// =====================================
// ?alcance=anio (por defecto): cuotas y pagos desde el 1 de enero del año en curso.
// ?alcance=todo: todo el historial. La deuda del resumen es siempre la actual.
const DESDE_TODO = '1900-01-01';

function consultar(fn, ...args) {
  return new Promise((resolve, reject) => fn(...args, (err, data) => (err ? reject(err) : resolve(data))));
}

exports.historialPersona = async (req, res) => {
  const personaId = Number(req.params.persona_id);
  if (!Number.isInteger(personaId) || personaId <= 0) {
    return res.status(400).json({ mensaje: 'Integrante no válido' });
  }

  try {
    const persona = await consultar(finanzasModel.obtenerDatosPersona, personaId);
    if (!persona) return res.status(404).json({ mensaje: 'Integrante no encontrado' });

    const alcance = req.query.alcance === 'todo' ? 'todo' : 'anio';
    const desde = alcance === 'todo' ? DESDE_TODO : `${new Date().getFullYear()}-01-01`;

    const [resumen, cuotas, pagos] = await Promise.all([
      consultar(finanzasModel.obtenerResumenDeuda, personaId),
      consultar(finanzasModel.obtenerCuotas, personaId, desde),
      consultar(finanzasModel.obtenerPagos, personaId, desde)
    ]);

    const totalMultas = Number(resumen.total_multas) || 0;
    const totalCuotas = Number(resumen.total_cuotas) || 0;
    const totalPagado = Number(resumen.total_pagado) || 0;
    const totalOtros = pagos
      .filter(p => (p.tipo_pago || 'cuota') !== 'cuota')
      .reduce((suma, p) => suma + Number(p.monto_total), 0);

    res.json({
      persona,
      alcance,
      desde: alcance === 'todo' ? null : desde,
      resumen: {
        total_multas: totalMultas,
        total_cuotas: totalCuotas,
        total_pagado_cuotas: totalPagado,
        deuda: totalMultas + totalCuotas - totalPagado,
        total_pagos_otros: totalOtros
      },
      cuotas,
      pagos
    });
  } catch (err) {
    console.error('Error obteniendo historial financiero:', err);
    res.status(500).json({ mensaje: 'No se pudo obtener el historial financiero' });
  }
};
