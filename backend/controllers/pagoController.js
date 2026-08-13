// Controlador HTTP de pagos: valida operaciones y coordina personas, cuotas vinculadas y puntaje.
// =====================================
// MODELO PAGOS
// =====================================

const pagoModel    = require('../models/pagoModel');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');
const puntajeModel = require('../models/puntajeModel');
const { PERIODOS_CUOTAS_2025_2026, esPagoAnualInicioCiclo } = require('../utils/estatutoGdcRules');

function calcularPuntosCuota(mes, anio) {
  const hoy     = new Date();
  const mesHoy  = hoy.getMonth() + 1;
  const anioHoy = hoy.getFullYear();

  const anticipado = anioHoy < anio || (anioHoy === anio && mesHoy < mes);
  const oportuno   = anioHoy === anio && mesHoy === mes;
  const meses = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  if (anticipado) return { puntos: 20, detalle: `Cuota ${meses[mes]} ${anio} pagada anticipadamente` };
  if (oportuno)   return { puntos: 10, detalle: `Cuota ${meses[mes]} ${anio} pagada oportunamente` };
  return null; // fuera de plazo — sin puntaje
}

function procesarPuntajeCuota(persona_id, cuota_id) {
  cuotaModel.obtenerCuotaPorId(cuota_id, (err, cuota) => {
    if (err || !cuota) return;
    const resultado = calcularPuntosCuota(cuota.mes, cuota.anio);
    if (!resultado) return;
    const fecha = new Date().toISOString().substring(0, 10);
    puntajeModel.insertarPuntajeCuota({
      persona_id, cuota_id, puntos: resultado.puntos,
      detalle: resultado.detalle, fecha
    }).catch(e => console.error('Error puntaje cuota:', e));
  });
}

function recalcularAsistenciasPersona(personaId) {
  return puntajeModel.eliminarPuntajesAsistenciasAusentes(personaId)
    .then(() => puntajeModel.recalcularPuntajesAsistencia(personaId))
    .catch(error => console.error('Error recalculando puntaje de asistencias:', error));
}

// Puntaje del pago anual (varias cuotas en un solo pago): si cubre las 10 cuotas
// de la temporada y ocurre antes o durante el mes de inicio del ciclo, aplica el
// escenario (a) del art. 9.3 -bono de anticipado en las 10, incluida la de inicio-.
// Si no, cada cuota recibe su puntaje individual normal (igual que un pago suelto).
function procesarPuntajeCuotasAnual(persona_id, cuotas) {
  const periodosPagados = cuotas.map(c => ({ mes: Number(c.mes), anio: Number(c.anio) }));
  const esAnualInicio = esPagoAnualInicioCiclo(periodosPagados, PERIODOS_CUOTAS_2025_2026, new Date());
  const fecha = new Date().toISOString().substring(0, 10);

  cuotas.forEach(cuota => {
    const resultado = esAnualInicio
      ? { puntos: 20, detalle: 'Cuota pagada anticipadamente (art. 9.3, pago anual al inicio)' }
      : calcularPuntosCuota(Number(cuota.mes), Number(cuota.anio));
    if (!resultado) return;
    puntajeModel.insertarPuntajeCuota({
      persona_id, cuota_id: cuota.id, puntos: resultado.puntos,
      detalle: resultado.detalle, fecha
    }).catch(e => console.error('Error puntaje cuota anual:', e));
  });
}

  const metodosPermitidos = [
  'efectivo',
  'transferencia',
  'debito'
];

