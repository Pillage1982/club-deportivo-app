// Interfaz del estado financiero: carga, filtra y representa deuda, cuotas, pagos y multas informativas.
// =====================================
// CARGAR ESTADO FINANCIERO
// =====================================

let finanzasCargadas = [];

function cargarFinanzas() {
  fetch(`${API_URL}/finanzas`, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {

      if (!Array.isArray(data)) {
        mostrarAlerta(
          data.mensaje || 'No se pudo cargar el estado financiero',
          'warning'
        );
        return;
      }

      finanzasCargadas = data;
      renderizarTablaFinanzas(filtrarFinanzas(data));

    })
    .catch(err => console.error(err));
}

function filtrarFinanzas(finanzas) {
  const busqueda =
    normalizarTextoPago(
      document.getElementById('buscar_finanzas')?.value
    );

  const estado =
    document.getElementById('filtro_finanzas_estado')?.value || '';

  return finanzas.filter(finanza => {
    const nombreCompleto = normalizarTextoPago([
      finanza.nombres,
      finanza.apellido_paterno,
      finanza.apellido_materno
    ].join(' '));

    const deudaActual =
      Number(finanza.deuda_actual || 0);

    const coincideBusqueda =
      !busqueda || nombreCompleto.includes(busqueda);

    const coincideEstado =
      !estado ||
      (estado === 'con_deuda' && deudaActual > 0) ||
      (estado === 'al_dia' && deudaActual === 0) ||
      (estado === 'a_favor' && deudaActual < 0);

    return coincideBusqueda && coincideEstado;
  });
}

