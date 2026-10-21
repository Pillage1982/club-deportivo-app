// Cartas de permiso para el colegio: el integrante (o su apoderado con la cuenta del
// alumno) la pide en Portal → Documentos, secretaría y presidencia reciben el aviso,
// los roles admin y secretaria la aprueban o rechazan en el panel y, al aprobar,
// se emite el PDF firmado (se envía por correo y se descarga en el Portal). El QR
// de la carta lleva a /verificar.html con un código que no se puede adivinar.
const crypto = require('crypto');
const cartaPermisoModel = require('../models/cartaPermisoModel');
const justificacionModel = require('../models/justificacionModel');
const emailService = require('../services/emailService');
const {
  generarPdfCarta, aniosDesdeFundacion, formatearFolio
} = require('../services/cartaPermisoPdf');
const config = require('../config/cartaPermiso');
const { esSoporte } = require('../config/roles');

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Morenada: la carta está deshabilitada hasta que la agrupación entregue la suya
// (config/cartaPermiso.js → habilitada). Va delante de todas sus rutas.
exports.exigirHabilitada = (req, res, next) => {
  if (config.habilitada) return next();
  res.status(404).json({ mensaje: 'La carta de permiso para el colegio no está disponible' });
};
const ESTADOS = ['pendiente', 'aprobada', 'rechazada'];
// Sin 0/O, 1/I/L: el código se puede tipear a mano en la página de verificación.
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function textoLimpio(valor, max) {
  return String(valor ?? '').trim().replace(/\s+/g, ' ').substring(0, max);
}

function hoyChile() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function diasEntre(desde, hasta) {
  return Math.round((Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)) / 86400000);
}

function generarCodigo() {
  return Array.from({ length: 8 }, () => ALFABETO_CODIGO[crypto.randomInt(ALFABETO_CODIGO.length)]).join('');
}

function urlVerificacion() {
  return `${String(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/verificar.html`;
}

function nombreArchivo(carta) {
  return `Carta_permiso_${formatearFolio(carta.id)}.pdf`;
}

async function enviarPdf(res, carta) {
  const pdf = await generarPdfCarta(carta, urlVerificacion());
  res.set('Content-Disposition', `inline; filename="${nombreArchivo(carta)}"`);
  res.set('Cache-Control', 'no-store, private');
  res.type('application/pdf').send(pdf);
}

// Solo los roles admin y secretaria (exactos) y la cuenta de soporte.
exports.soloQuienesAprueban = (req, res, next) => {
  const u = req.usuario || {};
  if (config.rolesAprueban.includes(u.rol) || esSoporte(u.usuario)) return next();
  return res.status(403).json({ mensaje: 'Solo el administrador y la secretaria revisan las cartas de permiso' });
};

// =====================================
// PORTAL DEL INTEGRANTE
// =====================================
exports.crearSolicitud = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const datos = {
    persona_id: personaId,
    colegio: textoLimpio(body.colegio, 150),
    director: textoLimpio(body.director, 150),
    curso: textoLimpio(body.curso, 60),
    fecha_desde: String(body.fecha_desde || ''),
    fecha_hasta: String(body.fecha_hasta || '')
  };

  if (datos.colegio.length < 3) return res.status(400).json({ mensaje: 'Indica el nombre del colegio' });
  if (datos.director.length < 3) return res.status(400).json({ mensaje: 'Indica el nombre del director o directora' });
  if (!datos.curso) return res.status(400).json({ mensaje: 'Indica el curso' });
  if (!FECHA.test(datos.fecha_desde) || !FECHA.test(datos.fecha_hasta)) {
    return res.status(400).json({ mensaje: 'Indica las fechas del permiso' });
  }
  if (datos.fecha_hasta < datos.fecha_desde) {
    return res.status(400).json({ mensaje: 'La fecha "hasta" no puede ser anterior a "desde"' });
  }
  if (datos.fecha_hasta < hoyChile()) {
    return res.status(400).json({ mensaje: 'Las fechas del permiso ya pasaron' });
  }
  if (diasEntre(datos.fecha_desde, datos.fecha_hasta) >= config.diasMaximoPermiso) {
    return res.status(400).json({ mensaje: `El permiso no puede superar los ${config.diasMaximoPermiso} días` });
  }

  try {
    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    // La carta dice "integrante activo de nuestra Institución".
    if (persona.estado !== 'activo') {
      return res.status(409).json({ mensaje: 'La carta de permiso es solo para integrantes activos' });
    }
    if (await cartaPermisoModel.existePendienteIgual(personaId, datos.fecha_desde, datos.fecha_hasta)) {
      return res.status(409).json({ mensaje: 'Ya tienes una solicitud en revisión para esas mismas fechas' });
    }

    const folio = await cartaPermisoModel.crear(datos);
    const carta = await cartaPermisoModel.obtener(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarSolicitudCartaPermiso(carta);
      if (correoEnviado) await cartaPermisoModel.marcarEmail(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando solicitud de carta de permiso, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: `Solicitud enviada a la directiva. Folio Nº ${formatearFolio(folio)}. Cuando la aprueben te llegará la carta por correo y podrás descargarla aquí.`
    });
  } catch (err) {
    console.error('Error registrando carta de permiso:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la solicitud' });
  }
};

exports.descargarPdfSocio = async (req, res) => {
  try {
    const carta = await cartaPermisoModel.obtenerDelSocio(Number(req.params.id), req.socio.persona_id);
    if (!carta || carta.estado !== 'aprobada') {
      return res.status(404).json({ mensaje: 'Carta no disponible' });
    }
    await enviarPdf(res, carta);
  } catch (err) {
    console.error('Error generando PDF de carta de permiso (Portal):', err);
    res.status(500).json({ mensaje: 'No se pudo generar la carta' });
  }
};

