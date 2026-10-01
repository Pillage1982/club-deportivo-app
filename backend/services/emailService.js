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

// Sin EMAIL_HOST se mantiene Gmail (comportamiento original). Con EMAIL_HOST se
// usa ese SMTP, p. ej. los buzones @gdcayquina.cl de Hostinger:
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

function enviarCorreo({ destinatario, asunto, cuerpo, cc, replyTo, adjuntos }) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Correo no enviado a:', destinatario);
    return Promise.resolve();
  }

  return crearTransporter().sendMail({
    from: `"Gran Diablada Calameña" <${process.env.EMAIL_USER}>`,
    to: destinatario,
    cc: cc || undefined,
    replyTo: replyTo || undefined,
    subject: asunto,
    html: cuerpo,
    attachments: adjuntos || undefined
  });
}

// Texto ingresado por el socio (motivo, nombres...) va dentro de HTML del correo.
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

// Enlace de "¿Olvidaste tu contraseña?" (directiva o socio).
// Devuelve false si el correo no está configurado, para que el controlador lo
// registre en el log (al usuario siempre se le responde un mensaje genérico).
function enviarEnlaceRecuperacion({ destinatario, nombre, enlace, esSocio, minutosVigencia }) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Enlace de recuperación no enviado a:', destinatario);
    return Promise.resolve(false);
  }

  const queCambia = esSocio ? 'tu contraseña del Portal del Socio' : 'tu contraseña del panel de la directiva';
  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Gran Diablada Calameña</h2>
      <p>Hola <strong>${nombre}</strong>,</p>
      <p>Recibimos una solicitud para restablecer ${queCambia}.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${enlace}" style="background: #f47a22; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Crear una contraseña nueva
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
    asunto: 'Restablecer tu contraseña — Gran Diablada Calameña',
    cuerpo
  }).then(() => true);
}

// =====================================
// CARTAS DEL PORTAL DEL SOCIO (pestaña Documentos)
// =====================================
// Mismo formato que las cartas en papel de la agrupación (Carta_Justificacion.doc
// y Carta_Postulacion_Bloques.doc): membrete, folio, "Calama, <fecha>",
// destinatarios, referencia con casillas marcadas, cuerpo y datos del firmante.
// La firma manuscrita se reemplaza por la constancia de envío autenticado.

const path = require('path');

const RUTA_LOGO = path.join(__dirname, '..', '..', 'frontend', 'img', 'logo-calamena.jpeg');

const DESTINO_JUSTIFICACIONES = () => process.env.EMAIL_JUSTIFICACIONES || 'justificaciones@gdcayquina.cl';
const DESTINO_CAPORALES = () => process.env.EMAIL_CAPORALES || 'caporales@gdcayquina.cl';

function formatearFolio(id) {
  return String(id).padStart(5, '0');
}

