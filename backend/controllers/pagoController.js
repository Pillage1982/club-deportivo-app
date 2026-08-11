// Controlador HTTP de pagos: valida operaciones y coordina personas, cuotas vinculadas y puntaje.
// =====================================
// MODELO PAGOS
// =====================================

const pagoModel    = require('../models/pagoModel');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');
const puntajeModel = require('../models/puntajeModel');

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
