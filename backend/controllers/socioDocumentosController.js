// Pestaña "Documentos" del Portal del Socio: carta de justificación de inasistencia
// (formato de Carta_Justificacion.doc) y postulación a bloques (formato de
// Carta_Postulacion_Bloques.doc), autocompletadas con los datos del socio y
// enviadas por correo. Nombre y RUT salen siempre de la BD (req.socio.persona_id),
// nunca del formulario. Las cartas quedan guardadas aunque el correo falle.
const fs = require('fs');
const path = require('path');
const justificacionModel = require('../models/justificacionModel');
const comprobanteDepositoModel = require('../models/comprobanteDepositoModel');
const cuentaDeposito = require('../config/cuentaDeposito');
const uploadJustificativo = require('../middleware/uploadJustificativo');
const emailService = require('../services/emailService');

const REFERENCIA_POR_TIPO_EVENTO = {
  entrenamiento: 'ensayo',
  reunion: 'reunion',
  partido: 'salida'
};

const REFERENCIAS = ['ensayo', 'reunion', 'salida', 'otro'];
const TIPOS_SOLICITADOS = ['justificado', 'licencia_medica'];
const CONDICIONES = ['bailarin', 'socio'];

const RUTA_ESTATUTOS = path.join(__dirname, '..', 'documentos', 'Estatutos_BaileGDC.pdf');

function textoLimpio(valor, max) {
  const texto = String(valor ?? '').trim();
  return texto ? texto.substring(0, max) : '';
}

function hoyChile() {
  // en-CA formatea como YYYY-MM-DD
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
}

