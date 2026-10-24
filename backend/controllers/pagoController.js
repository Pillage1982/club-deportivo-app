// Controlador HTTP de pagos: valida y registra pagos, los vincula a las cuotas que
// cubren (pago_detalle, con abonos parciales y saldo a favor) y maneja el
// comprobante adjunto.
// =====================================
// MODELO PAGOS
// =====================================

const fs           = require('fs');
const { rutaUpload, enviarArchivoSubido } = require('../config/uploads');
const pagoModel    = require('../models/pagoModel');
const personaModel = require('../models/personaModel');
const cuotaModel   = require('../models/cuotaModel');

// Solo borra archivos subidos desde el panel (uploads/comprobantes).
function borrarComprobante(comprobantePath) {
  if (!comprobantePath || !comprobantePath.startsWith('comprobantes/')) return;
  fs.unlink(rutaUpload(comprobantePath), () => {});
}

  const metodosPermitidos = [
  'efectivo',
  'transferencia',
  'debito'
];

// Tipos de pago: 'cuota' rebaja la deuda de cuotas; el resto son pagos del
// integrante que entran a caja pero no son abono a cuotas.
const tiposPagoPermitidos = ['cuota', 'inscripcion', 'otro'];

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

// cuota_ids llega como arreglo (JSON) o como texto JSON (FormData); se acepta
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

  // =====================================
  // REGISTRAR PAGO
  // =====================================
  // Tipo cuota:
  //   - 1 mes marcado: abono parcial permitido (hasta el saldo de esa cuota).
  //   - Varios meses: se pagan los más antiguos; el último puede quedar con abono.
  //   - Sin meses marcados: se aplica a las cuotas pendientes más antiguas; lo que
  //     sobre queda como saldo a favor (pago sin cuota asignada).

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

    // Los honorarios están exentos de cuotas, pero sí pueden hacer otros pagos
    if (persona.es_honorario && esCuota) {
      return res.status(403).json({ mensaje: 'Los integrantes honorarios están exentos de cuotas' });
    }

    const cuotaIds = esCuota ? leerIdsCuotas(req.body) : [];
    if (cuotaIds.length >= 2) return crearPagoVariasCuotas(req, res, persona, cuotaIds);
    if (esCuota && !cuotaIds.length) return crearPagoCuotasMasAntiguas(req, res, persona);
    if (!cuotaIds.length) return guardarPagoSimple(req, res, null);

    cuotaModel.obtenerCuotaConSaldo(cuotaIds[0], (errCuota, cuota) => {
      if (errCuota || !cuota) return res.status(400).json({ mensaje: 'Cuota no encontrada' });
      if (Number(cuota.persona_id) !== Number(req.body.persona_id)) return res.status(400).json({ mensaje: 'La cuota no pertenece al integrante seleccionado' });
      if (Number(cuota.saldo) <= 0 || cuota.estado === 'pagado') return res.status(409).json({ mensaje: 'La cuota ya está pagada' });
      if (Number(req.body.monto_total) > Number(cuota.saldo)) return res.status(400).json({ mensaje: `El monto supera el saldo de la cuota ($${cuota.saldo})` });
      guardarPagoSimple(req, res, cuota);
    });
  });

};

// Pago sin cuotas (otro tipo) o a una sola cuota (completa o con abono).
function guardarPagoSimple(req, res, cuota) {
  const monto = Number(req.body.monto_total);
  const completa = cuota ? monto === Number(cuota.saldo) : false;
  const detalles = cuota ? [{ cuotaId: cuota.id, monto, marcarPagada: completa }] : [];

  pagoModel.crearPagoConDetalles(req.body, detalles, err => {
    if (err) {
      console.error('Error registrando pago:', err);
      return res.status(500).json({
        mensaje: cuota ? 'No se pudo vincular el pago a la cuota' : 'No se pudo registrar el pago'
      });
    }
    if (!cuota) return res.json({ mensaje: 'Pago registrado' });
    if (!completa) return res.json({ mensaje: `Pago parcial registrado. Saldo pendiente: $${Number(cuota.saldo) - monto}` });
    res.json({ mensaje: 'Pago registrado y cuota marcada como pagada' });
  });
}

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

function guardarPagoRepartido(req, res, cuotas) {
  const reparto = repartirMontoEnCuotas(cuotas, Number(req.body.monto_total));

  pagoModel.crearPagoConDetalles(req.body, reparto.detalles, errPago => {
    if (errPago) {
      console.error('Error registrando pago repartido:', errPago);
      return res.status(500).json({ mensaje: 'No se pudo registrar el pago' });
    }
    res.json({ mensaje: mensajeReparto(reparto) });
  });
}

// Varios meses marcados a mano (p. ej. cuotas atrasadas). Si el monto no alcanza,
// se pagan los más antiguos y el último queda con abono parcial.
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

    guardarPagoRepartido(req, res, cuotas);
  });
}

// Pago de cuota sin meses marcados: se aplica a las cuotas pendientes más antiguas.
function crearPagoCuotasMasAntiguas(req, res, persona) {
  cuotaModel.obtenerCuotasPendientesPorPersona(persona.id, (errCuotas, cuotas) => {
    if (errCuotas) return res.status(500).json({ mensaje: 'No se pudieron obtener las cuotas pendientes' });
    guardarPagoRepartido(req, res, cuotas || []);
  });
}

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
// Los pagos vinculados a cuotas no se editan (cambiarían cuánto se abonó a cada
// cuota): se registra un ajuste aparte.

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

      pagoModel.actualizarPago(req.params.id, req.body, err => {
        if (err) {
          return res.status(500).json(err);
        }
        if (req.body.comprobante_path) borrarComprobante(comprobanteAnterior);
        res.json({ mensaje: 'Pago actualizado' });
      });
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

      pagoModel.eliminarPago(req.params.id, err => {
        if (err) {
          return res.status(500).json(err);
        }
        borrarComprobante(comprobante);
        res.json({ mensaje: 'Pago eliminado' });
      });
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
    if (!req.body.comprobante_path) {
      return res.status(400).json({ mensaje: 'Seleccione el archivo del comprobante' });
    }

    pagoModel.actualizarComprobante(pago.id, req.body.comprobante_path, err => {
      if (err) return res.status(500).json({ mensaje: 'No se pudo guardar el comprobante' });
      borrarComprobante(pago.comprobante_path);
      res.json({ mensaje: 'Comprobante guardado' });
    });
  });
};

exports.descargarComprobante = (req, res) => {
  pagoModel.obtenerComprobantePath(req.params.id, (err, comprobantePath) => {
    if (err) return res.status(500).json({ mensaje: 'Error al buscar el pago' });
    if (!comprobantePath) {
      return res.status(404).json({ mensaje: 'Este pago no tiene comprobante adjunto' });
    }

    enviarArchivoSubido(res, comprobantePath, 'comprobante');
  });
};
