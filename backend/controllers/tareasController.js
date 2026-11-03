// Tareas programadas disparadas por un cron externo (Hostinger), no desde el panel.
// Se protegen con un token (CRON_TOKEN) en vez de sesión de usuario, porque las
// invoca una máquina. Sin CRON_TOKEN configurado, la tarea queda deshabilitada.
const cumpleanosModel = require('../models/cumpleanosModel');
const emailService = require('../services/emailService');

function tokenValido(req) {
  const esperado = process.env.CRON_TOKEN;
  if (!esperado) return false;
  const recibido = req.get('x-cron-token') || req.query.token || '';
  return recibido === esperado;
}

// GET /tareas/cumpleanos?token=... → envía el saludo a los cumpleañeros de hoy
// (hora de Chile) y marca cada envío para no repetirlo.
// Con &simular=1 solo devuelve a quién se enviaría, sin enviar ni marcar nada:
// sirve para verificar en dev (BD real pero desactualizada) sin mandar correos.
exports.enviarCumpleanos = async (req, res) => {
  if (!tokenValido(req)) {
    return res.status(403).json({ mensaje: 'No autorizado' });
  }

  const simular = req.query.simular === '1' || req.query.simular === 'true';
  const hoy = new Date().toISOString().substring(0, 10);

  try {
    const cumpleaneros = await cumpleanosModel.obtenerCumpleanerosHoy();

    if (simular) {
      return res.json({
        simulacion: true,
        fecha: hoy,
        candidatos: cumpleaneros.length,
        destinatarios: cumpleaneros.map(p => ({
          id: p.id,
          nombre: `${p.nombres} ${p.apellido_paterno || ''}`.trim(),
          email: p.email
        }))
      });
    }

    let enviados = 0;
    const errores = [];

    for (const persona of cumpleaneros) {
      try {
        const ok = await emailService.enviarSaludoCumpleanos(persona);
        if (ok) {
          await cumpleanosModel.marcarEnviado(persona.id);
          enviados += 1;
        }
      } catch (err) {
        console.error('[Cumpleaños] Error enviando saludo a persona', persona.id, err);
        errores.push({ id: persona.id, error: err && err.message ? err.message : String(err) });
      }
    }

    res.json({
      fecha: hoy,
      candidatos: cumpleaneros.length,
      enviados,
      errores
    });
  } catch (err) {
    console.error('[Cumpleaños] Error ejecutando la tarea:', err);
    res.status(500).json({ mensaje: 'Error ejecutando la tarea de cumpleaños' });
  }
};