function renderizarTablaFinanzas(finanzas) {
  const tabla = document.getElementById('tabla_finanzas');

  tabla.innerHTML = '';

  if (!finanzas.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="${multasHabilitadas() ? 6 : 5}" class="text-center text-muted">
          No hay integrantes para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = finanzas.map(finanza => `
    <tr>
      <td>${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}</td>
      ${multasHabilitadas() ? `<td>${formatearMonto(finanza.total_multas)}</td>` : ''}
      <td>${formatearMonto(finanza.total_cuotas)}</td>
      <td>${formatearMonto(finanza.total_pagado)}</td>
      <td>${obtenerBadgeFinanciero(finanza.deuda_actual)}</td>
      <td class="text-center">
        <button type="button" class="btn btn-sm btn-outline-primary" title="Ver historial" aria-label="Ver historial"
          onclick="verHistorialFinanciero(${Number(finanza.id)})"><i class="bi bi-journal-text"></i></button>
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosFinanzas() {
  renderizarTablaFinanzas(filtrarFinanzas(finanzasCargadas));
}

function limpiarFiltrosFinanzas() {
  const buscar =
    document.getElementById('buscar_finanzas');

  const estado =
    document.getElementById('filtro_finanzas_estado');

  if (buscar) buscar.value = '';
  if (estado) estado.value = '';

  aplicarFiltrosFinanzas();
}

function configurarFiltrosFinanzas() {
  [
    'buscar_finanzas',
    'filtro_finanzas_estado'
  ].forEach(id => {
    const elemento =
      document.getElementById(id);

    if (!elemento) {
      return;
    }

    const evento =
      elemento.tagName === 'INPUT'
        ? 'input'
        : 'change';

    elemento.addEventListener(
      evento,
      aplicarFiltrosFinanzas
    );
  });
}

// =====================================
// FICHA DE HISTORIAL FINANCIERO DE UN INTEGRANTE
// =====================================
// Cuotas (con lo abonado y el saldo) y pagos (con lo que cubrió cada uno) de la
// temporada vigente o de todo el historial. Exportable a Excel y PDF.

let historialFinancieroPersonaId = null;
let historialFinancieroActual = null;

function verHistorialFinanciero(personaId) {
  historialFinancieroPersonaId = personaId;
  historialFinancieroActual = null;
  document.getElementById('hf_alcance').value = 'temporada';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_historial_financiero')).show();
  cargarHistorialFinanciero();
}

function cargarHistorialFinanciero() {
  const alcance = document.getElementById('hf_alcance')?.value || 'temporada';
  document.getElementById('hf_nombre').textContent = '';
  document.getElementById('hf_datos').textContent = 'Cargando...';
  document.getElementById('hf_resumen').innerHTML = '';
  document.getElementById('hf_cuotas').innerHTML = '';
  document.getElementById('hf_pagos').innerHTML = '';

  fetch(`${API_URL}/finanzas/historial/${historialFinancieroPersonaId}?alcance=${alcance}`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo obtener el historial');
      return data;
    })
    .then(data => {
      historialFinancieroActual = data;
      renderizarHistorialFinanciero(data);
    })
    .catch(err => {
      document.getElementById('hf_datos').textContent = '';
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo obtener el historial'), 'danger');
    });
}

function nombreHistorialFinanciero(persona) {
  return `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`.trim();
}

function periodoHistorialFinanciero(data) {
  return data.alcance === 'todo' ? 'Todo el historial' : `Temporada vigente, desde el ${formatearFecha(data.desde)}`;
}

// Cuotas de la más antigua a la más reciente, con lo abonado y el saldo.
function cuotasHistorialFinanciero(data) {
  return [...data.cuotas]
    .sort((a, b) => (a.anio * 100 + a.mes) - (b.anio * 100 + b.mes))
    .map(c => {
      const abonado = Number(c.monto_pagado) || 0;
      const saldo = c.estado === 'pagado' ? 0 : Math.max(Number(c.monto) - abonado, 0);
      return { ...c, abonado, saldo, mesTexto: `${MESES[c.mes]} ${c.anio}` };
    });
}

function textoDeudaHistorialFinanciero(deuda) {
  if (deuda < 0) return `${formatearMonto(-deuda)} a favor`;
  return deuda === 0 ? 'Al día' : formatearMonto(deuda);
}

function renderizarHistorialFinanciero(data) {
  const p = data.persona;
  document.getElementById('hf_nombre').textContent = nombreHistorialFinanciero(p);
  document.getElementById('hf_datos').textContent = [
    p.rut, p.bloque, p.estado !== 'activo' ? p.estado : '', p.es_honorario ? 'honorario' : '', periodoHistorialFinanciero(data)
  ].filter(Boolean).join(' · ');

  const r = data.resumen;
  const tarjeta = (titulo, valor, clase = '') => `
    <div class="col-6 col-md-3">
      <div class="border rounded p-2 h-100">
        <div class="small text-muted">${titulo}</div>
        <div class="fs-5 fw-bold ${clase}">${valor}</div>
      </div>
    </div>`;
  document.getElementById('hf_resumen').innerHTML =
    tarjeta('Total cuotas', formatearMonto(r.total_cuotas))
    + tarjeta('Pagado en cuotas', formatearMonto(r.total_pagado_cuotas))
    + tarjeta(r.deuda < 0 ? 'Saldo a favor' : 'Deuda', textoDeudaHistorialFinanciero(r.deuda),
      r.deuda > 0 ? 'text-danger' : (r.deuda < 0 ? 'text-primary' : 'text-success'))
    + tarjeta('Pagos extra (trajes, etc.)', formatearMonto(r.total_pagos_extra));

  const cuotas = cuotasHistorialFinanciero(data);
  document.getElementById('hf_cuotas').innerHTML = cuotas.length
    ? cuotas.map(c => `
      <tr>
        <td>${c.mesTexto}</td>
        <td>${formatearMonto(c.monto)}</td>
        <td>${c.abonado ? formatearMonto(c.abonado) : '—'}</td>
        <td>${formatearMonto(c.saldo)}</td>
        <td>${obtenerBadgeCuota(c.estado)}${c.estado !== 'pagado' && c.abonado > 0
          ? ` <span class="badge bg-info text-dark">Abono ${formatearMonto(c.abonado)}</span>` : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="text-center text-muted">Sin cuotas en este período</td></tr>';

  document.getElementById('hf_pagos').innerHTML = data.pagos.length
    ? data.pagos.map(pago => `
      <tr>
        <td>${formatearFecha(pago.fecha)}</td>
        <td>${formatearMonto(pago.monto_total)}</td>
        <td>${escaparHtml(pago.metodo || '')}</td>
        <td>${escaparHtml(etiquetaTipoPago(pago))}</td>
        <td>${pago.cuotas_cubiertas ? escaparHtml(pago.cuotas_cubiertas) : '—'}</td>
        <td class="text-center">${Number(pago.tiene_comprobante)
          ? `<button type="button" class="btn btn-sm btn-outline-primary" title="Ver comprobante" aria-label="Ver comprobante"
               onclick="verComprobantePago(${Number(pago.id)})"><i class="bi bi-file-earmark-text"></i></button>`
          : '<span class="text-muted small">—</span>'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="text-center text-muted">Sin pagos en este período</td></tr>';
}

function archivoHistorialFinanciero(data, extension) {
  const nombre = nombreHistorialFinanciero(data.persona)
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_');
  return `historial_${nombre}_${_fechaHoy().replace(/\//g, '-')}.${extension}`;
}

async function exportarHistorialFinancieroExcel() {
  const data = historialFinancieroActual;
  if (!data) return;
  if (!_excelDisponible()) return;

  const workbook = new ExcelJS.Workbook();
  const r = data.resumen;

  const hojaResumen = workbook.addWorksheet('Resumen');
  hojaResumen.addRow(['Campo', 'Valor']);
  [
    ['Integrante', nombreHistorialFinanciero(data.persona)],
    ['RUT', data.persona.rut || ''],
    ['Bloque', data.persona.bloque || ''],
    ['Período', periodoHistorialFinanciero(data)],
    ['Total cuotas', Number(r.total_cuotas)],
    ['Pagado en cuotas', Number(r.total_pagado_cuotas)],
    [r.deuda < 0 ? 'Saldo a favor' : 'Deuda', Math.abs(Number(r.deuda))],
    ['Pagos extra', Number(r.total_pagos_extra)],
    ['Generado', `${_nombreOrg()} · ${_fechaHoy()}`]
  ].forEach(fila => hojaResumen.addRow(fila));
  _estilizarEncabezado(hojaResumen.getRow(1));
  hojaResumen.getColumn(1).width = 22;
  hojaResumen.getColumn(2).width = 40;

  const cuotas = cuotasHistorialFinanciero(data);
  const hojaCuotas = workbook.addWorksheet('Cuotas');
  hojaCuotas.addRow(['Mes', 'Monto', 'Abonado', 'Saldo', 'Estado']);
  cuotas.forEach(c => hojaCuotas.addRow([c.mesTexto, Number(c.monto), c.abonado, c.saldo,
    c.estado !== 'pagado' && c.abonado > 0 ? `${c.estado} (abono)` : c.estado]));
  _estilizarEncabezado(hojaCuotas.getRow(1));
  _aplicarBordesYFiltro(hojaCuotas, 5, cuotas.length + 1);

  const hojaPagos = workbook.addWorksheet('Pagos');
  hojaPagos.addRow(['Fecha', 'Monto', 'Método', 'Tipo', 'Cubrió', 'Comprobante']);
  data.pagos.forEach(pago => {
    const fila = hojaPagos.addRow([_fechaExcel(pago.fecha), Number(pago.monto_total), pago.metodo || '',
      etiquetaTipoPago(pago), pago.cuotas_cubiertas || '', Number(pago.tiene_comprobante) ? 'Sí' : 'No']);
    if (fila.getCell(1).value instanceof Date) fila.getCell(1).numFmt = 'dd/mm/yyyy';
  });
  _estilizarEncabezado(hojaPagos.getRow(1));
  _aplicarBordesYFiltro(hojaPagos, 6, data.pagos.length + 1);

  [hojaCuotas, hojaPagos].forEach(hoja => hoja.columns.forEach(col => { col.width = 16; }));
  hojaPagos.getColumn(5).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  _descargarBlob(buffer, archivoHistorialFinanciero(data, 'xlsx'));
}

function exportarHistorialFinancieroPDF() {
  const data = historialFinancieroActual;
  if (!data) return;
  if (!_pdfDisponible()) return;

  const r = data.resumen;
  const doc = _crearDocPDF(`Historial financiero — ${nombreHistorialFinanciero(data.persona)}`);
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text([
    [data.persona.rut, data.persona.bloque].filter(Boolean).join(' · '),
    periodoHistorialFinanciero(data),
    `Total cuotas: ${formatearMonto(r.total_cuotas)}   ·   Pagado en cuotas: ${formatearMonto(r.total_pagado_cuotas)}   ·   `
      + `${r.deuda < 0 ? 'Saldo a favor' : 'Deuda'}: ${textoDeudaHistorialFinanciero(r.deuda)}   ·   Pagos extra: ${formatearMonto(r.total_pagos_extra)}`
  ], 14, 32);

  const estilos = {
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  };

  doc.autoTable({
    startY: 48,
    head: [['Mes', 'Monto', 'Abonado', 'Saldo', 'Estado']],
    body: cuotasHistorialFinanciero(data).map(c => [c.mesTexto, formatearMonto(c.monto),
      c.abonado ? formatearMonto(c.abonado) : '—', formatearMonto(c.saldo),
      c.estado !== 'pagado' && c.abonado > 0 ? `${c.estado} (abono)` : c.estado]),
    ...estilos
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 8,
    head: [['Fecha', 'Monto', 'Método', 'Tipo', 'Cubrió', 'Comprobante']],
    body: data.pagos.map(pago => [_fechaDMA(pago.fecha), formatearMonto(pago.monto_total), pago.metodo || '',
      etiquetaTipoPago(pago), pago.cuotas_cubiertas || '—', Number(pago.tiene_comprobante) ? 'Sí' : 'No']),
    ...estilos
  });

  doc.save(archivoHistorialFinanciero(data, 'pdf'));
}
