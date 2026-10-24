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

function formatearFolio(id) {
  return String(id).padStart(5, '0');
}

// Destino del aviso de comprobantes de depósito: EMAIL_TESORERIA si está
// configurado; si no, el buzón con que se envían los correos.
function destinoTesoreria() {
  return process.env.EMAIL_TESORERIA || process.env.EMAIL_USER;
}

// Aviso a tesorería de un comprobante de depósito enviado desde el Portal del
// Socio, con el archivo adjunto. Responder el correo le escribe al socio.
// Devuelve false si el correo no está configurado.
function enviarComprobanteDeposito(datos) {
  if (!emailConfigurado() || !destinoTesoreria()) {
    console.warn('[Email] No configurado. Comprobante de depósito no enviado, folio:', datos.folio);
    return Promise.resolve(false);
  }

  const p = datos.persona;
  const nombre = [p.nombres, p.apellido_paterno, p.apellido_materno || ''].join(' ').trim();
  const monto = `$${Number(datos.monto).toLocaleString('es-CL')}`;

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #222; font-size: 14px; line-height: 1.5;">
      <h2 style="color: #333;">${escaparHtml(nombreOrganizacion())}</h2>
      <p><strong>Comprobante de depósito — Folio Nº ${formatearFolio(datos.folio)}</strong></p>
      <table role="presentation" style="border-collapse: collapse; margin: 0 0 20px;">
        <tr><td style="padding: 4px 16px 4px 0;"><strong>Integrante:</strong></td><td>${escaparHtml(nombre)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;"><strong>RUT:</strong></td><td>${escaparHtml(p.rut)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;"><strong>Monto:</strong></td><td>${escaparHtml(monto)}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;"><strong>Fecha del depósito:</strong></td><td>${escaparHtml(formatearFechaTexto(`${datos.fechaDeposito}T12:00:00`))}</td></tr>
        <tr><td style="padding: 4px 16px 4px 0;"><strong>Concepto:</strong></td><td>${escaparHtml(datos.concepto || '—')}</td></tr>
      </table>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; margin: 0;">
        Tesorería: verificar el abono en la cartola y registrar el pago en el panel
        → Tablas → Depósitos → "Registrar pago" (el comprobante no registra el pago por sí solo).
        Responder este correo le escribe directamente al integrante${p.email ? '' : ' (no tiene email registrado)'}.
      </p>
    </div>
  `;

  return enviarCorreo({
    destinatario: destinoTesoreria(),
    cc: p.email || null,
    replyTo: p.email || null,
    asunto: `Comprobante de depósito ${monto} — Folio ${formatearFolio(datos.folio)} — ${nombre}`,
    cuerpo,
    adjuntos: [datos.adjunto]
  }).then(() => true);
}

module.exports = { enviarCorreo, escaparHtml, formatearFolio, notificarAusentesEvento, enviarComprobanteDeposito };
