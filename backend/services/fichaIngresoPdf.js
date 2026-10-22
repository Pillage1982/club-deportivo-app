// PDF "Ficha de actualización de datos" de una solicitud "Súmate a la promesa":
// calca la ficha en papel de la GDC (Ficha actualizacion de datos GDC 2027.pdf),
// misma grilla de recuadros en hoja carta, llenada con los datos del formulario
// del sitio y la firma dibujada ahí. Se genera en memoria al enviar el correo y
// cada vez que se descarga desde el panel.
const PDFDocument = require('pdfkit');
const config = require('../config/cartaPermiso');
const { rutConPuntos, formatearFolio } = require('./cartaPermisoPdf');

// Las medidas se tomaron de la ficha original escaneada (935 × 1210 px): px() las
// pasa a puntos de la hoja carta (612 × 792 pt).
const px = v => v * 612 / 935;

const TINTA = '#1d1d1d';
const GRIS = '#9a9a9a';
const ALTO_CAJA = px(30);

const ETIQUETA_ESTADO_CIVIL = {
  soltero: 'Soltero/a',
  casado: 'Casado/a',
  conviviente_civil: 'Conviviente civil',
  separado: 'Separado/a',
  divorciado: 'Divorciado/a',
  viudo: 'Viudo/a'
};

