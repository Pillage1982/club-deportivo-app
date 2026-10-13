// Controlador HTTP de pagos: valida operaciones y coordina personas, cuotas vinculadas y puntaje.
// =====================================
// MODELO PAGOS
// =====================================

const path         = require('path');
const fs           = require('fs');
const pagoModel    = require('../models/pagoModel');
const uploadComprobante = require('../middleware/uploadComprobante');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');
const puntajeModel = require('../models/puntajeModel');
const comprobanteDepositoModel = require('../models/comprobanteDepositoModel');
const { PERIODOS_CUOTAS_TEMPORADA_VIGENTE, esPagoAnualInicioCiclo } = require('../utils/estatutoGdcRules');

const MIME_POR_EXTENSION = Object.fromEntries(
  Object.entries(uploadComprobante.extensionPorMime).map(([mime, ext]) => [ext, mime])
);

// Solo borra archivos subidos desde el panel (uploads/comprobantes). Si el pago usaba
// un comprobante enviado por el socio (uploads/comprobantes_deposito), ese archivo
// es del depósito y se conserva.
function borrarComprobante(comprobantePath) {
  if (!comprobantePath || !comprobantePath.startsWith('comprobantes/')) return;
  fs.unlink(path.join(__dirname, '..', 'uploads', comprobantePath), () => {});
}

function errorHttp(status, mensaje) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}

function responderError(res, error, mensajePorDefecto) {
  if (error.status) return res.status(error.status).json({ mensaje: error.message });
  console.error(mensajePorDefecto, error);
  res.status(500).json({ mensaje: mensajePorDefecto });
}

// Si no se subió un archivo y tesorería eligió un comprobante que el socio envió
// desde el Portal, el pago usa ese mismo archivo (no se copia). Devuelve el id del
// depósito para vincularlo al pago una vez guardado.
async function resolverComprobanteDeposito(req, personaId) {
  const depositoId = Number(req.body.comprobante_deposito_id);
  if (req.file || !Number.isInteger(depositoId) || depositoId <= 0) return null;

  const deposito = await comprobanteDepositoModel.obtenerPorId(depositoId);
  if (!deposito) throw errorHttp(400, 'Comprobante del socio no encontrado');
  if (Number(deposito.persona_id) !== Number(personaId)) {
    throw errorHttp(400, 'El comprobante elegido pertenece a otro integrante');
  }
  if (deposito.pago_id) throw errorHttp(409, 'Ese comprobante ya se usó en otro pago');

  req.body.comprobante_path = deposito.adjunto_path;
  return deposito.id;
}

function vincularDeposito(depositoId, pagoId) {
  if (!depositoId || !pagoId) return;
  comprobanteDepositoModel.vincularPago(depositoId, pagoId)
    .catch(e => console.error('Error vinculando comprobante de depósito:', e));
}

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
  const esAnualInicio = esPagoAnualInicioCiclo(periodosPagados, PERIODOS_CUOTAS_TEMPORADA_VIGENTE, new Date());
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

// Tipos de pago: 'cuota' rebaja la deuda de cuotas; el resto son pagos extra del
// integrante (entran a caja, no rebajan deuda ni dan puntaje).
const tiposPagoPermitidos = ['cuota', 'traje', 'chaqueta', 'otro'];

