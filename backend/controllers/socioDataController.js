// Controlador de datos propios del Portal del Socio: ficha, finanzas, asistencia y
// puntaje del socio autenticado (req.socio.persona_id, ver authSocioMiddleware).
// Ningún endpoint aquí acepta ni expone datos de otro persona_id.
const socioDataModel = require('../models/socioDataModel');
const puntajeModel = require('../models/puntajeModel');

// =====================================
// MI FICHA
// =====================================
exports.miFicha = (req, res) => {
  const personaId = req.socio.persona_id;

  socioDataModel.obtenerFicha(personaId, (err, ficha) => {
    if (err) {
      console.error('Error obteniendo ficha del socio:', err);
      return res.status(500).json({ mensaje: 'Error al obtener la ficha' });
    }
    if (!ficha) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }
    res.json(ficha);
  });
};

// =====================================
// MI FINANZAS: deuda actual + historial de cuotas y pagos
// =====================================
exports.miFinanzas = (req, res) => {
  const personaId = req.socio.persona_id;

  socioDataModel.obtenerResumenDeuda(personaId, (errDeuda, resumen) => {
    if (errDeuda) {
      console.error('Error obteniendo deuda del socio:', errDeuda);
      return res.status(500).json({ mensaje: 'Error al obtener finanzas' });
    }

    socioDataModel.obtenerHistorialCuotas(personaId, (errCuotas, cuotas) => {
      if (errCuotas) {
        console.error('Error obteniendo cuotas del socio:', errCuotas);
        return res.status(500).json({ mensaje: 'Error al obtener finanzas' });
      }

      socioDataModel.obtenerHistorialPagos(personaId, (errPagos, pagos) => {
        if (errPagos) {
          console.error('Error obteniendo pagos del socio:', errPagos);
          return res.status(500).json({ mensaje: 'Error al obtener finanzas' });
        }

        const totalCuotas = Number(resumen.total_cuotas) || 0;
        const totalPagado = Number(resumen.total_pagado) || 0;

        res.json({
          deuda_actual: totalCuotas - totalPagado,
          total_cuotas: totalCuotas,
          total_pagado: totalPagado,
          cuotas,
          pagos
        });
      });
    });
  });
};

// =====================================
// MI ASISTENCIA
// =====================================
exports.miAsistencia = (req, res) => {
  const personaId = req.socio.persona_id;

  socioDataModel.obtenerHistorialAsistencia(personaId, (err, asistencias) => {
    if (err) {
      console.error('Error obteniendo asistencia del socio:', err);
      return res.status(500).json({ mensaje: 'Error al obtener asistencia' });
    }
    res.json(asistencias);
  });
};

// =====================================
// MI PUNTAJE: desglose propio + posición en el ranking general (sin exponer a
// otros socios). Reutiliza el mismo ranking que ve el admin, filtrando después
// de calcularlo — no hay una query separada "solo para uno" que pueda desalinearse.
// =====================================
exports.miPuntaje = (req, res) => {
  const personaId = req.socio.persona_id;

  Promise.all([
    puntajeModel.obtenerRankingPorTemporada(null, null),
    puntajeModel.obtenerHistorial(personaId)
  ])
    .then(([ranking, historial]) => {
      const indice = ranking.findIndex(fila => fila.id === personaId);

      if (indice === -1) {
        // Integrante inactivo/receso o sin fecha_ingreso válida: el ranking solo
        // incluye activos (misma regla que el ranking del admin). Se devuelve el
        // historial igual, sin posición.
        return res.json({
          posicion: null,
          total_integrantes: ranking.length,
          puntos_antiguedad: 0,
          puntos_cuotas: 0,
          puntos_asistencia: 0,
          puntaje_total: 0,
          historial
        });
      }

      const fila = ranking[indice];

      res.json({
        posicion: indice + 1,
        total_integrantes: ranking.length,
        puntos_antiguedad: Number(fila.puntos_antiguedad) || 0,
        puntos_cuotas: Number(fila.puntos_cuotas) || 0,
        puntos_asistencia: Number(fila.puntos_asistencia) || 0,
        puntaje_total: Number(fila.puntaje_total) || 0,
        historial
      });
    })
    .catch(err => {
      console.error('Error obteniendo puntaje del socio:', err);
      res.status(500).json({ mensaje: 'Error al obtener puntaje' });
    });
};
