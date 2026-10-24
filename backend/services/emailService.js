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

// Sin EMAIL_HOST se usa Gmail. Con EMAIL_HOST se usa ese SMTP, p. ej. los
// buzones del dominio de la organización en Hostinger:
// EMAIL_HOST=smtp.hostinger.com, EMAIL_PORT=465.
function crearTransporter() {
  const auth = {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  };

  if (process.env.EMAIL_HOST) {
    const port = Number(process.env.EMAIL_PORT) || 465;
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      auth
    });
  }

  return nodemailer.createTransport({ service: 'gmail', auth });
}

function nombreOrganizacion() {
  return process.env.ORG_NOMBRE || 'NexoComunidad';
}

// cc, replyTo y adjuntos (formato attachments de nodemailer) son opcionales.
function enviarCorreo({ destinatario, asunto, cuerpo, cc, replyTo, adjuntos }) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Correo no enviado a:', destinatario);
    return Promise.resolve();
  }

  return crearTransporter().sendMail({
    from: `"${nombreOrganizacion()}" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    cc: cc || undefined,
    replyTo: replyTo || undefined,
    subject: asunto,
    html: cuerpo,
    attachments: adjuntos || undefined
  });
}

// Datos de la BD (nombres, actividades...) van dentro del HTML del correo.
function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function formatearFechaTexto(fecha) {
  if (!fecha) return '';
  const d = new Date(String(fecha).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(fecha).substring(0, 10);
  return d.toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
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
      <h2 style="color: #333;">${escaparHtml(nombreOrganizacion())}</h2>
      <p>Estimado/a <strong>${escaparHtml(nombre)}</strong>,</p>
      <p>
        La actividad <strong>${escaparHtml(evento.nombre)}</strong>
        del ${escaparHtml(formatearFechaTexto(evento.fecha))}
        ha sido finalizada.
      </p>
      <p>
        Tu asistencia quedó registrada como <strong style="color: #dc3545;">Ausente</strong>.
      </p>
      <p>
        Si tienes algún justificativo, comunícalo con la directiva para que
        sea evaluado según los protocolos de la organización.
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

// Envía el PIN de acceso al Portal del Socio (alta o regeneración). Fire-and-forget
// desde el controlador: si no hay email o el envío falla, el admin igual recibió
// el PIN en la respuesta para entregarlo a mano (ver socioAuthController).
function enviarPinAcceso(persona, pin) {
  if (!persona.email || !persona.email.trim()) {
    return Promise.resolve();
  }

  const nombre = [
    persona.nombres,
    persona.apellido_paterno,
    persona.apellido_materno || ''
  ].join(' ').trim();

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${escaparHtml(nombreOrganizacion())}</h2>
      <p>Estimado/a <strong>${escaparHtml(nombre)}</strong>,</p>
      <p>Ya puedes ingresar al Portal del Socio para ver tu información personal y tu estado financiero.</p>
      <p style="font-size: 14px;">Tu acceso es:</p>
      <ul style="font-size: 14px;">
        <li><strong>RUT:</strong> ${escaparHtml(persona.rut)}</li>
        <li><strong>PIN:</strong> <span style="font-size: 20px; letter-spacing: 3px;">${escaparHtml(pin)}</span></li>
      </ul>
      <p>
        Por seguridad, al ingresar por primera vez el sistema te pedirá cambiar
        este PIN por uno que solo tú conozcas.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">
        Este es un mensaje automático. No respondas a este correo. Si no
        esperabas este mensaje, comunícalo a la directiva.
      </p>
    </div>
  `;

  return enviarCorreo({
    destinatario: persona.email,
    asunto: `Tu acceso al Portal del Socio — ${nombreOrganizacion()}`,
    cuerpo
  });
}

module.exports = { enviarCorreo, escaparHtml, notificarAusentesEvento, enviarPinAcceso };
