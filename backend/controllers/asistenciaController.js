// =====================================
// MODELO ASISTENCIAS
// =====================================

const asistenciaModel = require('../models/asistenciaModel');
const multaModel = require('../models/multaModel');
const eventoModel = require('../models/eventoModel');

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

// Mismas opciones que el selector de estado del formulario de asistencia.
const ESTADOS_REGISTRABLES = ['presente', 'atrasado', 'ausente'];

// Un escaneo offline sincronizado después del cierre de la actividad se acepta si
// se hizo el mismo día de la actividad o hasta estas horas después de su inicio.
const HORAS_ESCANEO_TRAS_INICIO = 12;

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

    registrarAsistenciaInterna(req, res);

  });

};

// Escaneo hecho sin conexión durante la actividad, que se sincroniza cuando ya
// fue finalizada desde otro equipo: el integrante quedó como ausente (con su
// multa) al cerrar y se corrige con lo escaneado. Si no tiene registro (no estaba
// activo al cerrar) se registra como cualquier asistencia.
function registrarEscaneoTrasCierre(req, res, evento) {
  const data = {
    evento_id: evento.id,
    persona_id: req.body.persona_id,
    estado: req.body.estado,
    minutos: req.body.estado === 'atrasado' ? Number(req.body.minutos) || 0 : 0,
    fecha_registro: req.body.fecha_registro
  };

  asistenciaModel.reemplazarAusentePorEscaneo(data, (err, asistenciaId) => {
    if (err) {
      console.error('Error registrando escaneo tras cierre:', err);
      return res.status(500).json({ mensaje: 'Error al registrar asistencia' });
    }

    if (!asistenciaId) {
      return registrarAsistenciaInterna(req, res);
    }

    // Reemplaza la multa de inasistencia por la que corresponda (o ninguna).
    asistenciaModel.crearMultaSiCorresponde(data, asistenciaId, multaErr => {
      if (multaErr) console.error('Error ajustando multa tras escaneo:', multaErr);
      res.json({ mensaje: 'Asistencia registrada (escaneo sin conexión de una actividad ya finalizada)' });
    });
  });
}

function registrarAsistenciaInterna(req, res) {

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

    const multa = calcularMultaAsistencia(req.body.estado, req.body.minutos);

    if (!multa) {
      return res.json({ mensaje: 'Asistencia registrada' });
    }

    multaModel.crearMultaAsistencia({
      persona_id: req.body.persona_id,
      asistencia_id: result.insertId,
      monto: multa.monto,
      motivo: multa.motivo
    }, (multaErr) => {
      if (multaErr) {
        console.error('Error creando multa:', multaErr);
        return res.json({
          mensaje: `Asistencia registrada. (Multa no generada: ${multaErr.message})`
        });
      }

      res.json({
        mensaje: `Asistencia registrada. Multa de $${multa.monto} generada.`
      });
    });

  });

}

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
