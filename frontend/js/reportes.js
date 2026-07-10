// =====================================
// REPORTES — EXPORTACIÓN PDF / EXCEL
// =====================================

function _nombreOrg() {
  return (window.APP_CONFIG && window.APP_CONFIG.nombreOrganizacion) || 'NexoComunidad';
}

function _fechaHoy() {
  return new Date().toLocaleDateString('es-CL');
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
