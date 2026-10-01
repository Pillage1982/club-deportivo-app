// Panel admin "Justificaciones": revisión de las cartas enviadas desde el Portal
// del Socio. Aprobar cambia la asistencia del evento a justificado/licencia_medica
// (Art. 8.4) y recalcula el puntaje del integrante; rechazar solo deja constancia.
// En ambos casos se avisa al socio por correo si tiene email.
const fs = require('fs');
const path = require('path');
const justificacionModel = require('../models/justificacionModel');
const puntajeModel = require('../models/puntajeModel');
const emailService = require('../services/emailService');

const ESTADOS_FILTRO = ['pendiente', 'aprobada', 'rechazada'];
const ESTADOS_APLICABLES = ['justificado', 'licencia_medica'];

const MIME_POR_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf'
};

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

exports.descargarAdjunto = async (req, res) => {
  try {
    const justificacion = await justificacionModel.obtenerJustificacion(Number(req.params.id));

    if (!justificacion || !justificacion.adjunto_path) {
      return res.status(404).json({ mensaje: 'Esta justificación no tiene archivo adjunto' });
    }

    const rutaArchivo = path.join(__dirname, '..', 'uploads', justificacion.adjunto_path);
    const extension = path.extname(rutaArchivo).toLowerCase();

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ mensaje: 'Archivo no encontrado en el servidor' });
    }

    res.set('Content-Disposition', `attachment; filename="justificativo-folio-${emailService.formatearFolio(justificacion.id)}${extension}"`);
    res.type(MIME_POR_EXTENSION[extension] || 'application/octet-stream');
    res.sendFile(rutaArchivo);
  } catch (err) {
    console.error('Error descargando adjunto de justificación:', err);
    res.status(500).json({ mensaje: 'No se pudo descargar el archivo' });
  }
};
