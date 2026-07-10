// =====================================
// REPORTES — EXPORTACIÓN PDF / EXCEL
// =====================================

function _nombreOrg() {
  return (window.APP_CONFIG && window.APP_CONFIG.nombreOrganizacion) || 'NexoComunidad';
}

function _fechaHoy() {
  return new Date().toLocaleDateString('es-CL');
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

function _xlsxDisponible() {
  if (!window.XLSX) {
    mostrarAlerta('Librería Excel no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _descargarExcel(rows, nombreHoja, nombreArchivo) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, `${nombreArchivo}_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
}

// ── Excel: Integrantes ────────────────────────────────────────────────────────

function exportarIntegrantesExcel() {
  if (!_xlsxDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const rows = personasTabla.map(p => ({
    'Nombre':         `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim(),
    'RUT':            p.rut || '',
    'Bloque':         p.bloque || '',
    'Sexo':           p.sexo || '',
    'Email':          p.email || '',
    'Teléfono':       p.telefono || '',
    'Dirección':      p.direccion || '',
    'F. Nacimiento':  p.fecha_nacimiento ? String(p.fecha_nacimiento).substring(0, 10) : '',
    'F. Ingreso':     p.fecha_ingreso    ? String(p.fecha_ingreso).substring(0, 10)    : '',
    'Estado':         p.estado || 'activo',
    'Honorario':      p.es_honorario ? 'Sí' : 'No',
    'Apoderado':      p.nombre_apoderado   || '',
    'Tel. Apoderado': p.telefono_apoderado || ''
  }));
  _descargarExcel(rows, 'Integrantes', 'integrantes');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Asistencias ────────────────────────────────────────────────────────

function exportarAsistenciasExcel() {
  if (!_xlsxDisponible()) return;
  if (!asistenciasTabla || asistenciasTabla.length === 0) {
    mostrarAlerta('No hay asistencias para exportar.', 'warning');
    return;
  }
  const rows = asistenciasTabla.map(a => ({
    'Integrante':  `${a.nombres} ${a.apellido_paterno} ${a.apellido_materno || ''}`.trim(),
    'Bloque':      a.bloque       || '',
    'Actividad':   a.evento       || '',
    'Tipo':        a.tipo_evento  || '',
    'Fecha':       a.fecha_evento ? String(a.fecha_evento).substring(0, 10) : '',
    'Estado':      a.estado       || '',
    'Min. Atraso': Number(a.minutos_atraso || 0)
  }));
  _descargarExcel(rows, 'Asistencias', 'asistencias');
  mostrarAlerta(`Excel generado: ${rows.length} registro(s).`, 'success');
}

// ── Excel: Deudores ───────────────────────────────────────────────────────────

function exportarDeudoresExcel() {
  if (!_xlsxDisponible()) return;
  const deudores = (finanzasCargadas || []).filter(f => Number(f.deuda_actual) > 0);
  if (deudores.length === 0) {
    mostrarAlerta('No hay integrantes con deuda para exportar.', 'warning');
    return;
  }
  const rows = deudores.map(f => ({
    'Integrante':   `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ''}`.trim(),
    'Total Multas': Number(f.total_multas || 0),
    'Total Cuotas': Number(f.total_cuotas || 0),
    'Total Pagado': Number(f.total_pagado || 0),
    'Deuda Actual': Number(f.deuda_actual || 0)
  }));
  _descargarExcel(rows, 'Deudores', 'deudores');
  mostrarAlerta(`Excel generado: ${rows.length} deudor(es).`, 'success');
}

// ── Excel: Puntaje ────────────────────────────────────────────────────────────

function exportarPuntajeExcel() {
  if (!_xlsxDisponible()) return;
  if (!rankingCargado || rankingCargado.length === 0) {
    mostrarAlerta('No hay datos de puntaje para exportar.', 'warning');
    return;
  }
  const rows = rankingCargado.map((r, i) => ({
    '#':          i + 1,
    'Integrante': `${r.nombres} ${r.apellido_paterno} ${r.apellido_materno || ''}`.trim(),
    'Bloque':     r.bloque || '',
    'Puntaje':    Number(r.puntaje_total),
    'Registros':  Number(r.total_registros)
  }));
  _descargarExcel(rows, 'Puntaje', 'ranking_puntaje');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── PDF: Reporte de Deudores ──────────────────────────────────────────────────

function exportarDeudoresPDF() {
  if (!window.jspdf) {
    mostrarAlerta('Librería PDF no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return;
  }

  const deudores = (finanzasCargadas || []).filter(f => Number(f.deuda_actual) > 0);

  if (deudores.length === 0) {
    mostrarAlerta('No hay integrantes con deuda para exportar.', 'warning');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const fecha = _fechaHoy();
  const org   = _nombreOrg();

  // Encabezado
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text('Reporte de Deudores', 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${org}  ·  ${fecha}`, 14, 25);

  const totalDeuda = deudores.reduce((sum, f) => sum + Number(f.deuda_actual || 0), 0);

  doc.autoTable({
    startY: 30,
    head: [['N°', 'Integrante', 'Multas', 'Cuotas', 'Pagado', 'Deuda']],
    body: deudores.map((f, i) => [
      i + 1,
      `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ''}`.trim(),
      formatearMonto(f.total_multas),
      formatearMonto(f.total_cuotas),
      formatearMonto(f.total_pagado),
      formatearMonto(f.deuda_actual)
    ]),
    foot: [[
      '', `${deudores.length} integrante(s) con deuda`, '', '', 'Total deuda:',
      formatearMonto(totalDeuda)
    ]],
    styles:              { fontSize: 9, cellPadding: 3 },
    headStyles:          { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:          { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles:  { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });

  doc.save(`deudores_${fecha.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${deudores.length} deudores.`, 'success');
}