function fechaCarta(fecha) {
  const d = fecha ? new Date(String(fecha).replace(' ', 'T')) : new Date();
  const valida = Number.isNaN(d.getTime()) ? new Date() : d;
  return valida.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function casilla(marcada) {
  return marcada ? '(<strong>&nbsp;X&nbsp;</strong>)' : '(&nbsp;&nbsp;&nbsp;)';
}

function membreteCarta(folio, fecha) {
  return `
    <table role="presentation" width="100%" style="border-collapse: collapse;">
      <tr>
        <td style="width: 90px; vertical-align: middle;">
          <img src="cid:logo-gdc" alt="GDC" width="80" style="display: block; border-radius: 50%;">
        </td>
        <td style="text-align: center; vertical-align: middle; font-size: 18px; color: #222;">
          BAILE RELIGIOSO<br>“GRAN DIABLADA CALAMEÑA”
        </td>
      </tr>
    </table>
    <p style="text-align: right; margin: 24px 0 4px;"><strong>Folio Nº ${formatearFolio(folio)}</strong></p>
    <p style="text-align: right; margin: 0 0 24px;"><strong>Calama,</strong> ${fechaCarta(fecha)}</p>
  `;
}

function constanciaEnvio(fecha) {
  return `Enviada electrónicamente desde el Portal del Socio con la sesión del titular (${escaparHtml(fecha)}).`;
}

function adjuntoLogo() {
  return { filename: 'logo-gdc.jpeg', path: RUTA_LOGO, cid: 'logo-gdc' };
}

const ETIQUETA_TIPO_JUSTIFICACION = {
  justificado: 'Justificación',
  licencia_medica: 'Licencia médica'
};

// datos: { folio, creadoEn, persona, referencia, referenciaOtro, evento, fechaActividad,
//          tipoSolicitado, condicion, motivo, quienEntrega, adjunto: {path, filename} | null }
// Devuelve false si el correo no está configurado (la carta igual queda guardada).
function enviarCartaJustificacion(datos) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Carta de justificación no enviada, folio:', datos.folio);
    return Promise.resolve(false);
  }

  const p = datos.persona;
  const nombre = [p.nombres, p.apellido_paterno, p.apellido_materno || ''].join(' ').trim();
  const ref = datos.referencia;
  const horaEvento = datos.evento ? String(datos.evento.fecha).substring(11, 16) : '';
  const actividad = datos.evento
    ? `${escaparHtml(datos.evento.nombre)} — ${escaparHtml(formatearFechaTexto(datos.evento.fecha))}${horaEvento && horaEvento !== '00:00' ? `, ${horaEvento} hrs` : ''}`
    : `${escaparHtml(datos.referenciaOtro || 'Otra actividad')} — ${escaparHtml(formatearFechaTexto(datos.fechaActividad))}`;
  const motivoHtml = escaparHtml(datos.motivo).replace(/\r?\n/g, '<br>');

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #222; font-size: 14px; line-height: 1.5;">
      ${membreteCarta(datos.folio, datos.creadoEn)}
      <p style="margin: 0 0 20px;"><strong>Señores<br>Directivos, Caporales.<br><u>Presente</u>.</strong></p>
      <p style="margin: 0; padding-bottom: 6px; border-bottom: 3px solid #222;">
        <strong>Referencia justifica inasistencia a:</strong>
        Ensayo ${casilla(ref === 'ensayo')}
        Reunión ${casilla(ref === 'reunion')}
        Salida ${casilla(ref === 'salida')}
        Otro ${casilla(ref === 'otro')}
      </p>
      <p style="margin: 8px 0 18px; font-size: 13px; color: #555;">
        Actividad: <strong>${actividad}</strong><br>
        Tipo: <strong>${ETIQUETA_TIPO_JUSTIFICACION[datos.tipoSolicitado] || 'Justificación'}</strong>
        ${datos.adjunto ? ' · Se adjunta documento de respaldo' : ''}
      </p>
      <p style="margin: 0 0 8px;">Respetados Srs:</p>
      <p style="margin: 0 0 20px; padding: 10px 12px; border-bottom: 1px solid #222;">${motivoHtml}</p>
      <p style="margin: 0 0 28px;">Sin otro particular se despide atentamente,</p>
      <p style="margin: 0 0 8px;"><strong>Nombre:</strong> ${escaparHtml(nombre)}</p>
      <p style="margin: 0 0 8px;"><strong>Condición:</strong>
        Bailarín ${casilla(datos.condicion === 'bailarin')}
        Socio ${casilla(datos.condicion === 'socio')}
      </p>
      <p style="margin: 0 0 8px;"><strong>Rut:</strong> ${escaparHtml(p.rut)}</p>
      <p style="margin: 0 0 20px;"><strong>Firma:</strong> <em style="color: #555;">${constanciaEnvio(formatearFechaHoraTexto(datos.creadoEn))}</em></p>
      ${datos.quienEntrega ? `
      <p style="margin: 0 0 20px; font-size: 13px;">
        Nombre de quien entrega (no es el titular): <strong>${escaparHtml(datos.quienEntrega)}</strong>
      </p>` : ''}
      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; margin: 0;">
        Recepción Junta de disciplina / Secretaría: revisar y aprobar o rechazar en el panel
        de la directiva → Tablas → Justificaciones (folio ${formatearFolio(datos.folio)}).
        Responder este correo le escribe directamente al integrante${p.email ? '' : ' (no tiene email registrado)'}.
      </p>
    </div>
  `;

  const adjuntos = [adjuntoLogo()];
  if (datos.adjunto) adjuntos.push(datos.adjunto);

  return enviarCorreo({
    destinatario: DESTINO_JUSTIFICACIONES(),
    cc: p.email || null,
    replyTo: p.email || null,
    asunto: `Justificación de inasistencia — Folio ${formatearFolio(datos.folio)} — ${nombre}`,
    cuerpo,
    adjuntos
  }).then(() => true);
}

// datos: { folio, creadoEn, persona, bloqueActual, esNuevo, opcion1, opcion2, celular, email }
function enviarPostulacionBloque(datos) {
  if (!emailConfigurado()) {
    console.warn('[Email] No configurado. Postulación a bloque no enviada, folio:', datos.folio);
    return Promise.resolve(false);
  }

  const p = datos.persona;
  const nombre = [p.nombres, p.apellido_paterno, p.apellido_materno || ''].join(' ').trim();
  const bloqueActual = datos.esNuevo
    ? 'Integrante nuevo'
    : escaparHtml(datos.bloqueActual || '—');

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #222; font-size: 14px; line-height: 1.5;">
      ${membreteCarta(datos.folio, datos.creadoEn)}
      <p style="margin: 0 0 20px;"><strong>Señores<br>Caporales.<br><u>Presente</u>.</strong></p>
      <p style="margin: 0 0 16px; padding-bottom: 6px; border-bottom: 3px solid #222;">
        <strong>Referencia Postulación a Bloques Cupos Limitado.</strong>
      </p>
      <p style="margin: 0 0 4px;">Respetados Srs:</p>
      <p style="margin: 0 0 24px; text-indent: 40px;">
        Me dirijo a Ustedes, para comunicar mi postulación como bailarín/a del
        Baile Religioso “Gran Diablada Calameña”.
      </p>
      <p style="margin: 0 0 16px;">Bloque y/o Fila al que pertenezco: <strong>${bloqueActual}</strong></p>
      <p style="margin: 0 0 8px;">Primera opción de postulación: <strong>${escaparHtml(datos.opcion1)}</strong></p>
      <p style="margin: 0 0 28px;">Segunda opción de postulación: <strong>${escaparHtml(datos.opcion2 || '—')}</strong></p>
      <p style="margin: 0 0 8px;"><strong>Nombre:</strong> ${escaparHtml(nombre)}</p>
      <p style="margin: 0 0 8px;"><strong>Rut:</strong> ${escaparHtml(p.rut)}</p>
      <p style="margin: 0 0 8px;"><strong>N° Celular:</strong> ${escaparHtml(datos.celular || '—')}</p>
      <p style="margin: 0 0 20px;"><strong>E-mail:</strong> ${escaparHtml(datos.email || '—')}</p>
      <p style="margin: 0 0 20px; font-size: 13px; color: #555;"><em>${constanciaEnvio(formatearFechaHoraTexto(datos.creadoEn))}</em></p>
      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
      <p style="color: #888; font-size: 12px; margin: 0;">
        Recepción secretaría: queda registrada en el panel de la directiva → Tablas → Justificaciones
        (sección Postulaciones a bloques), folio ${formatearFolio(datos.folio)}.
      </p>
    </div>
  `;

  return enviarCorreo({
    destinatario: DESTINO_CAPORALES(),
    cc: datos.email || null,
    replyTo: datos.email || null,
    asunto: `Postulación a bloques — Folio ${formatearFolio(datos.folio)} — ${nombre}`,
    cuerpo,
    adjuntos: [adjuntoLogo()]
  }).then(() => true);
}