function descartarArchivo(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

// =====================================
// DATOS PARA LOS FORMULARIOS
// =====================================
exports.datosFormularios = async (req, res) => {
  const personaId = req.socio.persona_id;

  try {
    const [persona, eventos, bloques, justificaciones, postulaciones, comprobantes] = await Promise.all([
      justificacionModel.obtenerDatosCarta(personaId),
      justificacionModel.listarEventosJustificables(personaId),
      justificacionModel.listarBloques(),
      justificacionModel.listarJustificacionesSocio(personaId),
      justificacionModel.listarPostulacionesSocio(personaId),
      comprobanteDepositoModel.listarSocio(personaId)
    ]);

    if (!persona) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    res.json({
      persona: {
        rut: persona.rut,
        nombres: persona.nombres,
        apellido_paterno: persona.apellido_paterno,
        apellido_materno: persona.apellido_materno,
        bloque: persona.bloque,
        email: persona.email,
        telefono: persona.telefono
      },
      minutos_cierre: justificacionModel.MINUTOS_CIERRE_ASISTENCIA,
      eventos: eventos.map(e => ({
        ...e,
        referencia: REFERENCIA_POR_TIPO_EVENTO[e.tipo] || 'otro'
      })),
      bloques,
      justificaciones,
      postulaciones,
      comprobantes,
      cuenta_deposito: cuentaDeposito
    });
  } catch (err) {
    console.error('Error cargando documentos del socio:', err);
    res.status(500).json({ mensaje: 'Error al cargar los documentos' });
  }
};

// =====================================
// ENVIAR CARTA DE JUSTIFICACIÓN (multipart: adjunto opcional)
// =====================================
exports.enviarJustificacion = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const eventoId = body.evento_id ? Number(body.evento_id) : null;
  const tipoSolicitado = body.tipo_solicitado;
  const condicion = body.condicion;
  const motivo = textoLimpio(body.motivo, 3000);
  const quienEntrega = textoLimpio(body.quien_entrega, 150) || null;

  if (!TIPOS_SOLICITADOS.includes(tipoSolicitado)) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica si es justificación o licencia médica' });
  }
  if (!CONDICIONES.includes(condicion)) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica tu condición (bailarín o socio)' });
  }
  if (motivo.length < 10) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Explica el motivo de tu inasistencia (mínimo 10 caracteres)' });
  }

  try {
    if (req.file) {
      const firmaValida = await uploadJustificativo.verificarFirmaArchivo(req.file.path, req.file.mimetype)
        .catch(() => false);
      if (!firmaValida) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
      }
    }

    let evento = null;
    let referencia;
    let referenciaOtro = null;
    let fechaActividad;

    if (eventoId) {
      // Art. 8.7: solo hasta el cierre de asistencia (10 min antes del inicio).
      evento = await justificacionModel.obtenerEventoJustificable(personaId, eventoId);
      if (!evento) {
        descartarArchivo(req);
        return res.status(409).json({
          mensaje: 'Esta actividad ya no se puede justificar: la asistencia cerró (Art. 8.7 de los Estatutos) o ya enviaste una carta para ella.'
        });
      }
      referencia = REFERENCIA_POR_TIPO_EVENTO[evento.tipo] || 'otro';
      fechaActividad = String(evento.fecha).substring(0, 10);
    } else {
      // Actividad que no está en la lista (no registrada en el sistema).
      referencia = body.referencia;
      referenciaOtro = textoLimpio(body.referencia_otro, 150) || null;
      fechaActividad = String(body.fecha_actividad || '');

      if (!REFERENCIAS.includes(referencia)) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'Indica el tipo de actividad (ensayo, reunión, salida u otro)' });
      }
      if (!referenciaOtro) {
        descartarArchivo(req);
        return res.status(400).json({ mensaje: 'Indica el nombre de la actividad' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaActividad) || fechaActividad < hoyChile()) {
        descartarArchivo(req);
        return res.status(400).json({
          mensaje: 'La fecha de la actividad debe ser hoy o posterior: las cartas se reciben solo hasta el cierre de asistencia (Art. 8.7).'
        });
      }
    }

    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      descartarArchivo(req);
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    const folio = await justificacionModel.crearJustificacion({
      persona_id: personaId,
      evento_id: evento ? evento.id : null,
      referencia,
      referencia_otro: referenciaOtro,
      fecha_actividad: fechaActividad,
      tipo_solicitado: tipoSolicitado,
      condicion,
      motivo,
      quien_entrega: quienEntrega,
      adjunto_path: req.file ? `justificativos/${req.file.filename}` : null
    });

    const creadoEn = await justificacionModel.obtenerFechaCreacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarCartaJustificacion({
        folio,
        creadoEn,
        persona,
        referencia,
        referenciaOtro,
        evento,
        fechaActividad,
        tipoSolicitado,
        condicion,
        motivo,
        quienEntrega,
        adjunto: req.file
          ? { path: req.file.path, filename: `respaldo-folio-${emailService.formatearFolio(folio)}${path.extname(req.file.filename)}` }
          : null
      });
      if (correoEnviado) await justificacionModel.marcarEmailJustificacion(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando carta de justificación, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Carta enviada a la directiva. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Carta registrada con folio Nº ${emailService.formatearFolio(folio)}. La directiva la verá en su panel (el correo no pudo enviarse).`
    });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la carta' });
  }
};

// =====================================
// ENVIAR POSTULACIÓN A BLOQUES
// =====================================
exports.enviarPostulacion = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const esNuevo = body.es_nuevo === true || body.es_nuevo === 'true' || body.es_nuevo === 1;
  const opcion1 = textoLimpio(body.opcion_1, 100);
  const opcion2 = textoLimpio(body.opcion_2, 100) || null;

  if (!opcion1) {
    return res.status(400).json({ mensaje: 'Indica tu primera opción de postulación' });
  }
  if (opcion2 && opcion2.toLowerCase() === opcion1.toLowerCase()) {
    return res.status(400).json({ mensaje: 'La segunda opción debe ser distinta de la primera' });
  }

  try {
    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    // Celular y email: los registrados en "Actualizar datos" (no se editan aquí).
    const datos = {
      persona_id: personaId,
      bloque_actual: esNuevo ? null : (persona.bloque || null),
      es_nuevo: esNuevo,
      opcion_1: opcion1,
      opcion_2: opcion2,
      celular: persona.telefono || null,
      email: persona.email || null
    };

    const folio = await justificacionModel.crearPostulacion(datos);
    const creadoEn = await justificacionModel.obtenerFechaCreacionPostulacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarPostulacionBloque({
        folio,
        creadoEn,
        persona,
        bloqueActual: datos.bloque_actual,
        esNuevo,
        opcion1,
        opcion2,
        celular: datos.celular,
        email: datos.email
      });
      if (correoEnviado) await justificacionModel.marcarEmailPostulacion(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando postulación a bloque, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Postulación enviada a los caporales. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Postulación registrada con folio Nº ${emailService.formatearFolio(folio)} (el correo no pudo enviarse).`
    });
  } catch (err) {
    console.error('Error registrando postulación a bloque:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la postulación' });
  }
};