function validarPago(body) {
  const personaId = Number(body.persona_id);
  const monto = Number(body.monto_total);
  const metodo = body.metodo ? body.metodo.trim() : '';

  body.tipo_pago = String(body.tipo_pago || 'cuota').trim();
  body.detalle = String(body.detalle || '').trim().substring(0, 200) || null;

  if (!Number.isInteger(personaId) || personaId <= 0) {
    return 'Seleccione un integrante valido';
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    return 'Ingrese un monto mayor a 0';
  }

  if (!metodosPermitidos.includes(metodo)) {
    return 'Seleccione un metodo de pago valido';
  }

  if (!tiposPagoPermitidos.includes(body.tipo_pago)) {
    return 'Seleccione un tipo de pago valido';
  }

  if (body.tipo_pago === 'otro' && !body.detalle) {
    return 'Indique el detalle del pago (qué se está pagando)';
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

    const esCuota = req.body.tipo_pago === 'cuota';

    // Los honorarios están exentos de cuotas, pero sí pueden pagar trajes u otros extras
    if (persona.es_honorario && esCuota) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de cuotas' });
    }

    const cuotaId = esCuota && req.body.cuota_id ? Number(req.body.cuota_id) : null;
    const guardar = (cuota, depositoId) => {
      const completa = cuota ? Number(req.body.monto_total) === Number(cuota.saldo) : false;
      const detalles = cuota
        ? [{ cuotaId: cuota.id, monto: Number(req.body.monto_total), marcarPagada: completa }]
        : [];

      pagoModel.crearPagoConDetalles(req.body, detalles, (err, resultado) => {
        if (err) {
          return res.status(500).json({
            mensaje: cuota ? 'No se pudo vincular el pago a la cuota' : 'No se pudo registrar el pago'
          });
        }
        vincularDeposito(depositoId, resultado.pagoId);
        if (!cuota) return res.json({ mensaje: 'Pago registrado' });
        if (!completa) return res.json({ mensaje: `Pago parcial registrado. Saldo pendiente: $${Number(cuota.saldo)-Number(req.body.monto_total)}` });
        procesarPuntajeCuota(Number(req.body.persona_id), cuota.id);
        recalcularAsistenciasPersona(Number(req.body.persona_id));
        res.json({ mensaje: 'Pago registrado y cuota marcada como pagada' });
      });
    };
    const continuar = cuota => resolverComprobanteDeposito(req, persona.id)
      .then(depositoId => guardar(cuota, depositoId))
      .catch(error => responderError(res, error, 'No se pudo registrar el pago'));

    if (!cuotaId) return continuar(null);
    cuotaModel.obtenerCuotaConSaldo(cuotaId, (errCuota, cuota) => {
      if (errCuota || !cuota) return res.status(400).json({ mensaje: 'Cuota no encontrada' });
      if (Number(cuota.persona_id) !== Number(req.body.persona_id)) return res.status(400).json({ mensaje: 'La cuota no pertenece al integrante seleccionado' });
      if (Number(cuota.saldo) <= 0 || cuota.estado === 'pagado') return res.status(409).json({ mensaje: 'La cuota ya está pagada' });
      if (Number(req.body.monto_total) > Number(cuota.saldo)) return res.status(400).json({ mensaje: `El monto supera el saldo de la cuota ($${cuota.saldo})` });
      continuar(cuota);
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

  req.body.tipo_pago = 'cuota';
  const errorValidacion = validarPago(req.body);
  if (errorValidacion) {
    return res.status(400).json({ mensaje: errorValidacion });
  }

  // Con comprobante adjunto la petición llega como FormData: cuota_ids viene como JSON
  let cuotaIdsRecibidas = req.body.cuota_ids;
  if (typeof cuotaIdsRecibidas === 'string') {
    try { cuotaIdsRecibidas = JSON.parse(cuotaIdsRecibidas); } catch (e) { cuotaIdsRecibidas = []; }
  }
  const cuotaIds = Array.isArray(cuotaIdsRecibidas)
    ? [...new Set(cuotaIdsRecibidas.map(Number).filter(Number.isInteger))]
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

      const detalles = cuotas.map(cuota => ({
        cuotaId: cuota.id,
        monto: Number(cuota.saldo),
        marcarPagada: true
      }));

      resolverComprobanteDeposito(req, persona.id).then(depositoId => {
      pagoModel.crearPagoConDetalles(req.body, detalles, (errPago, resultado) => {
        if (errPago) {
          return res.status(500).json({ mensaje: 'No se pudo registrar el pago anual' });
        }
        vincularDeposito(depositoId, resultado.pagoId);
        procesarPuntajeCuotasAnual(Number(req.body.persona_id), cuotas);
        recalcularAsistenciasPersona(Number(req.body.persona_id));
        res.json({ mensaje: `Pago anual registrado: ${cuotas.length} cuota(s) marcadas como pagadas` });
      });
      }).catch(error => responderError(res, error, 'No se pudo registrar el pago anual'));
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
    pagoModel.obtenerComprobantePath(req.params.id, (errPath, comprobanteAnterior) => {
    if (errPath) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    resolverComprobanteDeposito(req, req.body.persona_id).then(depositoId => {
    pagoModel.actualizarPago(

    req.params.id,

    req.body,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      if (req.body.comprobante_path) {
        borrarComprobante(comprobanteAnterior);
        comprobanteDepositoModel.desvincularPago(req.params.id)
          .then(() => vincularDeposito(depositoId, Number(req.params.id)))
          .catch(e => console.error('Error actualizando comprobante de depósito:', e));
      }

      // Confirma actualización frontend
      res.json({
        mensaje: 'Pago actualizado'
      });

    }

    );
    }).catch(error => responderError(res, error, 'No se pudo actualizar el pago'));
    });
  });

};