// Aviso al socio cuando la directiva aprueba o rechaza su carta.
function notificarResolucionJustificacion({ persona, folio, aprobada, estadoAplicado, observacion, actividad }) {
  if (!emailConfigurado() || !persona.email) return Promise.resolve(false);

  const nombre = [persona.nombres, persona.apellido_paterno].join(' ').trim();
  const resultado = aprobada
    ? `<strong style="color: #2e7d32;">APROBADA</strong> (registrada como ${escaparHtml(ETIQUETA_TIPO_JUSTIFICACION[estadoAplicado] || 'justificación')})`
    : '<strong style="color: #c0392b;">RECHAZADA</strong>';

  const cuerpo = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Gran Diablada Calameña</h2>
      <p>Hola <strong>${escaparHtml(nombre)}</strong>,</p>
      <p>Tu carta de justificación folio <strong>${formatearFolio(folio)}</strong>
        (${escaparHtml(actividad)}) fue ${resultado}.</p>
      ${observacion ? `<p>Observación de la directiva: <em>${escaparHtml(observacion)}</em></p>` : ''}
      <p>Puedes revisarla en el Portal del Socio → Documentos.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="color: #888; font-size: 12px;">Este es un mensaje automático. No respondas a este correo.</p>
    </div>
  `;

  return enviarCorreo({
    destinatario: persona.email,
    asunto: `Justificación folio ${formatearFolio(folio)}: ${aprobada ? 'aprobada' : 'rechazada'}`,
    cuerpo
  }).then(() => true);
}

function formatearFechaHoraTexto(fecha) {
  const d = fecha ? new Date(String(fecha).replace(' ', 'T')) : new Date();
  if (Number.isNaN(d.getTime())) return String(fecha || '');
  return d.toLocaleString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

module.exports = {
  notificarAusentesEvento,
  enviarEnlaceRecuperacion,
  enviarCartaJustificacion,
  enviarPostulacionBloque,
  notificarResolucionJustificacion,
  formatearFolio
};
