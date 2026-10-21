// Panel admin "Justificaciones": revisión de las cartas enviadas desde el Portal
// del Socio. Aprobar cambia la asistencia del evento a justificado/licencia_medica
// (Art. 8.4) y recalcula el puntaje del integrante; rechazar solo deja constancia.
// En ambos casos se avisa al socio por correo si tiene email.

const { enviarArchivoSubido } = require('../config/uploads');
const justificacionModel = require('../models/justificacionModel');
const puntajeModel = require('../models/puntajeModel');
const emailService = require('../services/emailService');

const fs = require('fs');
const uploadJustificativo = require('../middleware/uploadJustificativo');

const ESTADOS_FILTRO = ['pendiente', 'aprobada', 'rechazada'];
const ESTADOS_APLICABLES = ['justificado', 'licencia_medica'];

// Mismas categorías que la carta del Portal (socioDocumentosController).
const REFERENCIA_POR_TIPO_EVENTO = {
  entrenamiento: 'ensayo',
  misa: 'misa',
  reunion: 'reunion',
  partido: 'salida'
};
const REFERENCIAS = ['ensayo', 'misa', 'reunion', 'salida', 'otro'];
const MOTIVOS = ['trabajo', 'licencia_medica', 'estudio', 'otro'];
const CONDICIONES = ['bailarin', 'socio'];

function textoActividad(j) {
  return j.evento || j.referencia_otro || 'actividad';
}

function avisarSocio(justificacion, extra) {
  emailService.notificarResolucionJustificacion({
    persona: justificacion,
    folio: justificacion.id,
    actividad: textoActividad(justificacion),
    ...extra
  }).catch(err => console.error('[Email] Error avisando resolución de justificación:', err));
}

exports.listar = (req, res) => {
  const estado = ESTADOS_FILTRO.includes(req.query.estado) ? req.query.estado : null;

  justificacionModel.listarJustificaciones(estado)
    .then(rows => res.json(rows))
    .catch(err => {
      console.error('Error listando justificaciones:', err);
      res.status(500).json({ mensaje: 'Error al listar justificaciones' });
    });
};

exports.listarPostulaciones = (req, res) => {
  justificacionModel.listarPostulaciones()
    .then(rows => res.json(rows))
    .catch(err => {
      console.error('Error listando postulaciones:', err);
      res.status(500).json({ mensaje: 'Error al listar postulaciones' });
    });
};

function avisarPostulacion(id, extra) {
  justificacionModel.obtenerPostulacion(id)
    .then(postulacion => postulacion && emailService.notificarResolucionPostulacion({ postulacion, ...extra }))
    .catch(err => console.error('[Email] Error avisando resolución de postulación:', err));
}

// Aceptar una postulación a bloques: la directiva elige la 1ª o 2ª opción y queda
// como bloque del integrante en su ficha.
exports.aceptarPostulacion = async (req, res) => {
  const id = Number(req.params.id);
  const opcion = Number(req.body?.opcion);
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;

  if (![1, 2].includes(opcion)) {
    return res.status(400).json({ mensaje: 'Indica qué opción se asigna (1ª o 2ª)' });
  }

  try {
    const r = await justificacionModel.aceptarPostulacion({ id, opcion, observacion, usuarioId: req.usuario.id });

    if (r.resultado === 'no_encontrada') return res.status(404).json({ mensaje: 'Postulación no encontrada' });
    if (r.resultado === 'ya_revisada') return res.status(409).json({ mensaje: 'Esta postulación ya fue revisada' });
    if (r.resultado === 'sin_opcion') return res.status(400).json({ mensaje: 'La postulación no tiene 2ª opción' });

    avisarPostulacion(id, { aprobada: true, observacion });
    res.json({ mensaje: `Postulación aceptada. El integrante quedó en el bloque ${r.bloque}.` });
  } catch (err) {
    console.error('Error aceptando postulación:', err);
    res.status(500).json({ mensaje: 'No se pudo aceptar la postulación' });
  }
};

exports.rechazarPostulacion = async (req, res) => {
  const id = Number(req.params.id);
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;

  if (!observacion) {
    return res.status(400).json({ mensaje: 'Indica el motivo del rechazo (se le informa al integrante)' });
  }

  try {
    const result = await justificacionModel.rechazarPostulacion({ id, observacion, usuarioId: req.usuario.id });
    if (!result.affectedRows) {
      return res.status(409).json({ mensaje: 'La postulación no existe o ya fue revisada' });
    }

    avisarPostulacion(id, { aprobada: false, observacion });
    res.json({ mensaje: 'Postulación rechazada' });
  } catch (err) {
    console.error('Error rechazando postulación:', err);
    res.status(500).json({ mensaje: 'No se pudo rechazar la postulación' });
  }
};

