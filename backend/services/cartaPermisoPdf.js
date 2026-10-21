// PDF de la carta de permiso para el colegio: hoja tamaño carta (612 × 792 pt), una
// página, márgenes de 3 cm a los lados y 2,5 cm arriba y abajo, con el estilo del
// mockup aprobado (membrete con logo y línea café, texto serif, timbre, firma y QR
// de verificación). El TEXTO es el de la carta oficial de 2023: solo cambian los
// datos de cada carta. Se genera en memoria cada vez que se descarga o se envía.
const fs = require('fs');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const config = require('../config/cartaPermiso');
const CLIENTE = require('../config/cliente');

const CM = 72 / 2.54;
const MARGEN_X = 3 * CM;
const MARGEN_Y = 2.5 * CM;
const ANCHO_PAGINA = 612;
const ALTO_PAGINA = 792;
const ANCHO_TEXTO = ANCHO_PAGINA - 2 * MARGEN_X;

const TAMANO = 11;
const INTERLINEA = 4.5;
const SEPARACION = 12;
const CAFE = '#2b1608';
const TINTA = '#1d1d1d';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function partesFecha(iso) {
  const [anio, mes, dia] = String(iso).substring(0, 10).split('-').map(Number);
  return { anio, mes, dia };
}

// "agosto del 2027"
function mesDelAnio(iso) {
  const { anio, mes } = partesFecha(iso);
  return `${MESES[mes - 1]} del ${anio}`;
}

// "02 al 10 de septiembre del 2027" / "28 de agosto al 05 de septiembre del 2027"
function rangoFechas(desde, hasta) {
  const a = partesFecha(desde);
  const b = partesFecha(hasta);
  const dd = n => String(n).padStart(2, '0');
  if (a.anio !== b.anio) {
    return `${dd(a.dia)} de ${MESES[a.mes - 1]} del ${a.anio} al ${dd(b.dia)} de ${MESES[b.mes - 1]} del ${b.anio}`;
  }
  if (a.mes !== b.mes) {
    return `${dd(a.dia)} de ${MESES[a.mes - 1]} al ${dd(b.dia)} de ${MESES[b.mes - 1]} del ${b.anio}`;
  }
  return `${dd(a.dia)} al ${dd(b.dia)} de ${MESES[b.mes - 1]} del ${b.anio}`;
}

