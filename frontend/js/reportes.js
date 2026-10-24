// =====================================
// REPORTES — EXPORTACIÓN PDF / EXCEL
// =====================================

function _nombreOrg() {
  return (window.APP_CONFIG && window.APP_CONFIG.nombreOrganizacion) || 'NexoComunidad';
}

// Formato de fecha de todo descargable: DD/MM/AAAA.
// (toLocaleDateString('es-CL') entrega DD-MM-AAAA, con guiones.)
function _fechaHoy() {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${hoy.getFullYear()}`;
}

// 'AAAA-MM-DD' (o 'AAAA-MM-DD HH:MM:SS', la BD usa dateStrings) -> 'DD/MM/AAAA'.
function _fechaDMA(fecha) {
  const partes = String(fecha || '').substring(0, 10).split('-');
  if (partes.length !== 3) return fecha ? String(fecha) : '';
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Para Excel se escribe una fecha real (no texto) para que ordenar y filtrar
// por la columna funcione; _descargarExcel le aplica el formato DD/MM/AAAA.
// Se construye en UTC porque ExcelJS convierte a número de serie en UTC.
function _fechaExcel(fecha) {
  const partes = String(fecha || '').substring(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return fecha ? String(fecha) : '';
  return new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
}

function _nombreCompleto(p) {
  return [p.nombres, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(' ');
}

// Alfabético por el nombre tal como se muestra, sin distinguir tildes ni mayúsculas.
function _compararPorNombre(a, b) {
  return _nombreCompleto(a).localeCompare(_nombreCompleto(b), 'es', { sensitivity: 'base' });
}

// Mismo orden que la tabla de Integrantes: categoría y luego nombre.
function _integrantesOrdenados() {
  return [...(personasTabla || [])].sort((a, b) => {
    const idxA = ORDEN_CATEGORIA.indexOf(calcularCategoria(a.fecha_nacimiento));
    const idxB = ORDEN_CATEGORIA.indexOf(calcularCategoria(b.fecha_nacimiento));
    return idxA !== idxB ? idxA - idxB : _compararPorNombre(a, b);
  });
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
// ExcelJS (no SheetJS): la versión gratuita de SheetJS no escribe colores de
// celda ni bordes.

const COLOR_ENCABEZADO_EXCEL = 'FFF47A22';

function _excelDisponible() {
  if (!window.ExcelJS) {
    mostrarAlerta('Librería Excel no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _descargarBlob(buffer, nombreArchivo) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _estilizarEncabezado(fila) {
  fila.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ENCABEZADO_EXCEL } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
}

// Bordea todas las celdas con datos (encabezado + filas) y activa el filtro
// desplegable en la fila 1, equivalente a seleccionar la tabla y usar Ctrl+Shift+L.
function _aplicarBordesYFiltro(sheet, totalColumnas, totalFilas) {
  const borde = { style: 'thin' };
  for (let fila = 1; fila <= totalFilas; fila++) {
    for (let columna = 1; columna <= totalColumnas; columna++) {
      sheet.getCell(fila, columna).border = { top: borde, left: borde, bottom: borde, right: borde };
    }
  }
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: totalFilas, column: totalColumnas } };
}

// Encabezado con color, bordes, filtro y fechas en DD/MM/AAAA.
async function _descargarExcel(rows, nombreHoja, nombreArchivo) {
  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet(nombreHoja);
  const headers  = Object.keys(rows[0] || {});

  sheet.addRow(headers);
  rows.forEach(row => {
    const fila = sheet.addRow(headers.map(h => row[h]));
    fila.eachCell(cell => {
      if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
    });
  });

  _estilizarEncabezado(sheet.getRow(1));
  _aplicarBordesYFiltro(sheet, headers.length, rows.length + 1);

  // Ancho de columna según el contenido más largo (con tope).
  headers.forEach((h, i) => {
    const largo = Math.max(h.length, ...rows.map(r => String(r[h] instanceof Date ? '00/00/0000' : r[h] ?? '').length));
    sheet.getColumn(i + 1).width = Math.min(Math.max(largo + 2, 10), 50);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  _descargarBlob(buffer, `${nombreArchivo}_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
}