function validarPago(body) {
  const personaId = Number(body.persona_id);
  const monto = Number(body.monto_total);
  const metodo = body.metodo ? body.metodo.trim() : '';

  if (!Number.isInteger(personaId) || personaId <= 0) {
    return 'Seleccione un integrante valido';
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    return 'Ingrese un monto mayor a 0';
  }

  if (!metodosPermitidos.includes(metodo)) {
    return 'Seleccione un metodo de pago valido';
  }

  return null;
}

  // =====================================
  // REGISTRAR PAGO
  // =====================================

  exports.crear = (req, res) => {

      const errorValidacion = validarPago(req.body);

  if (errorValidacion) {
    return res.status(400).json({
      mensaje: errorValidacion
    });
  }

  personaModel.obtenerPersonaPorId(Number(req.body.persona_id), (errPersona, persona) => {
    if (errPersona || !persona) {
      return res.status(400).json({ mensaje: 'Integrante no encontrado' });
    }

    if (persona.es_honorario) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de pagos' });
    }

    const cuotaId = req.body.cuota_id ? Number(req.body.cuota_id) : null;
    const guardar = cuota => pagoModel.crearPago(req.body, (err, result) => {
      if (err) return res.status(500).json(err);
      if (!cuota) return res.json({ mensaje: 'Pago registrado' });
      pagoModel.crearDetalleCuota(result.insertId, cuota.id, Number(req.body.monto_total), errDetalle => {
        if (errDetalle) {
          return pagoModel.eliminarPago(result.insertId, () => res.status(500).json({ mensaje: 'No se pudo vincular el pago a la cuota' }));
        }
        const completa = Number(req.body.monto_total) === Number(cuota.saldo);
        if (!completa) return res.json({ mensaje: `Pago parcial registrado. Saldo pendiente: $${Number(cuota.saldo)-Number(req.body.monto_total)}` });
        cuotaModel.marcarCuotaPagada(cuota.id, errC => {
          if (errC) return res.status(500).json({ mensaje: 'Pago registrado, pero no se pudo cerrar la cuota' });
          procesarPuntajeCuota(Number(req.body.persona_id), cuota.id);
          recalcularAsistenciasPersona(Number(req.body.persona_id));
          res.json({ mensaje: 'Pago registrado y cuota marcada como pagada' });
        });
      });
    });
    if (!cuotaId) return guardar(null);
    cuotaModel.obtenerCuotaConSaldo(cuotaId, (errCuota, cuota) => {
      if (errCuota || !cuota) return res.status(400).json({ mensaje: 'Cuota no encontrada' });
      if (Number(cuota.persona_id) !== Number(req.body.persona_id)) return res.status(400).json({ mensaje: 'La cuota no pertenece al integrante seleccionado' });
      if (Number(cuota.saldo) <= 0 || cuota.estado === 'pagado') return res.status(409).json({ mensaje: 'La cuota ya está pagada' });
      if (Number(req.body.monto_total) > Number(cuota.saldo)) return res.status(400).json({ mensaje: `El monto supera el saldo de la cuota ($${cuota.saldo})` });
      guardar(cuota);
    });
  });

};

// =====================================
// REGISTRAR PAGO ANUAL (varias cuotas en un solo pago)
// =====================================
// Requiere que las cuotas de los meses cubiertos ya existan (ver
// POST /cuotas/generar-temporada). El monto debe cubrir exactamente la suma de
// los saldos de las cuotas seleccionadas: no admite pagos parciales de un anual.