// 12345678-9 → 12.345.678-9
function rutConPuntos(rut) {
  const limpio = String(rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
  if (limpio.length < 2) return String(rut || '');
  const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpo}-${limpio.slice(-1)}`;
}

// Años cumplidos desde la fundación a la fecha de la carta.
function aniosDesdeFundacion(fechaCarta) {
  const f = partesFecha(config.fechaFundacion);
  const c = partesFecha(fechaCarta);
  let anios = c.anio - f.anio;
  if (c.mes < f.mes || (c.mes === f.mes && c.dia < f.dia)) anios--;
  return anios;
}

function formatearFolio(id) {
  return String(id).padStart(5, '0');
}

function nombreAlumno(carta) {
  return [carta.nombres, carta.apellido_paterno, carta.apellido_materno].filter(Boolean).join(' ');
}

function membrete(doc) {
  const tamanoLogo = 52;
  const y = MARGEN_Y;

  doc.save();
  doc.circle(MARGEN_X + tamanoLogo / 2, y + tamanoLogo / 2, tamanoLogo / 2).clip();
  doc.image(config.rutaLogo, MARGEN_X, y, { width: tamanoLogo, height: tamanoLogo });
  doc.restore();

  const xTexto = MARGEN_X + tamanoLogo + 14;
  doc.font('membrete').fontSize(12.5).fillColor(CAFE)
    .text('BAILE RELIGIOSO', xTexto, y + 6, { characterSpacing: 0.5, lineGap: 1 })
    .text(CLIENTE.nombre.toUpperCase(), { characterSpacing: 0.5 });
  doc.font('membreteNormal').fontSize(8.8).fillColor('#666666')
    .text(config.sitioWeb, { underline: true });

  const yLinea = y + tamanoLogo + 9;
  doc.moveTo(MARGEN_X, yLinea).lineTo(ANCHO_PAGINA - MARGEN_X, yLinea)
    .lineWidth(2).strokeColor(CAFE).stroke();

  return yLinea + SEPARACION + 2;
}

function parrafo(doc, partes, opciones = {}) {
  doc.fillColor(TINTA).fontSize(TAMANO);
  partes.forEach(([texto, negrita], i) => {
    doc.font(negrita ? 'textoNegrita' : 'texto').text(texto, {
      width: ANCHO_TEXTO,
      align: opciones.align || 'justify',
      lineGap: INTERLINEA,
      continued: i < partes.length - 1
    });
  });
  doc.moveDown(SEPARACION / (TAMANO + INTERLINEA));
}

function firma(doc, yInicio) {
  const anchoTimbre = 84;
  const anchoFirma = 150;
  const anchoBloqueFirma = 200;
  const separacion = 18;
  const anchoTotal = anchoTimbre + separacion + anchoBloqueFirma;
  const x0 = MARGEN_X + (ANCHO_TEXTO - anchoTotal) / 2;

  // Timbre levemente girado, como el mockup.
  const altoTimbre = anchoTimbre * 152 / 140;
  doc.save();
  doc.opacity(0.92);
  doc.rotate(-6, { origin: [x0 + anchoTimbre / 2, yInicio + altoTimbre / 2] });
  doc.image(config.rutaTimbre, x0, yInicio, { width: anchoTimbre });
  doc.restore();

  // Firma sobre el nombre (se monta un poco sobre la línea del nombre).
  const xFirma = x0 + anchoTimbre + separacion;
  const altoFirma = anchoFirma * 199 / 407;
  doc.image(config.rutaFirma(), xFirma + (anchoBloqueFirma - anchoFirma) / 2, yInicio, { width: anchoFirma });

  const yNombre = yInicio + altoFirma - 8;
  doc.font('textoNegrita').fontSize(TAMANO).fillColor(TINTA)
    .text(config.firmante.nombre, xFirma, yNombre, { width: anchoBloqueFirma, align: 'center', lineGap: 2 })
    .text(config.firmante.cargo, { width: anchoBloqueFirma, align: 'center' });

  return Math.max(yInicio + altoTimbre, doc.y);
}

async function verificacion(doc, carta, urlVerificacion) {
  const tamanoQr = 66;
  const yLinea = ALTO_PAGINA - MARGEN_Y - tamanoQr - 10;

  doc.save();
  doc.moveTo(MARGEN_X, yLinea).lineTo(ANCHO_PAGINA - MARGEN_X, yLinea)
    .lineWidth(0.8).dash(3, { space: 3 }).strokeColor('#bbbbbb').stroke();
  doc.restore();

  const qr = await QRCode.toBuffer(`${urlVerificacion}?c=${carta.codigo_verificacion}`, {
    margin: 0, errorCorrectionLevel: 'M', width: 300
  });
  const yQr = yLinea + 10;
  doc.image(qr, MARGEN_X, yQr, { width: tamanoQr });

  const host = urlVerificacion.replace(/^https?:\/\//, '');
  const xTexto = MARGEN_X + tamanoQr + 12;
  doc.font('membreteNormal').fontSize(8.6).fillColor('#555555')
    .text('Verifique esta carta escaneando el código o en ', xTexto, yQr + 18, {
      width: ANCHO_PAGINA - MARGEN_X - xTexto, continued: true
    })
    .font('membrete').text(host, { continued: true })
    .font('membreteNormal').text(' con el código ', { continued: true })
    .font('membrete').text(carta.codigo_verificacion, { continued: true })
    .font('membreteNormal').text(` (folio ${formatearFolio(carta.id)}).`);
}

// carta: fila de cartaPermisoModel.obtener (aprobada: con código, años, integrantes
// y fecha de emisión). urlVerificacion: https://<app>/verificar.html
async function generarPdfCarta(carta, urlVerificacion) {
  if (!fs.existsSync(config.rutaFirma())) {
    const error = new Error('Falta la firma del presidente en el servidor (UPLOADS_DIR/firmas/firma_presidente.png)');
    error.codigo = 'SIN_FIRMA';
    throw error;
  }

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: MARGEN_Y, bottom: MARGEN_Y, left: MARGEN_X, right: MARGEN_X },
    info: {
      Title: `Carta de permiso — Folio ${formatearFolio(carta.id)}`,
      Author: CLIENTE.nombre
    }
  });

  doc.registerFont('texto', config.fuentes.texto);
  doc.registerFont('textoNegrita', config.fuentes.textoNegrita);
  doc.registerFont('membrete', config.fuentes.membrete);
  doc.registerFont('membreteNormal', config.fuentes.membreteNormal);

  const fragmentos = [];
  doc.on('data', f => fragmentos.push(f));
  const terminado = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(fragmentos))));

  let y = membrete(doc);

  doc.font('textoNegrita').fontSize(TAMANO).fillColor(TINTA)
    .text(`Folio N° ${formatearFolio(carta.id)}`, MARGEN_X, y, { width: ANCHO_TEXTO, align: 'right', lineGap: INTERLINEA });
  doc.font('texto')
    .text(`${config.ciudad}, ${mesDelAnio(carta.emitida_en)}`, { width: ANCHO_TEXTO, align: 'right', lineGap: INTERLINEA });
  doc.moveDown(SEPARACION / (TAMANO + INTERLINEA));

  doc.font('textoNegrita')
    .text('Señor(a):', { lineGap: INTERLINEA })
    .text(carta.director, { lineGap: INTERLINEA })
    .text(carta.colegio, { lineGap: INTERLINEA })
    .text('Presente.', { lineGap: INTERLINEA });
  doc.moveDown(SEPARACION / (TAMANO + INTERLINEA));

  doc.font('textoNegrita').text('Referencia: Solicita autorización a persona que Indica.', { lineGap: 2 });
  const yRef = doc.y + 2;
  doc.moveTo(MARGEN_X, yRef).lineTo(ANCHO_PAGINA - MARGEN_X, yRef).lineWidth(1.5).strokeColor(TINTA).stroke();
  doc.y = yRef + SEPARACION;

  parrafo(doc, [['De nuestra consideración:']], { align: 'left' });

  parrafo(doc, [[
    `El baile religioso ${CLIENTE.nombre}, es devoto de la Virgen Guadalupe de Ayquina desde hace más de ` +
    `${carta.anios} años y está integrado actualmente por ${carta.integrantes} personas; quienes participan todos ` +
    'los años en la celebración que se hace en este poblado en el mes de septiembre.'
  ]]);

  parrafo(doc, [
    [`Es por esta razón, que solicitamos respetuosamente, autorizar un permiso entre los días ${rangoFechas(carta.fecha_desde, carta.fecha_hasta)}, a `],
    [nombreAlumno(carta), true],
    [', Rut: '],
    [rutConPuntos(carta.rut), true],
    [' del '],
    [carta.curso, true],
    [', integrante activo de nuestra Institución para que exprese su fe en la Fiesta de nuestra Señora Virgen de Guadalupe en el Santuario de Ayquina.']
  ]);

  parrafo(doc, [['Esperando una buena acogida a la presente, nos despedimos cordialmente,']], { align: 'left' });

  firma(doc, doc.y);
  await verificacion(doc, carta, urlVerificacion);

  doc.end();
  return terminado;
}

module.exports = { generarPdfCarta, aniosDesdeFundacion, rangoFechas, rutConPuntos, mesDelAnio, formatearFolio };