exports.aprobar = async (req, res) => {
  const id = Number(req.params.id);
  const estadoAplicado = req.body?.estado_aplicado;
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;

  if (!ESTADOS_APLICABLES.includes(estadoAplicado)) {
    return res.status(400).json({ mensaje: 'Indica si se registra como justificado o licencia médica' });
  }

  try {
    const r = await justificacionModel.aprobarJustificacion({
      id, estadoAplicado, observacion, usuarioId: req.usuario.id
    });

    if (r.resultado === 'no_encontrada') {
      return res.status(404).json({ mensaje: 'Justificación no encontrada' });
    }
    if (r.resultado === 'ya_revisada') {
      return res.status(409).json({ mensaje: 'Esta justificación ya fue revisada' });
    }

    // Igual que el resto de cambios de asistencia: no bloquea la respuesta.
    if (r.asistenciaAplicada) {
      puntajeModel.recalcularPuntajesAsistencia(r.persona_id)
        .catch(err => console.error('Error recalculando puntaje tras justificación:', err));
    }

    const justificacion = await justificacionModel.obtenerJustificacion(id);
    if (justificacion) {
      avisarSocio(justificacion, { aprobada: true, estadoAplicado, observacion });
    }

    let mensaje = 'Justificación aprobada.';
    if (r.sinEvento) {
      mensaje += ' No estaba asociada a una actividad del sistema: no se modificó ninguna asistencia.';
    } else if (r.asistenciaAplicada) {
      mensaje += ' La asistencia quedó registrada como justificada y el puntaje se recalculará.';
    } else {
      mensaje += ` La asistencia ya figuraba como "${String(r.estadoAsistencia || '').replace(/_/g, ' ')}" y no se modificó.`;
    }

    res.json({ mensaje });
  } catch (err) {
    console.error('Error aprobando justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo aprobar la justificación' });
  }
};

exports.rechazar = async (req, res) => {
  const id = Number(req.params.id);
  const observacion = String(req.body?.observacion || '').trim().substring(0, 300) || null;

  if (!observacion) {
    return res.status(400).json({ mensaje: 'Indica el motivo del rechazo (se le informa al integrante)' });
  }

  try {
    const result = await justificacionModel.rechazarJustificacion({
      id, observacion, usuarioId: req.usuario.id
    });

    if (!result.affectedRows) {
      return res.status(409).json({ mensaje: 'La justificación no existe o ya fue revisada' });
    }

    const justificacion = await justificacionModel.obtenerJustificacion(id);
    if (justificacion) {
      avisarSocio(justificacion, { aprobada: false, observacion });
    }

    res.json({ mensaje: 'Justificación rechazada' });
  } catch (err) {
    console.error('Error rechazando justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo rechazar la justificación' });
  }
};

// =====================================
// JUSTIFICACIÓN MANUAL (multipart: adjunto opcional)
// =====================================
// Cartas que no llegan por el Portal (p. ej. al correo antiguo de la agrupación):
// la directiva las ingresa y quedan aprobadas al tiro, con el mismo efecto que
// aprobar una del Portal. Solo actividades de la temporada vigente y de hasta un
// mes atrás (obtenerDesdeJustificacionManual).

function descartarArchivo(req) {
  if (req.file) fs.unlink(req.file.path, () => {});
}

function textoLimpio(valor, max) {
  return String(valor ?? '').trim().substring(0, max);
}

async function desdeJustificacionManual() {
  const inicioTemporada = await puntajeModel.obtenerInicioTemporadaVigente();
  return justificacionModel.obtenerDesdeJustificacionManual(inicioTemporada);
}

exports.opcionesManual = async (req, res) => {
  try {
    const desde = await desdeJustificacionManual();
    const [integrantes, eventos] = await Promise.all([
      justificacionModel.listarIntegrantesJustificacionManual(),
      justificacionModel.listarEventosJustificacionManual(desde)
    ]);
    res.json({ desde, integrantes, eventos });
  } catch (err) {
    console.error('Error cargando opciones de justificación manual:', err);
    res.status(500).json({ mensaje: 'Error al cargar integrantes y actividades' });
  }
};