// =====================================
// COMPROBANTE DE DEPÓSITO → TESORERÍA (multipart: comprobante obligatorio)
// =====================================
// Solo avisa a tesorería: no registra el pago ni cambia cuotas. Tesorería revisa
// la cartola y registra el pago en el panel.
exports.enviarComprobante = async (req, res) => {
  const personaId = req.socio.persona_id;
  const body = req.body || {};

  const monto = Number(String(body.monto ?? '').replace(/\D/g, ''));
  const fechaDeposito = String(body.fecha_deposito || '');
  const concepto = textoLimpio(body.concepto, 200) || null;

  if (!req.file) {
    return res.status(400).json({ mensaje: 'Adjunta la foto o el PDF del comprobante' });
  }
  if (!Number.isInteger(monto) || monto < 100 || monto > 10000000) {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica el monto depositado' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaDeposito) || fechaDeposito > hoyChile() || fechaDeposito < '2025-01-01') {
    descartarArchivo(req);
    return res.status(400).json({ mensaje: 'Indica una fecha de depósito válida (no puede ser futura)' });
  }

  try {
    const firmaValida = await uploadJustificativo.verificarFirmaArchivo(req.file.path, req.file.mimetype)
      .catch(() => false);
    if (!firmaValida) {
      descartarArchivo(req);
      return res.status(400).json({ mensaje: 'El archivo no corresponde a una imagen o PDF válido' });
    }

    const persona = await justificacionModel.obtenerDatosCarta(personaId);
    if (!persona) {
      descartarArchivo(req);
      return res.status(404).json({ mensaje: 'Integrante no encontrado' });
    }

    const folio = await comprobanteDepositoModel.crear({
      persona_id: personaId,
      monto,
      fecha_deposito: fechaDeposito,
      concepto,
      adjunto_path: `comprobantes_deposito/${req.file.filename}`
    });
    const creadoEn = await comprobanteDepositoModel.obtenerFechaCreacion(folio);

    let correoEnviado = false;
    try {
      correoEnviado = await emailService.enviarComprobanteDeposito({
        folio,
        creadoEn,
        persona,
        monto,
        fechaDeposito,
        concepto,
        adjunto: {
          path: req.file.path,
          filename: `comprobante-${emailService.formatearFolio(folio)}${path.extname(req.file.filename)}`
        }
      });
      if (correoEnviado) await comprobanteDepositoModel.marcarEmail(folio);
    } catch (errCorreo) {
      console.error('[Email] Error enviando comprobante de depósito, folio', folio, errCorreo);
    }

    res.status(201).json({
      folio,
      correoEnviado,
      mensaje: correoEnviado
        ? `Comprobante enviado a tesorería. Folio Nº ${emailService.formatearFolio(folio)}.`
        : `Comprobante registrado con folio Nº ${emailService.formatearFolio(folio)}, pero el correo a tesorería no pudo enviarse. Avisa a tesorería.`
    });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando comprobante de depósito:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar el comprobante' });
  }
};

// =====================================
// ESTATUTOS (PDF, solo socios autenticados)
// =====================================
exports.descargarEstatutos = (req, res) => {
  res.set('Content-Disposition', 'inline; filename="Estatutos_GDC_2016.pdf"');
  res.type('application/pdf');
  res.sendFile(RUTA_ESTATUTOS, err => {
    if (err && !res.headersSent) {
      res.status(404).json({ mensaje: 'Estatutos no disponibles' });
    }
  });
};