// =====================================
// ELIMINAR PAGO
// =====================================

exports.eliminar = (req, res) => {
  pagoModel.tieneDetalles(req.params.id, (errDetalle, tieneDetalle) => {
    if (errDetalle) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    if (tieneDetalle) return res.status(409).json({ mensaje: 'Los pagos vinculados a cuotas no se pueden eliminar; registre un ajuste separado' });
    pagoModel.obtenerComprobantePath(req.params.id, (errPath, comprobante) => {
    if (errPath) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    pagoModel.eliminarPago(

    req.params.id,

    (err, result) => {

      if (err) {

        return res.status(500).json(err);

      }

      borrarComprobante(comprobante);
      comprobanteDepositoModel.desvincularPago(req.params.id)
        .catch(e => console.error('Error liberando comprobante de depósito:', e));

      // Confirma eliminación frontend
      res.json({
        mensaje: 'Pago eliminado'
      });

    }

    );
    });
  });

};

// =====================================
// COMPROBANTE DEL PAGO (ver / adjuntar)
// =====================================

exports.adjuntarComprobante = (req, res) => {
  pagoModel.obtenerPagoBasico(req.params.id, (errPago, pago) => {
    if (errPago) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    if (!pago) return res.status(404).json({ mensaje: 'Pago no encontrado' });

    resolverComprobanteDeposito(req, pago.persona_id).then(depositoId => {
      if (!req.body.comprobante_path) {
        return res.status(400).json({ mensaje: 'Seleccione el archivo del comprobante' });
      }

      pagoModel.actualizarComprobante(pago.id, req.body.comprobante_path, err => {
        if (err) return res.status(500).json({ mensaje: 'No se pudo guardar el comprobante' });
        borrarComprobante(pago.comprobante_path);
        comprobanteDepositoModel.desvincularPago(pago.id)
          .then(() => vincularDeposito(depositoId, pago.id))
          .catch(e => console.error('Error actualizando comprobante de depósito:', e));
        res.json({ mensaje: 'Comprobante guardado' });
      });
    }).catch(error => responderError(res, error, 'No se pudo guardar el comprobante'));
  });
};

// =====================================
// COMPROBANTES ENVIADOS POR LOS SOCIOS (Portal → tesorería)
// =====================================

exports.listarDepositos = (req, res) => {
  comprobanteDepositoModel.listarPanel()
    .then(filas => res.json(filas))
    .catch(error => responderError(res, error, 'No se pudieron obtener los comprobantes de los socios'));
};

exports.listarDepositosPendientesPersona = (req, res) => {
  comprobanteDepositoModel.listarPendientesPersona(Number(req.params.personaId))
    .then(filas => res.json(filas))
    .catch(error => responderError(res, error, 'No se pudieron obtener los comprobantes del socio'));
};

exports.descargarDeposito = (req, res) => {
  comprobanteDepositoModel.obtenerPorId(Number(req.params.id))
    .then(deposito => {
      if (!deposito) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      enviarArchivoComprobante(res, deposito.adjunto_path);
    })
    .catch(error => responderError(res, error, 'Error al buscar el comprobante'));
};

exports.descargarComprobante = (req, res) => {
  pagoModel.obtenerComprobantePath(req.params.id, (err, comprobantePath) => {
    if (err) return res.status(500).json({ mensaje: 'Error al buscar el pago' });
    if (!comprobantePath) {
      return res.status(404).json({ mensaje: 'Este pago no tiene comprobante adjunto' });
    }

    enviarArchivoComprobante(res, comprobantePath);
  });
};

function enviarArchivoComprobante(res, comprobantePath) {
  const rutaArchivo = path.join(__dirname, '..', 'uploads', comprobantePath);
  const extension = path.extname(rutaArchivo).toLowerCase();
  const mimeSeguro = MIME_POR_EXTENSION[extension] || 'application/octet-stream';

  res.set('Content-Disposition', `attachment; filename="comprobante${extension}"`);
  res.type(mimeSeguro);
  res.sendFile(rutaArchivo, (sendErr) => {
    if (sendErr && !res.headersSent) {
      res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    }
  });
}
