// Comprobante de Egreso de un gasto: documento interno de control de la agrupación.
// Calca el formato GDC aprobado (membrete naranjo, PÁGUESE A, DETALLE DEL EGRESO,
// FORMA DE PAGO Y RESPALDO, FIRMAS). Hoja carta, una página. Se genera en memoria
// cada vez que se visualiza o descarga desde Tablas → Gastos; el "original" es el
// registro del gasto en la BD, así que el comprobante N° X sale idéntico siempre.
const fs = require('fs');
const PDFDocument = require('pdfkit');
const config = require('../config/cartaPermiso');
const { formatearFolio } = require('./cartaPermisoPdf');

// Identidad del documento. El RUT del club se completa cuando la directiva lo
// entregue (en el formato en papel también va en blanco).
const ENTIDAD = Object.freeze({
  nombre: 'Gran Diablada Calameña',
  ubicacion: 'Calama, Región de Antofagasta · gdcayquina.cl',
  rut: ''
});

const M = 36;                 // margen
const ANCHO = 612;
const ALTO = 792;
const W = ANCHO - 2 * M;      // ancho útil
const DER = ANCHO - M;

const NARANJA = '#E07B2B';
const PEACH   = '#FBE3D3';
const AZUL    = '#EAF2FC';
const BORDE   = '#C9C9C9';
const TINTA   = '#2b2b2b';
const GRIS    = '#6b6b6b';
const BLANCO  = '#ffffff';

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

function apocopar(txt) {
  if (/veintiuno$/.test(txt)) return txt.replace(/veintiuno$/, 'veintiún');
  return txt.replace(/uno$/, 'un');
}

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
  const necesitaDe = /mill(ón|ones)$/.test(texto);
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

function clp(valor) {
  return `$${Math.round(Number(valor) || 0).toLocaleString('es-CL')}`;
}

function registrarFuentes(doc) {
  const f = {};
  try {
    if (fs.existsSync(config.fuentes.membrete)) { doc.registerFont('titulo', config.fuentes.membrete); f.titulo = 'titulo'; }
    if (fs.existsSync(config.fuentes.membreteNormal)) { doc.registerFont('membrete', config.fuentes.membreteNormal); f.membrete = 'membrete'; }
  } catch (e) { /* fallback a Helvetica */ }
  return { titulo: f.titulo || 'Helvetica-Bold', membrete: f.membrete || 'Helvetica' };
}

// ---- helpers de dibujo ----
function celda(doc, x, y, w, h, bg) {
  if (bg) doc.rect(x, y, w, h).fill(bg);
  doc.rect(x, y, w, h).lineWidth(0.6).strokeColor(BORDE).stroke();
}

function texto(doc, txt, x, y, w, h, o = {}) {
  const size = o.size || 9;
  const pad = o.pad == null ? 5 : o.pad;
  doc.font(o.font || 'Helvetica').fontSize(size).fillColor(o.color || TINTA)
    .text(String(txt == null ? '' : txt), x + pad, y + (h - size) / 2 + 1,
      { width: w - 2 * pad, align: o.align || 'left', lineBreak: false, ellipsis: true });
}

function banda(doc, y, titulo) {
  doc.rect(M, y, W, 18).fill(NARANJA);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(BLANCO)
    .text(titulo, M + 8, y + 5, { width: W - 16, lineBreak: false });
  return y + 18;
}

function filaLV(doc, y, etiqueta, valor, h = 19, wLabel = 160) {
  celda(doc, M, y, wLabel, h, PEACH);
  texto(doc, etiqueta, M, y, wLabel, h, { font: 'Helvetica-Bold', size: 9 });
  celda(doc, M + wLabel, y, W - wLabel, h, AZUL);
  texto(doc, valor, M + wLabel, y, W - wLabel, h, { size: 9.5 });
  return y + h;
}

function casilla(doc, x, y, marcada, etiqueta, wTxt) {
  doc.rect(x, y, 10, 10).lineWidth(0.9).strokeColor(marcada ? NARANJA : BORDE).stroke();
  if (marcada) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(NARANJA).text('X', x + 1.6, y + 0.6, { lineBreak: false });
  }
  doc.font('Helvetica').fontSize(9).fillColor(TINTA)
    .text(etiqueta, x + 15, y + 0.8, { width: wTxt, lineBreak: false, ellipsis: true });
}

