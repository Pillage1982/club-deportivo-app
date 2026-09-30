// Servicio de correo: crea el transporte y notifica ausencias sin bloquear el cierre de una actividad.
let nodemailer = null;

try {
  nodemailer = require('nodemailer');
} catch (e) {
  console.warn('[Email] nodemailer no disponible. Ejecute npm install en el servidor.');
}

function emailConfigurado() {
  if (!nodemailer) return false;
  const pass = process.env.EMAIL_PASS || '';
  return pass.length > 0 && pass !== 'REEMPLAZAR_CON_CLAVE_DE_APLICACION';
}

function crearTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
}

function enviarCorreo({ destinatario, asunto, cuerpo }) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Correo no enviado a:', destinatario);
    return Promise.resolve();
  }

  return crearTransporter().sendMail({
    from: `"Gran Diablada Calameña" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    subject: asunto,
    html: cuerpo
  });
}

function formatearFechaTexto(fecha) {
  if (!fecha) return '';

  const d = new Date(String(fecha).replace(' ', 'T'));

  if (Number.isNaN(d.getTime())) return String(fecha).substring(0, 10);

  return d.toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function notificarAusenteEvento(persona, evento) {
  const nombre = [
    persona.nombres,
    persona.apellido_paterno,
    persona.apellido_materno || ''
  ].join(' ').trim();

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Gran Diablada Calameña</h2>
      <p>Estimado/a <strong>${nombre}</strong>,</p>
      <p>
        La actividad <strong>${evento.nombre}</strong>
        del ${formatearFechaTexto(evento.fecha)}
        ha sido finalizada.
      </p>
      <p>
        Tu asistencia quedó registrada como <strong style="color: #dc3545;">Ausente</strong>.
        Se ha generado una multa de <strong>$5.000</strong> por inasistencia.
      </p>
      <p>
        Si tienes algún justificativo, comunícalo con la directiva para que
        sea evaluado según los protocolos de la agrupación.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Este es un mensaje automático. No responder a este correo.
      </p>
    </div>
  `;

  return enviarCorreo({
    destinatario: persona.email,
    asunto: `Ausencia registrada — ${evento.nombre}`,
    cuerpo
  });
}

async function notificarAusentesEvento(ausentes, evento) {
  if (!ausentes || ausentes.length === 0) return;

  const conEmail = ausentes.filter(p => p.email && p.email.trim() !== '');

  if (conEmail.length === 0) {
    console.log('[Email] Ningún ausente tiene email registrado.');
    return;
  }

  console.log(`[Email] Enviando notificaciones a ${conEmail.length} ausente(s)...`);

  const resultados = await Promise.allSettled(
    conEmail.map(persona => notificarAusenteEvento(persona, evento))
  );

  const enviados = resultados.filter(r => r.status === 'fulfilled').length;
  const fallidos = resultados.filter(r => r.status === 'rejected').length;

  if (fallidos > 0) {
    resultados
      .filter(r => r.status === 'rejected')
      .forEach(r => console.error('[Email] Error al enviar:', r.reason));
  }

  console.log(`[Email] ${enviados} enviados, ${fallidos} fallidos.`);
}

// Enlace de "¿Olvidaste tu contraseña?" (directiva) o "¿Olvidaste tu PIN?" (socio).
// Devuelve false si el correo no está configurado, para que el controlador lo
// registre en el log (al usuario siempre se le responde un mensaje genérico).
function enviarEnlaceRecuperacion({ destinatario, nombre, enlace, esSocio, minutosVigencia }) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Enlace de recuperación no enviado a:', destinatario);
    return Promise.resolve(false);
  }

  const queCambia = esSocio ? 'tu PIN del Portal del Socio' : 'tu contraseña del panel de la directiva';
  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Gran Diablada Calameña</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer ${queCambia}.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${enlace}" style="background: #f47a22; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Crear ${esSocio ? 'un PIN nuevo' : 'una contraseña nueva'}
        </a>
      </p>
      <p style="font-size: 13px; color: #555;">
        El enlace sirve una sola vez y vence en ${minutosVigencia} minutos.
        Si no fuiste tú, ignora este correo: tu clave actual sigue funcionando.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Este es un mensaje automático. No respondas a este correo.
      </p>
    </div>
  `;

  return enviarCorreo({
    destinatario,
    asunto: esSocio ? 'Restablecer tu PIN — Gran Diablada Calameña' : 'Restablecer tu contraseña — Gran Diablada Calameña',
    cuerpo
  }).then(() => true);
}

module.exports = { notificarAusentesEvento, enviarEnlaceRecuperacion };
