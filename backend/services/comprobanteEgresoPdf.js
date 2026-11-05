// Comprobante de Egreso de un gasto: documento interno de control de la agrupación.
// Formato propio (no calca ningún talonario), hoja carta, una página, con membrete
// GDC, folio correlativo (= id del gasto), monto en números y en palabras y líneas
// de firma (elaborado / autorizado / recibí conforme). Se genera en memoria cada vez
// que se visualiza o descarga desde Tablas → Gastos; el "original" es el registro del
// gasto en la BD, así que el comprobante N° X siempre sale idéntico.
const fs = require('fs');
const PDFDocument = require('pdfkit');
const config = require('../config/cartaPermiso');
const { formatearFolio } = require('./cartaPermisoPdf');

const CM = 72 / 2.54;
const MARGEN = 2.2 * CM;
const ANCHO = 612;
const ALTO = 792;
const CAFE = '#2b1608';
const TINTA = '#1d1d1d';
const GRIS = '#6b6b6b';

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho',
  'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
  'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos',
  'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function grupoEnPalabras(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  let txt = c ? CENTENAS[c] + (resto ? ' ' : '') : '';
  if (resto < 30) {
    txt += UNIDADES[resto];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    txt += DECENAS[d] + (u ? ' y ' + UNIDADES[u] : '');
  }
  return txt.trim();
}

// Apócope de "uno" ante sustantivo masculino: "uno"→"un", "veintiuno"→"veintiún".
function apocopar(txt) {
  if (/veintiuno$/.test(txt)) return txt.replace(/veintiuno$/, 'veintiún');
  return txt.replace(/uno$/, 'un');
}

// Monto entero (CLP) a palabras: "ciento veinte mil pesos", "un millón de pesos".
function montoEnPalabras(valor) {
  const n = Math.floor(Math.abs(Number(valor) || 0));
  if (n === 0) return 'cero pesos';
  const millones = Math.floor(n / 1000000);
  const miles = Math.floor((n % 1000000) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) partes.push(millones === 1 ? 'un millón' : apocopar(grupoEnPalabras(millones)) + ' millones');
  if (miles) partes.push(miles === 1 ? 'mil' : apocopar(grupoEnPalabras(miles)) + ' mil');
  if (resto) partes.push(grupoEnPalabras(resto));
  const texto = apocopar(partes.join(' ').trim());
  const necesitaDe = /mill(ón|ones)$/.test(texto); // "un millón de pesos", "dos millones de pesos"
  const sufijo = n === 1 ? 'peso' : 'pesos';
  return `${texto}${necesitaDe ? ' de' : ''} ${sufijo}`;
}

function fechaLarga(valor) {
  const iso = valor instanceof Date
    ? `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`
    : String(valor || '').substring(0, 10);
  const [anio, mes, dia] = iso.split('-').map(Number);
  if (!anio) return '';
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${anio}`;
}

function montoFormateado(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CL')}`;
}

function registrarFuentes(doc) {
  const fuentes = {};
  try {
    if (fs.existsSync(config.fuentes.membrete)) { doc.registerFont('titulo', config.fuentes.membrete); fuentes.titulo = 'titulo'; }
    if (fs.existsSync(config.fuentes.membreteNormal)) { doc.registerFont('membrete', config.fuentes.membreteNormal); fuentes.membrete = 'membrete'; }
  } catch (e) { /* fallback a Helvetica */ }
  return {
    titulo: fuentes.titulo || 'Helvetica-Bold',
    membrete: fuentes.membrete || 'Helvetica'
  };
}

