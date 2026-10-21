// Controlador HTTP financiero de solo lectura: expone el estado consolidado por integrante.
const finanzasModel = require('../models/finanzasModel');
const socioDataModel = require('../models/socioDataModel');
const puntajeModel = require('../models/puntajeModel');

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
// ?alcance=temporada (por defecto): desde el inicio de la temporada vigente, igual
// que el Portal del Integrante. ?alcance=todo: todo el historial.
// Reutiliza las consultas del Portal: deuda calculada por cuota, cuotas con lo
// abonado y pagos con lo que cubrió cada uno.
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

    const alcance = req.query.alcance === 'todo' ? 'todo' : 'temporada';
    const desde = alcance === 'todo' ? DESDE_TODO : await puntajeModel.obtenerInicioTemporadaVigente();

    const [resumen, cuotas, pagos] = await Promise.all([
      consultar(socioDataModel.obtenerResumenDeuda, personaId, desde),
      consultar(socioDataModel.obtenerHistorialCuotas, personaId, desde),
      consultar(socioDataModel.obtenerHistorialPagos, personaId, desde)
    ]);

    const totalCuotas = Number(resumen.total_cuotas) || 0;
    const totalPagado = Number(resumen.total_pagado) || 0;
    const totalExtras = pagos
      .filter(p => (p.tipo_pago || 'cuota') !== 'cuota')
      .reduce((suma, p) => suma + Number(p.monto_total), 0);

    res.json({
      persona,
      alcance,
      desde: alcance === 'todo' ? null : desde,
      resumen: {
        total_cuotas: totalCuotas,
        total_pagado_cuotas: totalPagado,
        deuda: totalCuotas - totalPagado,
        total_pagos_extra: totalExtras
      },
      cuotas,
      pagos
    });
  } catch (err) {
    console.error('Error obteniendo historial financiero:', err);
    res.status(500).json({ mensaje: 'No se pudo obtener el historial financiero' });
  }
};