exports.crearAnual = (req, res) => {

  const errorValidacion = validarPago(req.body);
  if (errorValidacion) {
    return res.status(400).json({ mensaje: errorValidacion });
  }

  const cuotaIds = Array.isArray(req.body.cuota_ids)
    ? [...new Set(req.body.cuota_ids.map(Number).filter(Number.isInteger))]
    : [];

  if (cuotaIds.length < 2) {
    return res.status(400).json({ mensaje: 'Seleccione al menos dos cuotas para un pago anual' });
  }

  personaModel.obtenerPersonaPorId(Number(req.body.persona_id), (errPersona, persona) => {
    if (errPersona || !persona) {
      return res.status(400).json({ mensaje: 'Integrante no encontrado' });
    }
    if (persona.es_honorario) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de pagos' });
    }

    cuotaModel.obtenerCuotasConSaldoPorIds(cuotaIds, (errCuotas, cuotas) => {
      if (errCuotas) return res.status(500).json({ mensaje: 'No se pudieron verificar las cuotas' });
      if (cuotas.length !== cuotaIds.length) {
        return res.status(400).json({ mensaje: 'Alguna cuota seleccionada no existe' });
      }
      const ajena = cuotas.find(c => Number(c.persona_id) !== Number(req.body.persona_id));
      if (ajena) {
        return res.status(400).json({ mensaje: 'Todas las cuotas deben pertenecer al integrante seleccionado' });
      }
      const yaPagada = cuotas.find(c => c.estado === 'pagado' || Number(c.saldo) <= 0);
      if (yaPagada) {
        return res.status(409).json({ mensaje: `La cuota ${yaPagada.mes}/${yaPagada.anio} ya está pagada` });
      }

      const sumaSaldos = cuotas.reduce((suma, c) => suma + Number(c.saldo), 0);
      if (Number(req.body.monto_total) !== sumaSaldos) {
        return res.status(400).json({
          mensaje: `El monto debe ser exactamente $${sumaSaldos} (suma de saldos de las cuotas seleccionadas)`
        });
      }

      pagoModel.crearPago(req.body, (errPago, resultPago) => {
        if (errPago) return res.status(500).json(errPago);
        const pagoId = resultPago.insertId;

        let pendientes  = cuotas.length;
        let huboError   = false;

        cuotas.forEach(cuota => {
          pagoModel.crearDetalleCuota(pagoId, cuota.id, Number(cuota.saldo), errDetalle => {
            if (huboError) return;
            if (errDetalle) {
              huboError = true;
              return pagoModel.eliminarPago(pagoId, () =>
                res.status(500).json({ mensaje: 'No se pudo vincular el pago a las cuotas' }));
            }
            cuotaModel.marcarCuotaPagada(cuota.id, errMarcar => {
              if (huboError) return;
              if (errMarcar) {
                huboError = true;
                return res.status(500).json({ mensaje: 'Pago registrado, pero no se pudieron cerrar todas las cuotas' });
              }
              pendientes--;
              if (pendientes === 0) {
                procesarPuntajeCuotasAnual(Number(req.body.persona_id), cuotas);
                recalcularAsistenciasPersona(Number(req.body.persona_id));
                res.json({ mensaje: `Pago anual registrado: ${cuotas.length} cuota(s) marcadas como pagadas` });
              }
            });
          });
        });
      });
    });
  });

};

// =====================================
// LISTAR PAGOS
// =====================================

exports.obtener = (req, res) => {

  pagoModel.obtenerPagos(

    (err, results) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Devuelve historial pagos
      res.json(results);

    }

  );

};

// =====================================
// REPORTE DE PAGOS DE CUOTAS (para exportaciones Excel/PDF)
// =====================================
// Pagos agrupados por el mes REAL en que se hicieron (no el mes de la cuota
// cubierta) + total de puntos generados por pagos de cuotas por persona.

exports.obtenerReporteCuotas = (req, res) => {
  pagoModel.obtenerPagosCuotaPorMesReal((err, pagosPorMes) => {
    if (err) return res.status(500).json(err);
    puntajeModel.obtenerPuntosCuotasPorPersona()
      .then(puntosCuotas => res.json({ pagosPorMes, puntosCuotas }))
      .catch(() => res.status(500).json({ mensaje: 'No se pudieron obtener los puntos de cuotas' }));
  });
};

// =====================================
// ACTUALIZAR PAGO
// =====================================

exports.actualizar = (req, res) => {

  const errorValidacion = validarPago(req.body);

  if (errorValidacion) {
    return res.status(400).json({
      mensaje: errorValidacion
    });
  }

  pagoModel.tieneDetalles(req.params.id, (errDetalle, tieneDetalle) => {
    if (errDetalle) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    if (tieneDetalle) return res.status(409).json({ mensaje: 'Los pagos vinculados a cuotas no se pueden editar; registre un ajuste separado' });
    pagoModel.actualizarPago(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Confirma actualización frontend
      res.json({
        mensaje: 'Pago actualizado'
      });

    }

    );
  });

};

// =====================================
// ELIMINAR PAGO
// =====================================

exports.eliminar = (req, res) => {
  pagoModel.tieneDetalles(req.params.id, (errDetalle, tieneDetalle) => {
    if (errDetalle) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    if (tieneDetalle) return res.status(409).json({ mensaje: 'Los pagos vinculados a cuotas no se pueden eliminar; registre un ajuste separado' });
    pagoModel.eliminarPago(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      // Confirma eliminación frontend
      res.json({
        mensaje: 'Pago eliminado'
      });

    }

    );
  });

};