function generarPdfComprobanteEgreso(g) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    info: { Title: `Comprobante de Egreso N° ${formatearFolio(g.id)}`, Author: ENTIDAD.nombre }
  });
  const fragmentos = [];
  doc.on('data', f => fragmentos.push(f));
  const terminado = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(fragmentos))));

  const F = registrarFuentes(doc);

  // ---- Encabezado ----
  const dLogo = 58;
  try {
    doc.save();
    doc.circle(M + dLogo / 2, 38 + dLogo / 2, dLogo / 2).clip();
    doc.image(config.rutaLogo, M, 38, { width: dLogo, height: dLogo });
    doc.restore();
  } catch (e) { /* sin logo */ }

  const xT = M + dLogo + 14;
  doc.font(F.titulo).fontSize(19).fillColor(NARANJA).text('COMPROBANTE DE EGRESO', xT, 40, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(TINTA).text(ENTIDAD.nombre, xT, 66, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(ENTIDAD.ubicacion, xT, 80, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(`RUT: ${ENTIDAD.rut || ''}`, xT, 92, { lineBreak: false });

  // Caja N° / Fecha (arriba a la derecha)
  const xCaja = 430, wEtq = 50, wVal = DER - xCaja - wEtq;
  celda(doc, xCaja, 40, wEtq, 20, PEACH); texto(doc, 'N°', xCaja, 40, wEtq, 20, { font: 'Helvetica-Bold', size: 9 });
  celda(doc, xCaja + wEtq, 40, wVal, 20, AZUL); texto(doc, formatearFolio(g.id), xCaja + wEtq, 40, wVal, 20, { font: 'Helvetica-Bold', size: 10 });
  celda(doc, xCaja, 60, wEtq, 20, PEACH); texto(doc, 'Fecha', xCaja, 60, wEtq, 20, { font: 'Helvetica-Bold', size: 9 });
  celda(doc, xCaja + wEtq, 60, wVal, 20, AZUL); texto(doc, fechaLarga(g.fecha), xCaja + wEtq, 60, wVal, 20, { size: 9.5 });

  // Línea naranja separadora
  doc.moveTo(M, 116).lineTo(DER, 116).lineWidth(2).strokeColor(NARANJA).stroke();

  // ---- PÁGUESE A ----
  let y = banda(doc, 124, 'PÁGUESE A');
  y = filaLV(doc, y, 'Nombre o razón social', g.responsable);
  y = filaLV(doc, y, 'RUT', g.beneficiario_rut);
  y = filaLV(doc, y, 'Teléfono / correo', g.beneficiario_contacto);
  y = filaLV(doc, y, 'Concepto del egreso', g.descripcion);
  y = filaLV(doc, y, 'Actividad o evento asociado', g.actividad_asociada);

  // ---- DETALLE DEL EGRESO ----
  y = banda(doc, y + 6, 'DETALLE DEL EGRESO');
  const cols = [
    ['N°', 30], ['Descripción', 262], ['Cant.', 48], ['Valor unitario (CLP)', 100], ['Total (CLP)', W - 30 - 262 - 48 - 100]
  ];
  let xc = M;
  const hCab = 18;
  cols.forEach(([t, w]) => { celda(doc, xc, y, w, hCab, PEACH); texto(doc, t, xc, y, w, hCab, { font: 'Helvetica-Bold', size: 8.5, align: t === 'Descripción' ? 'left' : 'center' }); xc += w; });
  y += hCab;

  const hFila = 17;
  for (let i = 0; i < 5; i++) {
    xc = M;
    const fila = i === 0
      ? [String(i + 1), g.descripcion || '', '1', clp(g.monto), clp(g.monto)]
      : [String(i + 1), '', '', '', ''];
    cols.forEach(([, w], j) => {
      celda(doc, xc, y, w, hFila, BLANCO);
      texto(doc, fila[j], xc, y, w, hFila, { size: 8.5, align: j === 1 ? 'left' : (j === 0 ? 'center' : 'right') });
      xc += w;
    });
    y += hFila;
  }

  // TOTAL A PAGAR (etiqueta sobre las primeras columnas, valor en la de Total)
  const wTotalCol = cols[4][1];
  const wEtiqTotal = W - wTotalCol;
  celda(doc, M, y, wEtiqTotal, 20, PEACH);
  texto(doc, 'TOTAL A PAGAR', M, y, wEtiqTotal, 20, { font: 'Helvetica-Bold', size: 10, align: 'right', pad: 10 });
  celda(doc, M + wEtiqTotal, y, wTotalCol, 20, AZUL);
  texto(doc, clp(g.monto), M + wEtiqTotal, y, wTotalCol, 20, { font: 'Helvetica-Bold', size: 10, align: 'right' });
  y += 20;

  // Monto en palabras
  y += 8;
  const palabras = montoEnPalabras(g.monto);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text('Monto en palabras: ', M, y, { continued: true })
    .font('Helvetica').text(`${palabras.charAt(0).toUpperCase() + palabras.slice(1)}.`);
  y += 18;

  // ---- FORMA DE PAGO Y RESPALDO ----
  y = banda(doc, y, 'FORMA DE PAGO Y RESPALDO');
  const yCab = y + 4;
  const xCol2 = M + 275;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text('Forma de pago', M, yCab, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text('Documento de respaldo', xCol2, yCab, { lineBreak: false });
  let yChk = yCab + 16;
  const fp = g.forma_pago;
  const fpDet = g.forma_pago_detalle ? ` ${g.forma_pago_detalle}` : '';
  casilla(doc, M, yChk, fp === 'efectivo', 'Efectivo', 230);
  casilla(doc, M, yChk + 18, fp === 'transferencia', `Transferencia · N° op.${fp === 'transferencia' ? fpDet : ''}`, 240);
  casilla(doc, M, yChk + 36, fp === 'cheque', `Cheque N° / Banco${fp === 'cheque' ? fpDet : ''}`, 240);
  const rt = g.respaldo_tipo;
  const rnum = g.respaldo_numero ? ` ${g.respaldo_numero}` : '';
  casilla(doc, xCol2, yChk, rt === 'boleta', `Boleta N°${rt === 'boleta' ? rnum : ''}`, 250);
  casilla(doc, xCol2, yChk + 18, rt === 'factura', `Factura N°${rt === 'factura' ? rnum : ''}`, 250);
  casilla(doc, xCol2, yChk + 36, rt === 'honorarios', `Boleta de honorarios N°${rt === 'honorarios' ? rnum : ''}`, 250);
  casilla(doc, xCol2, yChk + 54, rt === 'sin_documento', 'Sin documento (justificar en observaciones)', 250);
  y = yChk + 54 + 18;

  // Observaciones
  celda(doc, M, y, 110, 24, PEACH); texto(doc, 'Observaciones', M, y, 110, 24, { font: 'Helvetica-Bold', size: 9 });
  celda(doc, M + 110, y, W - 110, 24, AZUL); texto(doc, g.observaciones, M + 110, y, W - 110, 24, { size: 9 });
  y += 24;

  // ---- FIRMAS ----
  y = banda(doc, y + 6, 'FIRMAS');
  const wF = W / 3;
  const firmas = [
    ['Preparado por', 'Tesorero(a)', '', ''],
    ['Autorizado por', 'Presidente(a)', config.firmante ? config.firmante.nombre : '', ''],
    ['Recibí conforme', 'Beneficiario', g.responsable || '', g.beneficiario_rut || '']
  ];
  // Encabezado de columnas
  firmas.forEach((f, i) => {
    const x = M + i * wF;
    celda(doc, x, y, wF, 24, PEACH);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TINTA).text(f[0], x + 6, y + 4, { width: wF - 12, lineBreak: false });
    doc.font('Helvetica').fontSize(8).fillColor(GRIS).text(f[1], x + 6, y + 14, { width: wF - 12, lineBreak: false });
  });
  const ySign = y + 24;
  firmas.forEach((f, i) => { celda(doc, M + i * wF, ySign, wF, 42, BLANCO); });
  const yNom = ySign + 42;
  firmas.forEach((f, i) => {
    const x = M + i * wF;
    celda(doc, x, yNom, wF, 17, BLANCO); texto(doc, `Nombre: ${f[2]}`, x, yNom, wF, 17, { size: 8.5 });
    celda(doc, x, yNom + 17, wF, 17, BLANCO); texto(doc, `RUT: ${f[3]}`, x, yNom + 17, wF, 17, { size: 8.5 });
  });

  // ---- Pie ----
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRIS)
    .text('Este comprobante debe archivarse junto al documento de respaldo original.',
      M, ALTO - M - 4, { width: W, align: 'left', lineBreak: false });

  doc.end();
  return terminado;
}

function nombreArchivoEgreso(g) {
  return `Comprobante_egreso_${formatearFolio(g.id)}.pdf`;
}

module.exports = { generarPdfComprobanteEgreso, nombreArchivoEgreso, montoEnPalabras };
