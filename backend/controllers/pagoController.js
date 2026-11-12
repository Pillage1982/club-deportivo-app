// Controlador HTTP de pagos: valida operaciones y coordina personas, cuotas vinculadas y puntaje.
// =====================================
// MODELO PAGOS
// =====================================


const { rutaUpload, enviarArchivoSubido } = require('../config/uploads');
const fs           = require('fs');
const pagoModel    = require('../models/pagoModel');
const uploadComprobante = require('../middleware/uploadComprobante');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');
const puntajeModel = require('../models/puntajeModel');
const comprobanteDepositoModel = require('../models/comprobanteDepositoModel');
const comprobanteAsignacionModel = require('../models/comprobanteAsignacionModel');
const { calcularPuntosCuota, fechaPuntajeCuota, normalizarFechaPago, recalcularAsistenciasPersona } = require('../utils/puntajeCuotas');
const { periodosCuotasTemporadaVigente, esPeriodoTemporadaVigente, esPagoAnualInicioCiclo, ventanaPagoAnualAbierta } = require('../utils/estatutoGdcRules');
const { esSoporte } = require('../config/roles');

// Pago anual: el rol admin exacto (y la cuenta de soporte) lo registra todo el año;
// los demás roles (tesorero, secretaria, directores) solo dentro de la ventana de
// inicio de temporada (hasta el 31/10). Fuera de eso, 403.
exports.permitePagoAnual = (req, res, next) => {
  const u = req.usuario || {};
  const esAdmin = u.rol === 'admin' || esSoporte(u.usuario);
  if (esAdmin || ventanaPagoAnualAbierta()) return next();
  return res.status(403).json({
    mensaje: 'Fuera de octubre el pago anual solo lo puede registrar el administrador. Registre las cuotas como pago normal (puede marcar varios meses en un solo pago).'
  });
};

// Solo borra archivos subidos desde el panel (uploads/comprobantes). Si el pago usaba
// un comprobante enviado por el socio (uploads/comprobantes_deposito), ese archivo
// es del depósito y se conserva.
function borrarComprobante(comprobantePath) {
  if (!comprobantePath || !comprobantePath.startsWith('comprobantes/')) return;
  fs.unlink(rutaUpload(comprobantePath), () => {});
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
  if (!deposito) throw errorHttp(400, 'Comprobante del integrante no encontrado');
  if (Number(deposito.persona_id) !== Number(personaId)) {
    throw errorHttp(400, 'El comprobante elegido pertenece a otro integrante');
  }
  if (deposito.pago_id) throw errorHttp(409, 'Ese comprobante ya se usó en otro pago');

  req.body.comprobante_path = deposito.adjunto_path;
  return deposito.id;
}

// cuota_ids llega como arreglo (JSON) o como texto JSON (FormData); se aceptan
// también el campo antiguo cuota_id (una sola cuota).
function leerIdsCuotas(body) {
  let ids = body.cuota_ids;
  if (typeof ids === 'string') {
    try { ids = JSON.parse(ids); } catch (e) { ids = []; }
  }
  if (!Array.isArray(ids)) ids = [];
  if (!ids.length && body.cuota_id) ids = [body.cuota_id];
  return [...new Set(ids.map(Number).filter(id => Number.isInteger(id) && id > 0))];
}

function vincularDeposito(depositoId, pagoId) {
  if (!depositoId || !pagoId) return;
  comprobanteDepositoModel.vincularPago(depositoId, pagoId)
    .catch(e => console.error('Error vinculando comprobante de depósito:', e));
}

// `fechaReal`: fecha en que el integrante hizo el pago (la del comprobante). Decide
// anticipado/oportuno/tardío, en vez del día en que tesorería acepta el pago.
function procesarPuntajeCuota(persona_id, cuota_id, fechaReal) {
  cuotaModel.obtenerCuotaPorId(cuota_id, (err, cuota) => {
    if (err || !cuota) return;
    const resultado = calcularPuntosCuota(cuota.mes, cuota.anio, fechaReal);
    if (!resultado) return;
    puntajeModel.insertarPuntajeCuota({
      persona_id, cuota_id, puntos: resultado.puntos,
      detalle: resultado.detalle, fecha: fechaPuntajeCuota(cuota, fechaReal)
    }).catch(e => console.error('Error puntaje cuota:', e));
  });
}

