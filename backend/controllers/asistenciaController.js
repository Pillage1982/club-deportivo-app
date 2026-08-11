// Controlador HTTP de asistencias: valida solicitudes y coordina asistencia, multas, eventos y puntaje.
// =====================================
// MODELO ASISTENCIAS
// =====================================

const asistenciaModel = require('../models/asistenciaModel');
const multaModel      = require('../models/multaModel');
const eventoModel     = require('../models/eventoModel');
const puntajeModel    = require('../models/puntajeModel');
const { calcularPuntosAsistencia } = require('../utils/estatutoGdcRules');

// ── Puntaje ───────────────────────────────────────────────────────────────────

function insertarPuntajeBackground(persona_id, asistencia_id, evento, estado) {
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

  eventoModel.obtenerEventoPorId(req.body.evento_id, (err, evento) => {

    if (err) {
      return res.status(500).json({ mensaje: 'Error al verificar actividad' });
    }

    if (!evento) {
      return res.status(404).json({ mensaje: 'Actividad no encontrada' });
    }

    if (evento.finalizado) {
      return res.status(403).json({
        mensaje: 'Esta actividad ya fue finalizada. No se puede registrar asistencia.'
      });
    }

    registrarAsistenciaInterna(req, res, evento);

  });

};

function registrarAsistenciaInterna(req, res, evento) {

  asistenciaModel.crearAsistencia(req.body, (err, result) => {

    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          mensaje: 'La asistencia ya fue registrada para este integrante en esta actividad.'
        });
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
