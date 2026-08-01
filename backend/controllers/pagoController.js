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

    // Inserta pago en base datos
    pagoModel.crearPago(req.body, (err, result) => {
      if (err) return res.status(500).json(err);

      const cuota_id = req.body.cuota_id ? Number(req.body.cuota_id) : null;

      if (cuota_id) {
        cuotaModel.marcarCuotaPagada(cuota_id, (errC) => {
          if (errC) console.error('Error marcando cuota:', errC);
        });
        procesarPuntajeCuota(Number(req.body.persona_id), cuota_id);
        return res.json({ mensaje: 'Pago registrado y cuota marcada como pagada' });
      }

      res.json({ mensaje: 'Pago registrado' });
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