function fechaCorta(valor) {
  if (!valor) return '';
  const d = valor instanceof Date ? valor : new Date(String(valor).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  const dd = n => String(n).padStart(2, '0');
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`;
}

// fecha_nacimiento viene como Date (mysql2) o 'AAAA-MM-DD': se lee sin zona horaria.
function isoFecha(valor) {
  if (valor instanceof Date) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  return String(valor || '').substring(0, 10);
}

function edadEn(nacimientoIso, fecha) {
  const [anio, mes, dia] = nacimientoIso.split('-').map(Number);
  if (!anio) return null;
  const ref = fecha ? new Date(String(fecha).replace(' ', 'T')) : new Date();
  let edad = ref.getFullYear() - anio;
  if (ref.getMonth() + 1 < mes || (ref.getMonth() + 1 === mes && ref.getDate() < dia)) edad--;
  return edad;
}

function caja(doc, x1, y, x2) {
  doc.rect(px(x1), y, px(x2) - px(x1), ALTO_CAJA).lineWidth(1).strokeColor(TINTA).stroke();
}

function etiqueta(doc, texto, x1, y, x2, opciones = {}) {
  if (!opciones.sinCaja) caja(doc, x1, y, x2);
  doc.font('Helvetica-Bold').fontSize(opciones.tamano || 10).fillColor(opciones.color || TINTA)
    .text(texto, px(x1) + 3, y + (ALTO_CAJA - 10) / 2 + 1, {
      width: px(x2) - px(x1) - 6, align: opciones.align || 'left', lineBreak: false
    });
}

// Valor escrito dentro de un recuadro; se achica si no cabe en una línea.
function valor(doc, texto, x1, y, x2) {
  caja(doc, x1, y, x2);
  const ancho = px(x2) - px(x1) - 10;
  let tamano = 10;
  doc.font('Helvetica');
  while (tamano > 6 && doc.fontSize(tamano).widthOfString(String(texto || '')) > ancho) tamano -= 0.5;
  doc.fillColor(TINTA).fontSize(tamano)
    .text(String(texto || ''), px(x1) + 6, y + (ALTO_CAJA - tamano) / 2 + 1, { width: ancho, lineBreak: false });
}

function casilla(doc, x1, y, x2, marcada) {
  caja(doc, x1, y, x2);
  if (marcada) {
    doc.font('Helvetica').fontSize(11).fillColor(TINTA)
      .text('X', px(x1), y + (ALTO_CAJA - 11) / 2 + 1, { width: px(x2) - px(x1), align: 'center', lineBreak: false });
  }
}

// s: fila de solicitudIngresoModel.obtenerParaFicha (con firma_png y pago_integracion).
function generarPdfFichaIngreso(s) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    info: {
      Title: `Ficha de actualización de datos — Folio ${formatearFolio(s.id)}`,
      Author: 'Gran Diablada Calameña'
    }
  });

  const fragmentos = [];
  doc.on('data', f => fragmentos.push(f));
  const terminado = new Promise(resolve => doc.on('end', () => resolve(Buffer.concat(fragmentos))));

  // Membrete: logo redondo y título, como la ficha en papel.
  const tamanoLogo = px(100);
  doc.save();
  doc.circle(px(158) + tamanoLogo / 2, px(78) + tamanoLogo / 2, tamanoLogo / 2).clip();
  doc.image(config.rutaLogo, px(158), px(78), { width: tamanoLogo, height: tamanoLogo });
  doc.restore();
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TINTA)
    .text('FICHA DE ACTUALIZACIÓN DE DATOS', px(300), px(124), { width: px(520), align: 'center' });
  doc.font('Helvetica').fontSize(7.5).fillColor(GRIS)
    .text(`Folio N° ${formatearFolio(s.id)} · Recibida desde gdcayquina.cl el ${fechaCorta(s.creado_en)}`,
      px(300), px(144), { width: px(520), align: 'center' });

  const nombre = [s.nombres, s.apellido_paterno, s.apellido_materno].filter(Boolean).join(' ');
  const nacimiento = isoFecha(s.fecha_nacimiento);
  const edad = edadEn(nacimiento, s.creado_en);
  const L = 137;   // borde izquierdo de las etiquetas
  const V = 340;   // inicio de los valores
  const R = 822;   // borde derecho

  let y = px(178);
  etiqueta(doc, 'NOMBRE COMPLETO', L, y, V); valor(doc, nombre, V, y, R);
  y = px(222);
  etiqueta(doc, 'RUT', L, y, V); valor(doc, rutConPuntos(s.rut), V, y, 578);
  y = px(276);
  etiqueta(doc, 'DOMICILIO/DIRECCIÓN', L, y, V); valor(doc, s.direccion, V, y, R);
  y = px(330);
  etiqueta(doc, 'CIUDAD', L, y, V); valor(doc, s.ciudad, V, y, 578);
  y = px(383);
  etiqueta(doc, 'CELULAR', L, y, V); valor(doc, s.telefono, V, y, 622);
  y = px(436);
  etiqueta(doc, 'FECHA NACIMIENTO', L, y, V);
  valor(doc, nacimiento ? nacimiento.split('-').reverse().join('/') : '', V, y, 655);
  etiqueta(doc, 'EDAD', 655, y, 712);
  valor(doc, edad !== null ? `${edad} año${edad === 1 ? '' : 's'}` : '', 712, y, R);
  y = px(486);
  etiqueta(doc, 'ESTADO CIVIL', L, y, V); valor(doc, ETIQUETA_ESTADO_CIVIL[s.estado_civil] || s.estado_civil, V, y, 578);
  y = px(538);
  etiqueta(doc, 'CORREO ELECT.', L, y, V); valor(doc, s.email, V, y, 770);

  y = px(588);
  etiqueta(doc, 'SACRAMENTOS', L, y, V);
  etiqueta(doc, 'BAUTIZO', V, y, 430, { sinCaja: true }); casilla(doc, 430, y, 468, Number(s.bautizo));
  etiqueta(doc, 'COMUNIÓN', 470, y, 575, { sinCaja: true }); casilla(doc, 575, y, 612, Number(s.comunion));
  etiqueta(doc, 'CONFIRMACIÓN', 614, y, 776, { sinCaja: true }); casilla(doc, 776, y, R, Number(s.confirmacion));

  // Fecha de ingreso: la de aceptación de la solicitud.
  y = px(638);
  etiqueta(doc, 'FECHA INGRESO GDC', L, y, V);
  valor(doc, s.estado === 'aprobada' ? fechaCorta(s.revisado_en) : '', V, y, 770);

  y = px(688);
  etiqueta(doc, 'CONDICIÓN', L, y, V);
  etiqueta(doc, 'BAILARÍN', V, y, 430, { sinCaja: true }); casilla(doc, 430, y, 468, s.condicion === 'bailarin');
  etiqueta(doc, 'BLOQUE/FILA', 492, y, 618, { sinCaja: true });
  valor(doc, s.condicion === 'bailarin' ? s.comparsa_interes : '', 620, y, R);
  doc.font('Helvetica').fontSize(7.5).fillColor(TINTA)
    .text('En caso que quiera ser China\nSupay, Diablesa o Diablo', px(620), px(724), { width: px(R - 620), align: 'center' });
  y = px(742);
  etiqueta(doc, 'SOCIO', 340, y, 418, { sinCaja: true, align: 'right' }); casilla(doc, 420, y, 458, s.condicion === 'socio');

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TINTA).text('En caso de ser menor de 18 años:', px(L), px(792));
  y = px(808);
  etiqueta(doc, 'APODERADO', L, y, V);
  etiqueta(doc, 'NOMBRE', V, y, 425); valor(doc, s.nombre_apoderado, 425, y, R);
  y = px(838);
  etiqueta(doc, 'RUT', V, y, 425); valor(doc, s.rut_apoderado ? rutConPuntos(s.rut_apoderado) : '', 425, y, 622);
  if (s.telefono_apoderado) {
    doc.font('Helvetica').fontSize(8.5).fillColor(TINTA)
      .text(`Cel. ${s.telefono_apoderado}`, px(632), y + (ALTO_CAJA - 8.5) / 2 + 1, { lineBreak: false });
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(TINTA).text('En caso de venir de otro baile religioso:', px(L), px(886));
  y = px(902);
  etiqueta(doc, 'Nombre de Baile', V, y, 508, { align: 'center' }); valor(doc, s.baile_anterior, 508, y, R);
  y = px(902) + ALTO_CAJA;
  etiqueta(doc, 'Asociación', V, y, 508, { align: 'center' });
  etiqueta(doc, 'Federación', 508, y, 662, { align: 'center' });
  etiqueta(doc, 'Central Caporales', 662, y, R, { align: 'center' });
  y = px(968);
  casilla(doc, 404, y, 444, s.baile_anterior_entidad === 'asociacion');
  casilla(doc, 566, y, 606, s.baile_anterior_entidad === 'federacion');
  casilla(doc, 722, y, 762, s.baile_anterior_entidad === 'central_caporales');

  // Firma dibujada en el sitio, dentro del recuadro (puede sobresalir hacia arriba,
  // como una firma a mano).
  y = px(1030);
  etiqueta(doc, 'FIRMA', 508, y, 570, { align: 'center' });
  caja(doc, 570, y, R);
  if (s.firma_png) {
    try {
      doc.image(Buffer.from(s.firma_png), px(578), y - px(34), { fit: [px(R - 586), ALTO_CAJA + px(40)], align: 'center', valign: 'bottom' });
    } catch (err) {
      console.error('[Ficha ingreso] Firma ilegible, folio', s.id, err.message);
    }
  }
  if (s.nombre_apoderado) {
    doc.font('Helvetica').fontSize(7).fillColor(GRIS)
      .text('Firma del apoderado', px(570), y + ALTO_CAJA + 3, { width: px(R - 570), align: 'center' });
  }

  // Uso exclusivo GDC: pago de la cuota de inscripción (pago tipo 'integracion').
  doc.font('Helvetica-Bold').fontSize(10).fillColor(GRIS).text('USO EXCLUSIVO GDC', px(145), px(1100));
  y = px(1140);
  etiqueta(doc, 'PAGO CUOTA INSCRIPCIÓN', 140, y, 400, { sinCaja: true, color: GRIS });
  etiqueta(doc, 'SI', 410, y, 440, { sinCaja: true, color: GRIS });
  casilla(doc, 445, y, 505, s.persona_id && Number(s.pago_integracion));
  etiqueta(doc, 'NO', 625, y, 660, { sinCaja: true, color: GRIS });
  casilla(doc, 662, y, 718, s.persona_id && !Number(s.pago_integracion));

  doc.end();
  return terminado;
}

function nombreArchivoFicha(s) {
  return `Ficha_ingreso_${formatearFolio(s.id)}.pdf`;
}

module.exports = { generarPdfFichaIngreso, nombreArchivoFicha, ETIQUETA_ESTADO_CIVIL };
