// =====================================
// MODELO PAGOS
// =====================================

const pagoModel    = require('../models/pagoModel');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');

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

  const cuota_id = req.body.cuota_id ? Number(req.body.cuota_id) : null;

  personaModel.obtenerPersonaPorId(Number(req.body.persona_id), (errPersona, persona) => {
    if (errPersona || !persona) {
      return res.status(400).json({ mensaje: 'Integrante no encontrado' });
    }

    if (persona.es_honorario) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de pagos' });
    }

    const continuarConPago = () => {
      // Inserta pago en base datos
      pagoModel.crearPago(

      req.body,

      // Manejo errores backend pagos
      (err, result) => {

        if (err) {

          return res.status(500).json(err);

        }

        if (!cuota_id) {
          return res.json({ mensaje: 'Pago registrado' });
        }

        cuotaModel.marcarCuotaPagada(cuota_id, (errC) => {
          if (errC) {
            console.error('Error marcando cuota:', errC);
            return res.status(500).json({ mensaje: 'Pago registrado, pero no se pudo marcar la cuota como pagada' });
          }
          res.json({ mensaje: 'Pago registrado y cuota marcada como pagada' });
        });

      }

    );
    };

    if (!cuota_id) {
      return continuarConPago();
    }

    // Verifica que la cuota exista y pertenezca al integrante del pago antes
    // de vincularla, para no marcar como pagada una cuota de otra persona.
    cuotaModel.obtenerCuotaPorId(cuota_id, (errCuota, cuota) => {
      if (errCuota) {
        return res.status(500).json({ mensaje: 'Error al verificar la cuota' });
      }
      if (!cuota || Number(cuota.persona_id) !== Number(req.body.persona_id)) {
        return res.status(400).json({ mensaje: 'La cuota seleccionada no corresponde a este integrante' });
      }
      continuarConPago();
    });

  }); // obtenerPersonaPorId

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

  // Actualiza registro pago existente
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

};

// =====================================
// ELIMINAR PAGO
// =====================================

exports.eliminar = (req, res) => {

  // Elimina pago desde base datos
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

};