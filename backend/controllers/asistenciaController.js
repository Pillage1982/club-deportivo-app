// Controlador HTTP de asistencias: valida solicitudes y coordina asistencia, multas, eventos y puntaje.
// =====================================
// MODELO ASISTENCIAS
// =====================================

const asistenciaModel = require('../models/asistenciaModel');
const multaModel      = require('../models/multaModel');
const multasConfig    = require('../config/multas');
const eventoModel     = require('../models/eventoModel');
const puntajeModel    = require('../models/puntajeModel');
const { calcularPuntosAsistencia, esEventoProvisional } = require('../utils/estatutoGdcRules');

// Mismas opciones que el selector de estado del formulario de asistencia.
const ESTADOS_REGISTRABLES = [
  'presente', 'atrasado', 'ausente', 'justificado',
  'licencia_medica', 'vestimenta_distinta', 'retiro_sin_aviso'
];

// Estados que deja una justificación aprobada (justificacionModel).
const ESTADOS_JUSTIFICACION = ['justificado', 'licencia_medica'];

// Un escaneo offline sincronizado después del cierre de la actividad se acepta si
// se hizo el mismo día de la actividad o hasta estas horas después de su inicio
// (mismo plazo que el selector de toma de asistencia, config.js →
// horasActividadSeleccionable).
const HORAS_ESCANEO_TRAS_INICIO = 12;

// ── Hora del escaneo ──────────────────────────────────────────────────────────

// 'YYYY-MM-DD HH:mm:ss' en hora de Chile (como guarda MySQL las fechas, db.js).
function fechaHoraChile(fecha) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(fecha).map(parte => [parte.type, parte.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// Hora del escaneo enviada por la cola offline (ISO). null si no viene, es
// inválida o está en el futuro (reloj del teléfono adelantado más de 5 min).
function horaEscaneoOffline(valor) {
  if (!valor) return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime()) || fecha.getTime() > Date.now() + 5 * 60000) return null;
  return fechaHoraChile(fecha);
}

// Fechas locales 'YYYY-MM-DD HH:mm:ss' a milisegundos comparables entre sí.
const msLocal = texto => Date.parse(`${String(texto).substring(0, 19).replace(' ', 'T')}Z`);

function escaneoDuranteActividad(fechaRegistro, evento) {
  if (!fechaRegistro) return false;
  const inicio = String(evento.fecha);
  if (fechaRegistro.substring(0, 10) === inicio.substring(0, 10)) return true;
  const diferencia = msLocal(fechaRegistro) - msLocal(inicio);
  return diferencia >= 0 && diferencia <= HORAS_ESCANEO_TRAS_INICIO * 3600000;
}

// ── Puntaje ───────────────────────────────────────────────────────────────────

function insertarPuntajeBackground(persona_id, asistencia_id, evento, estado) {
  // Mismo criterio que recalcularPuntajesAsistencia: las provisionales no puntúan.
  if (esEventoProvisional(evento.nombre)) return;

  const fechaStr = String(evento.fecha).substring(0, 10);
  const [anio, mesStr] = fechaStr.split('-');
  const mes = Number(mesStr);

  puntajeModel.verificarCuotaAlDia(persona_id, mes, Number(anio))
    .then(rows => {
      const cuotaAlDia = Boolean(rows[0].al_dia);
      const resultado  = calcularPuntosAsistencia(estado, cuotaAlDia);
      if (!resultado) return; // ausente
      return puntajeModel.insertarPuntaje({
        persona_id,
        asistencia_id,
        evento_id: evento.id,
        puntos:    resultado.puntos,
        detalle:   resultado.detalle,
        fecha:     fechaStr
      });
    })
    .catch(err => console.error('Error insertando puntaje:', err));
}

// ── Multa ─────────────────────────────────────────────────────────────────────