// gasto: fila de gastoModel.obtenerGastoPorId (id, descripcion, categoria, monto,
// fecha, responsable, comprobante_path).
function generarPdfComprobanteEgreso(gasto) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    info: {
      Title: `Comprobante de Egreso N° ${formatearFolio(gasto.id)}`,
      Author: 'Gran Diablada Calameña'
    }
  });

  const fragmentos = [];
  doc.on('data', f => fragmentos.push(f));
  const terminado = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(fragmentos))));

  const F = registrarFuentes(doc);

  // --- Membrete: logo + nombre de la agrupación + título ---
  const tamanoLogo = 56;
  try {
    doc.save();
    doc.circle(MARGEN + tamanoLogo / 2, MARGEN + tamanoLogo / 2, tamanoLogo / 2).clip();
    doc.image(config.rutaLogo, MARGEN, MARGEN, { width: tamanoLogo, height: tamanoLogo });
    doc.restore();
  } catch (e) { /* sin logo */ }

  const xTexto = MARGEN + tamanoLogo + 14;
  doc.font(F.titulo).fontSize(16).fillColor(CAFE)
    .text('GRAN DIABLADA CALAMEÑA', xTexto, MARGEN + 4, { width: ANCHO - xTexto - MARGEN });
  doc.font(F.membrete).fontSize(10).fillColor(GRIS)
    .text(`${config.ciudad} · Documento interno de control`, xTexto, MARGEN + 26, { width: ANCHO - xTexto - MARGEN });

  // Línea café bajo el membrete
  const yLinea = MARGEN + tamanoLogo + 12;
  doc.moveTo(MARGEN, yLinea).lineTo(ANCHO - MARGEN, yLinea).lineWidth(1.5).strokeColor(CAFE).stroke();

  // --- Título del documento + folio y fecha ---
  let y = yLinea + 22;
  doc.font(F.titulo).fontSize(15).fillColor(TINTA)
    .text('COMPROBANTE DE EGRESO', MARGEN, y, { width: ANCHO - 2 * MARGEN, align: 'center' });

  y += 34;
  const anchoCol = (ANCHO - 2 * MARGEN) / 2;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA)
    .text(`N° ${formatearFolio(gasto.id)}`, MARGEN, y, { width: anchoCol });
  doc.font('Helvetica').fontSize(11).fillColor(TINTA)
    .text(`Fecha: ${fechaLarga(gasto.fecha)}`, MARGEN + anchoCol, y, { width: anchoCol, align: 'right' });

  // --- Campos ---
  y += 30;
  const fila = (etiqueta, valor, opciones = {}) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS).text(etiqueta.toUpperCase(), MARGEN, y);
    y += 15;
    doc.font('Helvetica').fontSize(opciones.tamano || 12).fillColor(TINTA)
      .text(valor || '—', MARGEN, y, { width: ANCHO - 2 * MARGEN });
    y += (doc.heightOfString(valor || '—', { width: ANCHO - 2 * MARGEN, fontSize: opciones.tamano || 12 }) || 14) + 12;
  };

  fila('Categoría', gasto.categoria);
  fila('Responsable / Beneficiario', gasto.responsable);
  fila('Por concepto de', gasto.descripcion);

  // --- Monto destacado ---
  y += 6;
  doc.rect(MARGEN, y, ANCHO - 2 * MARGEN, 50).lineWidth(1).strokeColor(CAFE).stroke();
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS).text('MONTO', MARGEN + 12, y + 8);
  doc.font('Helvetica-Bold').fontSize(20).fillColor(CAFE)
    .text(montoFormateado(gasto.monto), MARGEN + 12, y + 20, { width: ANCHO - 2 * MARGEN - 24 });
  y += 58;
  const palabras = montoEnPalabras(gasto.monto);
  doc.font('Helvetica-Oblique').fontSize(10.5).fillColor(TINTA)
    .text(`Son: ${palabras.charAt(0).toUpperCase() + palabras.slice(1)} ($${Math.round(Number(gasto.monto) || 0).toLocaleString('es-CL')}).`,
      MARGEN, y, { width: ANCHO - 2 * MARGEN });

  y += 24;
  doc.font('Helvetica').fontSize(9.5).fillColor(GRIS)
    .text(`Comprobante de respaldo adjunto (boleta/factura): ${gasto.comprobante_path ? 'Sí' : 'No'}`,
      MARGEN, y, { width: ANCHO - 2 * MARGEN });

  // --- Firmas ---
  const yFirmas = ALTO - MARGEN - 92;
  const anchoFirma = (ANCHO - 2 * MARGEN - 2 * 24) / 3;
  const firma = (idx, titulo, subtitulo) => {
    const x = MARGEN + idx * (anchoFirma + 24);
    doc.moveTo(x, yFirmas).lineTo(x + anchoFirma, yFirmas).lineWidth(0.8).strokeColor(TINTA).stroke();
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA)
      .text(titulo, x, yFirmas + 6, { width: anchoFirma, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(GRIS)
      .text(subtitulo, x, yFirmas + 18, { width: anchoFirma, align: 'center' });
  };
  firma(0, 'Elaborado por', 'Tesorería');
  firma(1, 'Autorizado por', config.firmante ? config.firmante.cargo : 'Presidencia');
  firma(2, 'Recibí conforme', gasto.responsable || 'Beneficiario');

  // --- Pie ---
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
    .text(`Comprobante de egreso N° ${formatearFolio(gasto.id)} · Gran Diablada Calameña · Generado desde el sistema de gestión GDC`,
      MARGEN, ALTO - MARGEN - 8, { width: ANCHO - 2 * MARGEN, align: 'center' });

  doc.end();
  return terminado;
}

function nombreArchivoEgreso(gasto) {
  return `Comprobante_egreso_${formatearFolio(gasto.id)}.pdf`;
}

module.exports = { generarPdfComprobanteEgreso, nombreArchivoEgreso, montoEnPalabras };