exports.registrarManual = async (req, res) => {
  const body = req.body || {};
  const personaId = Number(body.persona_id);
  const eventoId = body.evento_id ? Number(body.evento_id) : null;
  const motivoTipo = body.motivo_tipo;
  const estadoAplicado = body.estado_aplicado;
  const condicion = body.condicion;
  const motivo = textoLimpio(body.motivo, 3000);
  const observacion = textoLimpio(body.observacion, 300) || null;

  const rechazar = (status, mensaje) => {
    descartarArchivo(req);
    res.status(status).json({ mensaje });
  };

  if (!personaId) return rechazar(400, 'Selecciona el integrante');
  if (!MOTIVOS.includes(motivoTipo)) return rechazar(400, 'Indica el motivo: trabajo, licencia médica, estudio u otros');
  if (!ESTADOS_APLICABLES.includes(estadoAplicado)) return rechazar(400, 'Indica si se registra como justificado o licencia médica');
  if (!CONDICIONES.includes(condicion)) return rechazar(400, 'Indica la condición (bailarín o socio)');
  if (!motivo) return rechazar(400, 'Escribe el motivo que indica la carta');

  try {
    if (req.file) {
      const firmaValida = await uploadJustificativo.verificarFirmaArchivo(req.file.path, req.file.mimetype)
        .catch(() => false);
      if (!firmaValida) return rechazar(400, 'El archivo no corresponde a una imagen o PDF válido');
    }

    if (!await justificacionModel.obtenerIntegranteJustificacionManual(personaId)) {
      return rechazar(404, 'Integrante no encontrado o retirado');
    }

    const desde = await desdeJustificacionManual();
    let evento = null;
    let referencia;
    let referenciaOtro = null;
    let fechaActividad;

    if (eventoId) {
      evento = await justificacionModel.obtenerEventoJustificacionManual(eventoId, desde);
      if (!evento) {
        return rechazar(409, `Esa actividad no se puede justificar a mano: solo de la temporada en curso y desde el ${desde.split('-').reverse().join('-')}.`);
      }
      referencia = REFERENCIA_POR_TIPO_EVENTO[evento.tipo] || 'otro';
      fechaActividad = String(evento.fecha).substring(0, 10);
    } else {
      // Actividad que no está registrada en el sistema: solo queda la constancia.
      referencia = body.referencia;
      referenciaOtro = textoLimpio(body.referencia_otro, 150) || null;
      fechaActividad = String(body.fecha_actividad || '');

      if (!REFERENCIAS.includes(referencia)) return rechazar(400, 'Indica el tipo de actividad');
      if (!referenciaOtro) return rechazar(400, 'Indica el nombre de la actividad');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaActividad) || fechaActividad < desde) {
        return rechazar(400, `La fecha de la actividad debe ser desde el ${desde.split('-').reverse().join('-')} (temporada en curso, máximo un mes atrás).`);
      }
    }

    const r = await justificacionModel.crearJustificacionManual({
      persona_id: personaId,
      evento_id: evento ? evento.id : null,
      referencia,
      referencia_otro: referenciaOtro,
      fecha_actividad: fechaActividad,
      motivo_tipo: motivoTipo,
      estado_aplicado: estadoAplicado,
      condicion,
      motivo,
      observacion,
      adjunto_path: req.file ? `justificativos/${req.file.filename}` : null,
      usuario_id: req.usuario.id
    });

    if (r.resultado === 'duplicada') {
      return rechazar(409, `Este integrante ya tiene una justificación pendiente o aprobada para esa actividad (folio ${emailService.formatearFolio(r.folio)}).`);
    }
    if (r.resultado === 'asistio') {
      return rechazar(409, `No se registró: su asistencia a esa actividad figura como "${String(r.estadoAsistencia || '').replace(/_/g, ' ')}".`);
    }

    if (!r.sinEvento) {
      puntajeModel.recalcularPuntajesAsistencia(personaId)
        .catch(err => console.error('Error recalculando puntaje tras justificación manual:', err));
    }

    const justificacion = await justificacionModel.obtenerJustificacion(r.folio);
    if (justificacion) {
      avisarSocio(justificacion, { aprobada: true, estadoAplicado, observacion, manual: true });
    }

    let mensaje = `Justificación registrada y aprobada con folio ${emailService.formatearFolio(r.folio)}.`;
    mensaje += r.sinEvento
      ? ' No está asociada a una actividad del sistema: no se modificó ninguna asistencia.'
      : ' La asistencia quedó registrada como justificada y el puntaje se recalculará.';
    if (justificacion && justificacion.email) mensaje += ' Se le avisa al integrante por correo.';

    res.status(201).json({ folio: r.folio, mensaje });
  } catch (err) {
    descartarArchivo(req);
    console.error('Error registrando justificación manual:', err);
    res.status(500).json({ mensaje: 'No se pudo registrar la justificación' });
  }
};

exports.descargarAdjunto = async (req, res) => {
  try {
    const justificacion = await justificacionModel.obtenerJustificacion(Number(req.params.id));

    if (!justificacion || !justificacion.adjunto_path) {
      return res.status(404).json({ mensaje: 'Esta justificación no tiene archivo adjunto' });
    }

    enviarArchivoSubido(
      res,
      justificacion.adjunto_path,
      `justificativo-folio-${emailService.formatearFolio(justificacion.id)}`,
      'Archivo no encontrado en el servidor'
    );
  } catch (err) {
    console.error('Error descargando adjunto de justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo descargar el archivo' });
  }
};