function calcularMultaAsistencia(estado, minutos) {
  if (!multasConfig.habilitadas) return null;

  if (estado === 'ausente') {
    return { monto: 5000, motivo: 'Inasistencia a actividad' };
  }

  if (estado === 'atrasado') {
    const mins = Number(minutos) || 0;
    return {
      monto: mins < 10 ? 1000 : 3000,
      motivo: 'Atraso a actividad'
    };
  }

  return null;
}

// =====================================
// REGISTRAR ASISTENCIA
// =====================================
exports.registrar = (req, res) => {

  if (!ESTADOS_REGISTRABLES.includes(req.body.estado)) {
    return res.status(400).json({ mensaje: 'Estado de asistencia no válido' });
  }

  // Solo la cola offline manda escaneado_en (hora real del escaneo).
  req.body.fecha_registro = horaEscaneoOffline(req.body.escaneado_en);

  eventoModel.obtenerEventoPorId(req.body.evento_id, (err, evento) => {

    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar actividad' });
    }

    if (!evento) {
      return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    }

    if (evento.finalizado) {
      if (escaneoDuranteActividad(req.body.fecha_registro, evento)) {
        return registrarEscaneoTrasCierre(req, res, evento);
      }
      return res.status(403).json({
        mensaje: 'Esta actividad ya fue finalizada. No se puede registrar asistencia.'
      });
    }

    registrarAsistenciaInterna(req, res, evento);

  });

};

// Escaneo hecho sin conexión durante la actividad, que se sincroniza cuando ya
// fue finalizada desde otro equipo: el integrante quedó como ausente al cerrar y
// se corrige con lo escaneado. Si no tiene registro (no estaba activo al cerrar)
// se registra como cualquier asistencia.
async function registrarEscaneoTrasCierre(req, res, evento) {
  const minutos = req.body.estado === 'atrasado' ? Number(req.body.minutos) || 0 : 0;

  try {
    const asistencia = await asistenciaModel.reemplazarAusentePorEscaneo({
      evento_id: evento.id,
      persona_id: req.body.persona_id,
      estado: req.body.estado,
      minutos,
      fecha_registro: req.body.fecha_registro
    });

    if (!asistencia) {
      return registrarAsistenciaInterna(req, res, evento);
    }

    insertarPuntajeBackground(req.body.persona_id, asistencia.id, evento, req.body.estado);

    const multa = calcularMultaAsistencia(req.body.estado, minutos);
    if (multa) {
      multaModel.crearMultaAsistencia({
        persona_id: req.body.persona_id,
        asistencia_id: asistencia.id,
        monto: multa.monto,
        motivo: multa.motivo
      }, multaErr => {
        if (multaErr) console.error('Error creando multa:', multaErr);
      });
    }

    res.json({ mensaje: 'Asistencia registrada (escaneo sin conexión de una actividad ya finalizada)' });
  } catch (err) {
    console.error('Error registrando escaneo tras cierre:', err);
    res.status(500).json({ mensaje: 'Error al registrar asistencia' });
  }
}

// El integrante ya tiene registro en la actividad. Si es por una justificación
// aprobada (justificado / licencia médica, que la aprobación crea aunque la
// actividad no haya ocurrido), queda bloqueado para esa actividad: no se
// registra su asistencia aunque se presente (definición del cliente, oct-2026).
function responderAsistenciaExistente(req, res, evento) {
  asistenciaModel.obtenerEstadoAsistencia(evento.id, req.body.persona_id)
    .then(estado => {
      if (ESTADOS_JUSTIFICACION.includes(estado)) {
        return res.status(409).json({
          codigo: 'JUSTIFICACION_APROBADA',
          mensaje: `El integrante tiene una justificación aprobada (${estado === 'licencia_medica' ? 'licencia médica' : 'justificado'}) para esta actividad: no se registra su asistencia.`
        });
      }
      res.status(409).json({
        mensaje: 'La asistencia ya fue registrada para este integrante en esta actividad.'
      });
    })
    .catch(err => {
      console.error('Error consultando asistencia existente:', err);
      res.status(409).json({
        mensaje: 'La asistencia ya fue registrada para este integrante en esta actividad.'
      });
    });
}