// =====================================
// PANEL (admin y secretaria)
// =====================================
exports.listar = (req, res) => {
  const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
  cartaPermisoModel.listar(estado)
    .then(rows => res.json(rows))
    .catch(err => {
      console.error('Error listando cartas de permiso:', err);
      res.status(500).json({ mensaje: 'Error al listar las cartas de permiso' });
    });
};

exports.aprobar = async (req, res) => {
  const id = Number(req.params.id);
  const observacion = textoLimpio(req.body?.observacion, 300) || null;

  try {
    const carta = await cartaPermisoModel.obtener(id);
    if (!carta) return res.status(404).json({ mensaje: 'Carta no encontrada' });
    if (carta.estado !== 'pendiente') return res.status(409).json({ mensaje: 'Esta carta ya fue revisada' });

    const emitidaEn = hoyChile();
    const actualizada = await cartaPermisoModel.aprobar(id, {
      codigo: generarCodigo(),
      anios: aniosDesdeFundacion(emitidaEn),
      integrantes: await cartaPermisoModel.contarIntegrantesActivos(),
      emitida_en: emitidaEn,
      observacion,
      revisado_por: req.usuario.id
    });
    if (!actualizada) return res.status(409).json({ mensaje: 'Esta carta ya fue revisada' });

    const aprobada = await cartaPermisoModel.obtener(id);

    // Sin firma en el servidor la carta queda aprobada pero no se puede emitir el
    // PDF: se avisa para subir la firma (el integrante la descarga después).
    let pdf = null;
    try {
      pdf = await generarPdfCarta(aprobada, urlVerificacion());
    } catch (errPdf) {
      console.error('Error generando PDF de carta de permiso, folio', id, errPdf);
      return res.json({
        mensaje: errPdf.codigo === 'SIN_FIRMA'
          ? 'Carta aprobada, pero falta la firma del presidente en el servidor: no se pudo generar ni enviar el PDF.'
          : 'Carta aprobada, pero no se pudo generar el PDF. Reintenta la descarga desde la tabla.'
      });
    }

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.notificarResolucionCartaPermiso({ carta: aprobada, aprobada: true, pdf });
      if (correoEnviado) await cartaPermisoModel.marcarEmailCarta(id);
    } catch (errCorreo) {
      console.error('[Email] Error enviando carta de permiso aprobada, folio', id, errCorreo);
    }

    res.json({
      mensaje: correoEnviado
        ? `Carta folio ${formatearFolio(id)} aprobada y enviada al correo del integrante.`
        : `Carta folio ${formatearFolio(id)} aprobada. No se pudo enviar por correo${aprobada.email ? '' : ' (el integrante no tiene email)'}: la puede descargar en el Portal o desde esta tabla.`
    });
  } catch (err) {
    console.error('Error aprobando carta de permiso:', err);
    res.status(500).json({ mensaje: 'No se pudo aprobar la carta' });
  }
};

exports.rechazar = async (req, res) => {
  const id = Number(req.params.id);
  const observacion = textoLimpio(req.body?.observacion, 300);

  if (!observacion) {
    return res.status(400).json({ mensaje: 'Escribe el motivo del rechazo: se le informa al integrante' });
  }

  try {
    const actualizada = await cartaPermisoModel.rechazar(id, observacion, req.usuario.id);
    if (!actualizada) return res.status(409).json({ mensaje: 'Esta carta ya fue revisada o no existe' });

    const carta = await cartaPermisoModel.obtener(id);
    emailService.notificarResolucionCartaPermiso({ carta, aprobada: false })
      .catch(err => console.error('[Email] Error avisando rechazo de carta de permiso:', err));

    res.json({ mensaje: `Carta folio ${formatearFolio(id)} rechazada.` });
  } catch (err) {
    console.error('Error rechazando carta de permiso:', err);
    res.status(500).json({ mensaje: 'No se pudo rechazar la carta' });
  }
};

exports.descargarPdf = async (req, res) => {
  try {
    const carta = await cartaPermisoModel.obtener(Number(req.params.id));
    if (!carta || carta.estado !== 'aprobada') {
      return res.status(404).json({ mensaje: 'Solo las cartas aprobadas tienen PDF' });
    }
    await enviarPdf(res, carta);
  } catch (err) {
    console.error('Error generando PDF de carta de permiso (panel):', err);
    res.status(err.codigo === 'SIN_FIRMA' ? 409 : 500).json({
      mensaje: err.codigo === 'SIN_FIRMA'
        ? 'Falta la firma del presidente en el servidor (carpeta de uploads → firmas)'
        : 'No se pudo generar la carta'
    });
  }
};

// =====================================
// VERIFICACIÓN PÚBLICA (QR)
// =====================================
exports.verificar = async (req, res) => {
  const codigo = String(req.params.codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (codigo.length !== 8) return res.status(404).json({ valida: false });

  try {
    const carta = await cartaPermisoModel.obtenerPorCodigo(codigo);
    if (!carta) return res.status(404).json({ valida: false });

    res.json({
      valida: true,
      folio: formatearFolio(carta.id),
      alumno: [carta.nombres, carta.apellido_paterno, carta.apellido_materno].filter(Boolean).join(' '),
      colegio: carta.colegio,
      curso: carta.curso,
      fecha_desde: carta.fecha_desde,
      fecha_hasta: carta.fecha_hasta,
      emitida_en: carta.emitida_en,
      firmante: `${config.firmante.nombre}, ${config.firmante.cargo}`
    });
  } catch (err) {
    console.error('Error verificando carta de permiso:', err);
    res.status(500).json({ mensaje: 'No se pudo verificar la carta' });
  }
};
