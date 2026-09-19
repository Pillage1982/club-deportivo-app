// Controlador de datos propios del Portal del Socio: ficha, finanzas y
// asistencia del socio autenticado (req.socio.persona_id, ver authSocioMiddleware).
// Ningún endpoint aquí acepta ni expone datos de otro persona_id.
//
// Sin módulo de puntaje en esta rama (es específico de cliente/calamena): no hay
// endpoint mi-puntaje aquí.
const socioDataModel = require('../models/socioDataModel');

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
// MI FINANZAS: deuda actual + historial de cuotas, pagos y multas
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

        socioDataModel.obtenerHistorialMultas(personaId, (errMultas, multas) => {
          if (errMultas) {
            console.error('Error obteniendo multas del socio:', errMultas);
            return res.status(500).json({ mensaje: 'Error al obtener finanzas' });
          }

          const totalMultas = Number(resumen.total_multas) || 0;
          const totalCuotas = Number(resumen.total_cuotas) || 0;
          const totalPagado = Number(resumen.total_pagado) || 0;

          res.json({
            // Misma fórmula que vista_estado_financiero: multas SÍ suman a la deuda.
            deuda_actual: totalMultas + totalCuotas - totalPagado,
            total_multas: totalMultas,
            total_cuotas: totalCuotas,
            total_pagado: totalPagado,
            cuotas,
            pagos,
            multas
          });
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