function registrarAsistenciaInterna(req, res, evento) {

  asistenciaModel.crearAsistencia(req.body, (err, result) => {

    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return responderAsistenciaExistente(req, res, evento);
      }

      console.error('Error registrando asistencia:', err);
      return res.status(500).json({
        mensaje: 'Error al registrar asistencia'
      });
    }

    if (!result || result.affectedRows === 0) {
      return res.status(400).json({
        mensaje: 'El integrante no esta activo para registrar asistencia.'
      });
    }

    // Puntaje: fire-and-forget, no bloquea la respuesta
    insertarPuntajeBackground(req.body.persona_id, result.insertId, evento, req.body.estado);

    const multa = calcularMultaAsistencia(req.body.estado, req.body.minutos);

    if (!multa) {
      return res.json({ mensaje: 'Asistencia registrada' });
    }

    multaModel.crearMultaAsistencia({
      persona_id: req.body.persona_id,
      asistencia_id: result.insertId,
      monto: multa.monto,
      motivo: multa.motivo
    }, (multaErr, multaResult) => {
      if (multaErr) {
        console.error('Error creando multa:', multaErr);
        return res.json({
          mensaje: `Asistencia registrada. (Multa no generada: ${multaErr.message})`
        });
      }

      res.json({
        mensaje: multaResult && multaResult.affectedRows > 0
          ? `Asistencia registrada. Multa de $${multa.monto} generada.`
          : 'Asistencia registrada'
      });
    });

  });

};

// =====================================
// VESTIMENTA DISTINTA / RETIRO SIN AVISO
// =====================================
// Body: { activo: true|false }. Marcar reemplaza presente/atrasado (o la otra
// marca); quitarla vuelve a atrasado si el registro tiene minutos de atraso, si
// no a presente. Recalcula el puntaje.
const NOMBRE_MARCA = {
  vestimenta_distinta: 'vestimenta distinta',
  retiro_sin_aviso: 'retiro sin aviso'
};

exports.marcarEstadoManual = estadoMarca => async (req, res) => {
  const marcar = req.body.activo === true || req.body.activo === 'true';
  const nombre = NOMBRE_MARCA[estadoMarca];

  try {
    const asistencia = await asistenciaModel.obtenerAsistenciaPorId(req.params.id);

    if (!asistencia) {
      return res.status(404).json({ mensaje: 'Asistencia no encontrada' });
    }

    if (!asistenciaModel.ESTADOS_MARCABLES.includes(asistencia.estado)) {
      return res.status(400).json({
        mensaje: `Solo se puede marcar ${nombre} en una asistencia presente o atrasada.`
      });
    }

    if (!marcar && asistencia.estado !== estadoMarca) {
      return res.status(400).json({ mensaje: `La asistencia no está marcada con ${nombre}.` });
    }

    const estadoNuevo = marcar
      ? estadoMarca
      : (Number(asistencia.minutos_atraso) > 0 ? 'atrasado' : 'presente');

    await asistenciaModel.actualizarEstadoManual(asistencia.id, estadoNuevo);

    puntajeModel.recalcularPuntajesAsistencia(asistencia.persona_id)
      .catch(err => console.error(`Error recalculando puntaje tras ${nombre}:`, err));

    res.json({
      mensaje: marcar
        ? `Asistencia marcada con ${nombre}. El puntaje se recalculará.`
        : `Se quitó ${nombre}. El puntaje se recalculará.`,
      estado: estadoNuevo
    });
  } catch (err) {
    console.error(`Error actualizando ${nombre}:`, err);
    res.status(500).json({ mensaje: 'Error al actualizar la asistencia' });
  }
};

// =====================================
// LISTAR ASISTENCIAS
// =====================================

exports.listar = (req, res) => {

  asistenciaModel.obtenerAsistencias((err, results) => {

    if (err) {
      return res.status(500).send(err);
    }

    res.json(results);

  });

};