// Puntaje del pago anual (varias cuotas en un solo pago): si cubre las 10 cuotas
// de la temporada y ocurre antes o durante el mes de inicio del ciclo, aplica el
// escenario (a) del art. 9.3 -bono de anticipado en las 10, incluida la de inicio-.
// Si no, cada cuota recibe su puntaje individual normal (igual que un pago suelto).
function procesarPuntajeCuotasAnual(persona_id, cuotas, fechaReal) {
  // Fecha del pago a mediodía para comparar año/mes sin que la zona horaria la
  // corra a otro día/mes (esPagoAnualInicioCiclo usa getFullYear/getMonth locales).
  const fechaPagoDate = fechaReal ? new Date(`${fechaReal}T12:00:00`) : new Date();
  const periodosPagados = cuotas.map(c => ({ mes: Number(c.mes), anio: Number(c.anio) }));
  const esAnualInicio = esPagoAnualInicioCiclo(periodosPagados, periodosCuotasTemporadaVigente(fechaPagoDate), fechaPagoDate);

  cuotas.forEach(cuota => {
    const resultado = esAnualInicio
      ? { puntos: 20, detalle: 'Cuota pagada anticipadamente (art. 9.3, pago anual al inicio)' }
      : calcularPuntosCuota(Number(cuota.mes), Number(cuota.anio), fechaReal);
    if (!resultado) return;
    puntajeModel.insertarPuntajeCuota({
      persona_id, cuota_id: cuota.id, puntos: resultado.puntos,
      detalle: resultado.detalle, fecha: fechaPuntajeCuota(cuota, fechaReal)
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
const tiposPagoPermitidos = ['cuota', 'integracion', 'traje', 'chaqueta', 'otro'];

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

  // Fecha real del pago (la del comprobante): base del puntaje de cuota, no de la caja.
  req.body.fecha_pago_real = normalizarFechaPago(req.body.fecha_pago);

  personaModel.obtenerPersonaPorId(Number(req.body.persona_id), (errPersona, persona) => {
    if (errPersona || !persona) {
      return res.status(400).json({ mensaje: 'Integrante no encontrado' });
    }

    const esCuota = req.body.tipo_pago === 'cuota';

    // Los honorarios están exentos de cuotas, pero sí pueden pagar trajes u otros extras
    if (persona.es_honorario && esCuota) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de cuotas' });
    }

    const cuotaIds = esCuota ? leerIdsCuotas(req.body) : [];
    if (cuotaIds.length >= 2) return crearPagoVariasCuotas(req, res, persona, cuotaIds);
    if (esCuota && !cuotaIds.length) return crearPagoCuotasMasAntiguas(req, res, persona);
    const cuotaId = cuotaIds[0] || null;
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
        procesarPuntajeCuota(Number(req.body.persona_id), cuota.id, req.body.fecha_pago_real);
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

const NOMBRES_MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function nombreCuota(cuota) {
  return `${NOMBRES_MES[Number(cuota.mes)]} ${cuota.anio}`;
}

// Reparte el monto entre las cuotas de la más antigua a la más reciente: las que
// alcanza a cubrir quedan pagadas; la siguiente recibe el resto como abono parcial
// (sigue pendiente/vencida con su saldo). Lo que sobre después de la última queda
// como saldo a favor del integrante (no se vincula a ninguna cuota).
function repartirMontoEnCuotas(cuotas, monto) {
  const ordenadas = [...cuotas].sort((a, b) =>
    (Number(a.anio) * 100 + Number(a.mes)) - (Number(b.anio) * 100 + Number(b.mes)));
  let restante = monto;
  const detalles = [];
  const pagadas = [];
  let abono = null;

  for (const cuota of ordenadas) {
    if (restante <= 0) break;
    const saldo = Number(cuota.saldo);
    const aplicado = Math.min(restante, saldo);
    const completa = aplicado === saldo;
    detalles.push({ cuotaId: cuota.id, monto: aplicado, marcarPagada: completa });
    if (completa) pagadas.push(cuota);
    else abono = { cuota, monto: aplicado, saldo: saldo - aplicado };
    restante -= aplicado;
  }

  return { detalles, pagadas, abono, sobrante: restante };
}

function mensajeReparto({ pagadas, abono, sobrante }) {
  const partes = [];
  if (pagadas.length) partes.push(`${pagadas.length} cuota(s) pagadas (${pagadas.map(nombreCuota).join(', ')})`);
  if (abono) partes.push(`abono de $${abono.monto} a ${nombreCuota(abono.cuota)} (saldo pendiente $${abono.saldo})`);
  if (sobrante > 0) partes.push(`$${sobrante} quedan a favor del integrante`);
  return partes.length ? `Pago registrado: ${partes.join('; ')}` : 'Pago registrado';
}

// Guarda un pago de cuotas repartido (casos: varios meses marcados a mano, o sin
// meses marcados = se aplica a las pendientes más antiguas). Cada cuota que queda
// pagada recibe su puntaje individual.
function guardarPagoRepartido(req, res, persona, cuotas) {
  const reparto = repartirMontoEnCuotas(cuotas, Number(req.body.monto_total));

  resolverComprobanteDeposito(req, persona.id).then(depositoId => {
    pagoModel.crearPagoConDetalles(req.body, reparto.detalles, (errPago, resultado) => {
      if (errPago) return res.status(500).json({ mensaje: 'No se pudo registrar el pago' });
      vincularDeposito(depositoId, resultado.pagoId);
      if (reparto.pagadas.length) {
        procesarPuntajeCuotasAnual(Number(persona.id), reparto.pagadas, req.body.fecha_pago_real);
        recalcularAsistenciasPersona(Number(persona.id));
      }
      res.json({ mensaje: mensajeReparto(reparto) });
    });
  }).catch(error => responderError(res, error, 'No se pudo registrar el pago'));
}

// Varios meses marcados a mano (cualquier temporada, p. ej. cuotas atrasadas). Si el
// monto no alcanza, se pagan los más antiguos y el último queda con abono parcial.
function crearPagoVariasCuotas(req, res, persona, cuotaIds) {
  cuotaModel.obtenerCuotasConSaldoPorIds(cuotaIds, (errCuotas, cuotas) => {
    if (errCuotas) return res.status(500).json({ mensaje: 'No se pudieron verificar las cuotas' });
    if (cuotas.length !== cuotaIds.length) {
      return res.status(400).json({ mensaje: 'Alguna cuota seleccionada no existe' });
    }
    if (cuotas.some(c => Number(c.persona_id) !== Number(persona.id))) {
      return res.status(400).json({ mensaje: 'Todas las cuotas deben pertenecer al integrante seleccionado' });
    }
    const yaPagada = cuotas.find(c => c.estado === 'pagado' || Number(c.saldo) <= 0);
    if (yaPagada) {
      return res.status(409).json({ mensaje: `La cuota ${yaPagada.mes}/${yaPagada.anio} ya está pagada` });
    }

    const sumaSaldos = cuotas.reduce((suma, c) => suma + Number(c.saldo), 0);
    if (Number(req.body.monto_total) > sumaSaldos) {
      return res.status(400).json({
        mensaje: `El monto supera la suma de los meses marcados ($${sumaSaldos}). Marque más meses o registre la diferencia aparte`
      });
    }

    guardarPagoRepartido(req, res, persona, cuotas);
  });
}

// Pago de cuota sin meses marcados: se aplica a las cuotas pendientes más antiguas
// del integrante (cualquier temporada).
function crearPagoCuotasMasAntiguas(req, res, persona) {
  cuotaModel.obtenerCuotasPendientesPorPersona(persona.id, (errCuotas, cuotas) => {
    if (errCuotas) return res.status(500).json({ mensaje: 'No se pudieron obtener las cuotas pendientes' });
    guardarPagoRepartido(req, res, persona, cuotas || []);
  });
}

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

  // Fecha real del pago (la del comprobante, de puño y letra en los anuales en
  // efectivo fuera de plazo): decide el bono de pago anual al inicio de temporada.
  req.body.fecha_pago_real = normalizarFechaPago(req.body.fecha_pago);

  // Con comprobante adjunto la petición llega como FormData: cuota_ids viene como JSON
  const cuotaIds = leerIdsCuotas({ cuota_ids: req.body.cuota_ids });

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
      // El pago anual cubre solo la temporada vigente; las cuotas atrasadas de
      // temporadas anteriores se pagan como pago normal vinculado a esa cuota.
      const fueraDeTemporada = cuotas.find(c => !esPeriodoTemporadaVigente(c.mes, c.anio));
      if (fueraDeTemporada) {
        return res.status(400).json({
          mensaje: `La cuota ${fueraDeTemporada.mes}/${fueraDeTemporada.anio} no es de la temporada vigente; el pago anual solo cubre la temporada actual`
        });
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
        procesarPuntajeCuotasAnual(Number(req.body.persona_id), cuotas, req.body.fecha_pago_real);
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
    puntajeModel.obtenerInicioTemporadaVigente()
      .then(inicio => puntajeModel.obtenerPuntosCuotasPorPersona(inicio))
      .then(puntosCuotas => res.json({ pagosPorMes, puntosCuotas }))
      .catch(() => res.status(500).json({ mensaje: 'No se pudieron obtener los puntos de cuotas' }));
  });
};

// =====================================
// CORREGIR FECHA REAL DEL PAGO (solo puntaje, no la caja)
// =====================================
// Para pagos vinculados a cuotas (que no se pueden editar por PUT): cambia únicamente
// la fecha real del pago y recalcula el puntaje de las cuotas que cubrió. Útil para
// pagos aceptados con desfase o pagos en efectivo con fecha de puño y letra.
exports.corregirFechaPago = (req, res) => {
  const pagoId = Number(req.params.id);
  if (!Number.isInteger(pagoId) || pagoId <= 0) {
    return res.status(400).json({ mensaje: 'Pago inválido' });
  }
  const fechaReal = normalizarFechaPago(req.body.fecha_pago);

  pagoModel.obtenerCuotasCubiertas(pagoId, (err, info) => {
    if (err) return res.status(500).json({ mensaje: 'No se pudo verificar el pago' });
    if (!info) return res.status(404).json({ mensaje: 'Pago no encontrado' });
    if (info.tipo_pago !== 'cuota' || !info.cuotas.length) {
      return res.status(409).json({ mensaje: 'Solo los pagos de cuota con meses cubiertos tienen una fecha que afecte el puntaje' });
    }

    // La corrección de fecha solo aplica de la temporada 2026-2027 en adelante; la
    // data migrada 2025-2026 (temporada que arranca en 2025) no se toca. El año de
    // inicio de la temporada de una cuota es su año si el mes es >= octubre, si no el
    // anterior. Se recalculan solo las cuotas aplicables (una cuota 2025-2026 atrasada
    // dentro de un pago nuevo queda intacta).
    const esTemporadaCorregible = c =>
      (Number(c.mes) >= 10 ? Number(c.anio) : Number(c.anio) - 1) >= 2026;
    const cuotasAplicables = info.cuotas.filter(esTemporadaCorregible);
    if (!cuotasAplicables.length) {
      return res.status(409).json({ mensaje: 'La corrección de fecha solo aplica a pagos de la temporada 2026-2027 en adelante' });
    }

    pagoModel.actualizarFechaPagoReal(pagoId, fechaReal, (errU) => {
      if (errU) return res.status(500).json({ mensaje: 'No se pudo actualizar la fecha del pago' });

      const cuotaIds = cuotasAplicables.map(c => c.id);
      // Borrar el puntaje anterior y recalcular con la fecha real (incluye el bono
      // anual de 200 si cubre la temporada completa al inicio).
      puntajeModel.eliminarPuntajesCuotas(cuotaIds)
        .then(() => {
          if (cuotasAplicables.length >= 2) {
            procesarPuntajeCuotasAnual(Number(info.persona_id), cuotasAplicables, fechaReal);
          } else {
            procesarPuntajeCuota(Number(info.persona_id), cuotasAplicables[0].id, fechaReal);
          }
          recalcularAsistenciasPersona(Number(info.persona_id));
          res.json({ mensaje: 'Fecha del pago actualizada y puntaje recalculado' });
        })
        .catch(() => res.status(500).json({ mensaje: 'No se pudo recalcular el puntaje' }));
    });
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
    .catch(error => responderError(res, error, 'No se pudieron obtener los comprobantes de los integrantes'));
};

exports.listarDepositosPendientesPersona = (req, res) => {
  comprobanteDepositoModel.listarPendientesPersona(Number(req.params.personaId))
    .then(filas => res.json(filas))
    .catch(error => responderError(res, error, 'No se pudieron obtener los comprobantes del integrante'));
};

exports.descargarDeposito = (req, res) => {
  comprobanteDepositoModel.obtenerPorId(Number(req.params.id))
    .then(deposito => {
      if (!deposito) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
      enviarArchivoComprobante(res, deposito.adjunto_path);
    })
    .catch(error => responderError(res, error, 'Error al buscar el comprobante'));
};

// =====================================
// REPARTO DE COMPROBANTES (Etapa 7): revisar y confirmar las asignaciones
// =====================================

exports.listarAsignacionesComprobante = (req, res) => {
  comprobanteAsignacionModel.listarPorComprobante(Number(req.params.id))
    .then(filas => res.json(filas))
    .catch(error => responderError(res, error, 'No se pudieron obtener las asignaciones'));
};

exports.aprobarAsignacion = async (req, res) => {
  const id = Number(req.params.id);
  const autorizarFuturo = req.body && (req.body.autorizar_futuro === true || req.body.autorizar_futuro === 'true');
  try {
    const asignacion = await comprobanteAsignacionModel.obtenerPorId(id);
    if (!asignacion) return res.status(404).json({ mensaje: 'Asignación no encontrada' });
    if (asignacion.pago_id) return res.status(409).json({ mensaje: 'Esta asignación ya tiene un pago registrado' });
    if (asignacion.estado !== 'pendiente_revision') return res.status(409).json({ mensaje: 'Esta asignación no está en revisión' });
    await comprobanteAsignacionModel.aprobar(id, req.usuario.id);
    if (autorizarFuturo) {
      await comprobanteAsignacionModel.autorizarPagador(asignacion.comprobante_persona_id, asignacion.integrante_id, req.usuario.id);
    }
    res.json({ mensaje: 'Asignación aprobada' + (autorizarFuturo ? ' y pagador autorizado para pagos futuros' : '') });
  } catch (err) {
    console.error('Error aprobando asignación:', err);
    res.status(500).json({ mensaje: 'No se pudo aprobar la asignación' });
  }
};

exports.rechazarAsignacion = async (req, res) => {
  const id = Number(req.params.id);
  try {
    const asignacion = await comprobanteAsignacionModel.obtenerPorId(id);
    if (!asignacion) return res.status(404).json({ mensaje: 'Asignación no encontrada' });
    if (asignacion.pago_id) return res.status(409).json({ mensaje: 'Esta asignación ya tiene un pago registrado' });
    await comprobanteAsignacionModel.rechazar(id, req.usuario.id);
    res.json({ mensaje: 'Asignación rechazada' });
  } catch (err) {
    console.error('Error rechazando asignación:', err);
    res.status(500).json({ mensaje: 'No se pudo rechazar la asignación' });
  }
};

// Por cada asignación automatica/aprobada sin pago, crea un pago para ese beneficiario
// aplicado a sus cuotas más antiguas (igual que un "pago sin meses marcados"); el
// sobrante queda a favor. Las que siguen en revisión se saltan hasta aprobarlas.
function confirmarAsignacionPromise(asignacion, comprobante) {
  return new Promise((resolve, reject) => {
    cuotaModel.obtenerCuotasPendientesPorPersona(asignacion.integrante_id, (errC, cuotas) => {
      if (errC) return reject(errC);
      const reparto = repartirMontoEnCuotas(cuotas || [], Number(asignacion.monto_asignado));
      const data = {
        persona_id: asignacion.integrante_id,
        monto_total: Number(asignacion.monto_asignado),
        metodo: 'transferencia',
        tipo_pago: 'cuota',
        detalle: comprobante.concepto || null,
        comprobante_path: comprobante.adjunto_path
      };
      pagoModel.crearPagoConDetalles(data, reparto.detalles, (errP, resultado) => {
        if (errP) return reject(errP);
        comprobanteAsignacionModel.marcarConPago(asignacion.id, resultado.pagoId)
          .then(() => {
            if (reparto.pagadas.length) {
              procesarPuntajeCuotasAnual(Number(asignacion.integrante_id), reparto.pagadas);
              recalcularAsistenciasPersona(Number(asignacion.integrante_id));
            }
            resolve(resultado.pagoId);
          })
          .catch(reject);
      });
    });
  });
}

exports.confirmarReparto = async (req, res) => {
  const comprobanteId = Number(req.params.id);
  try {
    const comprobante = await comprobanteDepositoModel.obtenerPorId(comprobanteId);
    if (!comprobante) return res.status(404).json({ mensaje: 'Comprobante no encontrado' });
    const asignaciones = await comprobanteAsignacionModel.listarPorComprobante(comprobanteId);
    const confirmables = asignaciones.filter(a => !a.pago_id && (a.estado === 'automatica' || a.estado === 'aprobada'));
    const pendientes = asignaciones.filter(a => a.estado === 'pendiente_revision');
    if (!confirmables.length) {
      return res.status(400).json({
        mensaje: pendientes.length
          ? 'Primero aprueba (o rechaza) las asignaciones en revisión.'
          : 'No hay asignaciones por confirmar.'
      });
    }
    // Secuencial: cada pago es su propia transacción; si uno falla, los anteriores ya
    // quedaron y re-confirmar solo procesa los que aún no tienen pago.
    let hechos = 0;
    for (const a of confirmables) {
      await confirmarAsignacionPromise(a, comprobante);
      hechos++;
    }
    res.json({
      mensaje: `${hechos} pago(s) registrado(s)` + (pendientes.length ? `; quedan ${pendientes.length} en revisión.` : '.'),
      confirmadas: hechos,
      pendientes: pendientes.length
    });
  } catch (err) {
    console.error('Error confirmando reparto:', err);
    res.status(500).json({ mensaje: 'No se pudo confirmar el reparto' });
  }
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
  enviarArchivoSubido(res, comprobantePath, 'comprobante');
}