// Ejecuta una exportación Excel avisando si falla (ExcelJS es asíncrono).
function _exportarExcel(rows, nombreHoja, nombreArchivo, mensajeOk) {
  _descargarExcel(rows, nombreHoja, nombreArchivo)
    .then(() => mostrarAlerta(mensajeOk, 'success'))
    .catch(err => {
      console.error('Error generando Excel:', err);
      mostrarAlerta('No se pudo generar el Excel.', 'danger');
    });
}

// ── Excel: Integrantes ────────────────────────────────────────────────────────

function exportarIntegrantesExcel() {
  if (!_excelDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const rows = _integrantesOrdenados().map(p => ({
    'Nombre':         _nombreCompleto(p),
    'RUT':            p.rut || '',
    'Categoría':      calcularCategoria(p.fecha_nacimiento),
    'Bloque':         p.bloque || '',
    'Sexo':           p.sexo || '',
    'Email':          p.email || '',
    'Teléfono':       p.telefono || '',
    'Dirección':      p.direccion || '',
    'F. Nacimiento':  _fechaExcel(p.fecha_nacimiento),
    'F. Ingreso':     _fechaExcel(p.fecha_ingreso),
    'Apoderado':      p.nombre_apoderado || '',
    'Tel. Apoderado': p.telefono_apoderado || '',
    'Estado':         p.estado || 'activo',
    'Honorario':      p.es_honorario ? 'Sí' : 'No'
  }));
  _exportarExcel(rows, 'Integrantes', 'integrantes', `Excel generado: ${rows.length} integrante(s).`);
}

// ── Excel: Asistencias ────────────────────────────────────────────────────────

function exportarAsistenciasExcel() {
  if (!_excelDisponible()) return;
  if (!asistenciasTabla || asistenciasTabla.length === 0) {
    mostrarAlerta('No hay asistencias para exportar.', 'warning');
    return;
  }
  const rows = asistenciasTabla.map(a => ({
    'Integrante':  _nombreCompleto(a),
    'Bloque':      a.bloque       || '',
    'Actividad':   a.evento       || '',
    'Tipo':        a.tipo_evento  || '',
    'Fecha':       _fechaExcel(a.fecha_evento),
    'Estado':      a.estado       || '',
    'Min. Atraso': Number(a.minutos_atraso || 0)
  }));
  _exportarExcel(rows, 'Asistencias', 'asistencias', `Excel generado: ${rows.length} registro(s).`);
}

// ── Excel: Deudores ───────────────────────────────────────────────────────────

function _deudoresOrdenados() {
  return (finanzasCargadas || [])
    .filter(f => Number(f.deuda_actual) > 0)
    .sort(_compararPorNombre);
}

function exportarDeudoresExcel() {
  if (!_excelDisponible()) return;
  const deudores = _deudoresOrdenados();
  if (deudores.length === 0) {
    mostrarAlerta('No hay integrantes con deuda para exportar.', 'warning');
    return;
  }
  const rows = deudores.map(f => ({
    'Integrante':   _nombreCompleto(f),
    'Total Multas': Number(f.total_multas || 0),
    'Total Cuotas': Number(f.total_cuotas || 0),
    'Total Pagado': Number(f.total_pagado || 0),
    'Deuda Actual': Number(f.deuda_actual || 0)
  }));
  _exportarExcel(rows, 'Deudores', 'deudores', `Excel generado: ${rows.length} deudor(es).`);
}

// ── Excel: Gastos ─────────────────────────────────────────────────────────────

function exportarGastosExcel() {
  if (!_excelDisponible()) return;
  if (!gastosCargados || gastosCargados.length === 0) {
    mostrarAlerta('No hay gastos para exportar.', 'warning');
    return;
  }
  const rows = gastosCargados.map(g => ({
    'Fecha':       _fechaExcel(g.fecha),
    'Categoría':   g.categoria || '',
    'Descripción': g.descripcion || '',
    'Monto':       Number(g.monto || 0),
    'Responsable': g.responsable || '',
    'Comprobante': g.comprobante_path ? 'Sí' : 'No'
  }));
  _exportarExcel(rows, 'Gastos', 'gastos', `Excel generado: ${rows.length} gasto(s).`);
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

function _pdfDisponible() {
  if (!window.jspdf) {
    mostrarAlerta('Librería PDF no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _crearDocPDF(titulo) {
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF();
  const fecha = _fechaHoy();
  const org   = _nombreOrg();
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(titulo, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${org}  ·  ${fecha}`, 14, 25);
  doc._fechaArchivo = fecha;
  return doc;
}

// ── PDF: Integrantes ──────────────────────────────────────────────────────────

function exportarIntegrantesPDF() {
  if (!_pdfDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const integrantes = _integrantesOrdenados();
  const doc = _crearDocPDF('Listado de Integrantes');
  doc.autoTable({
    startY: 30,
    head: [['Nombre', 'RUT', 'Categoría', 'Sexo', 'Email', 'Estado']],
    body: integrantes.map(p => [
      _nombreCompleto(p),
      p.rut || '',
      calcularCategoria(p.fecha_nacimiento),
      p.sexo || '',
      p.email || '',
      p.estado || 'activo'
    ]),
    foot: [['', '', '', '', `Total: ${integrantes.length} integrante(s)`, '']],
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });
  doc.save(`integrantes_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${integrantes.length} integrante(s).`, 'success');
}

// ── PDF: Asistencias ──────────────────────────────────────────────────────────

function exportarAsistenciasPDF() {
  if (!_pdfDisponible()) return;
  if (!asistenciasTabla || asistenciasTabla.length === 0) {
    mostrarAlerta('No hay asistencias para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Historial de Asistencias');
  doc.autoTable({
    startY: 30,
    head: [['Integrante', 'Actividad', 'Fecha', 'Estado', 'Min.']],
    body: asistenciasTabla.map(a => [
      _nombreCompleto(a),
      a.evento || '',
      _fechaDMA(a.fecha_evento),
      a.estado || '',
      a.minutos_atraso || 0
    ]),
    foot: [['', '', '', `Total: ${asistenciasTabla.length} registro(s)`, '']],
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles:       { 4: { halign: 'center' } }
  });
  doc.save(`asistencias_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${asistenciasTabla.length} registro(s).`, 'success');
}

// ── PDF: Gastos ───────────────────────────────────────────────────────────────

function exportarGastosPDF() {
  if (!_pdfDisponible()) return;
  if (!gastosCargados || gastosCargados.length === 0) {
    mostrarAlerta('No hay gastos para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Reporte de Gastos');
  const totalGastos = gastosCargados.reduce((s, g) => s + Number(g.monto || 0), 0);
  doc.autoTable({
    startY: 30,
    head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Responsable', 'Comprobante']],
    body: gastosCargados.map(g => [
      _fechaDMA(g.fecha),
      g.categoria || '',
      g.descripcion || '',
      formatearMonto(g.monto),
      g.responsable || '',
      g.comprobante_path ? 'Sí' : 'No'
    ]),
    foot: [['', '', `Total: ${gastosCargados.length} gasto(s)`, formatearMonto(totalGastos), '', '']],
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles:       { 3: { halign: 'right' } }
  });
  doc.save(`gastos_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${gastosCargados.length} gasto(s).`, 'success');
}

// ── PDF: Reporte de Deudores ──────────────────────────────────────────────────

function exportarDeudoresPDF() {
  if (!_pdfDisponible()) return;
  const deudores = _deudoresOrdenados();
  if (deudores.length === 0) {
    mostrarAlerta('No hay integrantes con deuda para exportar.', 'warning');
    return;
  }
  const doc        = _crearDocPDF('Reporte de Deudores');
  const totalDeuda = deudores.reduce((sum, f) => sum + Number(f.deuda_actual || 0), 0);
  doc.autoTable({
    startY: 30,
    head: [['N°', 'Integrante', 'Multas', 'Cuotas', 'Pagado', 'Deuda']],
    body: deudores.map((f, i) => [
      i + 1,
      _nombreCompleto(f),
      formatearMonto(f.total_multas),
      formatearMonto(f.total_cuotas),
      formatearMonto(f.total_pagado),
      formatearMonto(f.deuda_actual)
    ]),
    foot: [['', `${deudores.length} integrante(s) con deuda`, '', '', 'Total deuda:', formatearMonto(totalDeuda)]],
    styles:             { fontSize: 9, cellPadding: 3 },
    headStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });
  doc.save(`deudores_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${deudores.length} deudores.`, 'success');
}
