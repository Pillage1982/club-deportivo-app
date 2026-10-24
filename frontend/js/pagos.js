let pagoEditando = null;
let pagosCargados = [];
let finanzasCargadas = [];

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Tipos de pago: solo 'cuota' rebaja la deuda; el resto entra a caja sin abonar cuotas.
const TIPOS_PAGO = {
  cuota: 'Cuota mensual',
  inscripcion: 'Inscripción',
  otro: 'Otro'
};

function etiquetaTipoPago(pago) {
  const tipo = TIPOS_PAGO[pago.tipo_pago] || TIPOS_PAGO.cuota;
  return pago.detalle ? `${tipo} — ${pago.detalle}` : tipo;
}

// Con un pago que no es de cuota no aplica marcar meses: se oculta la lista.
function actualizarTipoPago() {
  const tipo = document.getElementById('pago_tipo')?.value || 'cuota';

  document.getElementById('pago_cuota_grupo')?.classList.toggle('d-none', tipo !== 'cuota');
  if (tipo !== 'cuota') marcarCuotasPago(false);

  const ayuda = document.getElementById('pago_detalle_ayuda');
  if (ayuda) ayuda.textContent = tipo === 'otro' ? '(obligatorio)' : '(opcional)';
}

// Lista de casillas con todas las cuotas pendientes del integrante: tesorería
// marca a mano los meses que cubre el pago.
function cargarCuotasPendientesPago(persona_id) {
  const lista = document.getElementById('pago_cuotas_lista');
  if (!lista) return;
  lista.innerHTML = '<span class="text-muted small">Seleccione un integrante</span>';
  actualizarSeleccionCuotasPago();
  if (!persona_id) return;

  lista.innerHTML = '<span class="text-muted small">Cargando cuotas...</span>';
  fetch(`${API_URL}/cuotas/pendientes/${persona_id}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(cuotas => {
      if (!Array.isArray(cuotas) || cuotas.length === 0) {
        lista.innerHTML = '<span class="text-muted small">Este integrante no tiene cuotas pendientes</span>';
        return;
      }
      lista.innerHTML = cuotas.map(c => `
        <div class="form-check">
          <input class="form-check-input pago-cuota-check" type="checkbox" id="pago_cuota_${Number(c.id)}"
            value="${Number(c.id)}" data-saldo="${Number(c.saldo)}" data-mes="${Number(c.mes)}" data-anio="${Number(c.anio)}"
            onchange="actualizarSeleccionCuotasPago()">
          <label class="form-check-label" for="pago_cuota_${Number(c.id)}">
            ${MESES[c.mes]} ${Number(c.anio)} — saldo ${formatearMonto(c.saldo)}
            <span class="badge ${c.estado === 'vencido' ? 'bg-danger' : 'bg-secondary'} ms-1">${escaparHtml(c.estado)}</span>
            ${Number(c.monto_pagado) > 0 ? `<span class="badge bg-info text-dark ms-1">Abono ${formatearMonto(c.monto_pagado)}</span>` : ''}
          </label>
        </div>
      `).join('');
    })
    .catch(() => {
      lista.innerHTML = '<span class="text-danger small">No se pudieron cargar las cuotas</span>';
    });
}

function cuotasMarcadasPago() {
  return [...document.querySelectorAll('.pago-cuota-check:checked')];
}

function marcarCuotasPago(marcar) {
  document.querySelectorAll('.pago-cuota-check').forEach(check => {
    check.checked = marcar;
  });
  actualizarSeleccionCuotasPago();
}

// Monto = suma de saldos marcados, editable: si se escribe uno menor, se pagan
// primero los meses más antiguos y el último queda con abono parcial.
function actualizarSeleccionCuotasPago() {
  const marcadas = cuotasMarcadasPago();
  const monto = document.getElementById('pago_monto');
  const resumen = document.getElementById('pago_cuotas_resumen');
  const total = marcadas.reduce((suma, c) => suma + Number(c.dataset.saldo), 0);

  if (monto && marcadas.length) monto.value = total;

  if (resumen) {
    resumen.textContent = !marcadas.length
      ? ''
      : `${marcadas.length} mes(es): ${marcadas.map(c => `${MESES[c.dataset.mes]} ${c.dataset.anio}`).join(', ')} — total ${formatearMonto(total)}`
        + (marcadas.length === 1
          ? ' (puede ingresar un monto menor para un abono parcial)'
          : ' (si el monto es menor, se pagan primero los más antiguos y el último queda con abono parcial)');
  }
}

function configurarSelectorCuotaPago() {
  const sel = document.getElementById('pago_persona_id');
  if (!sel) return;
  sel.addEventListener('change', () => {
    cargarCuotasPendientesPago(sel.value);
    cargarDepositosPago(sel.value);
  });
}

function cargarFinanzas() {
  fetch(`${API_URL}/finanzas`, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      const tabla = document.getElementById('tabla_finanzas');

      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar el estado financiero',
    'warning'
  );
  return;
}

      finanzasCargadas = data;
      renderizarTablaFinanzas(
        filtrarFinanzas(data)
      );
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
        <td colspan="6" class="text-center text-muted">
          No hay integrantes para los filtros seleccionados
        </td>
      </tr>
    `;

    return;
  }

  tabla.innerHTML = finanzas.map(finanza => `
    <tr>
      <td>${escaparHtml(`${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}`)}</td>
      <td>${formatearMonto(finanza.total_multas)}</td>
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

// =====================================
// FICHA DE HISTORIAL FINANCIERO DE UN INTEGRANTE
// =====================================
// Cuotas (con lo abonado y el saldo) y pagos (con lo que cubrió cada uno) del año
// en curso o de todo el historial. Exportable a Excel y PDF.

let historialFinancieroPersonaId = null;
let historialFinancieroActual = null;

function verHistorialFinanciero(personaId) {
  historialFinancieroPersonaId = personaId;
  historialFinancieroActual = null;
  document.getElementById('hf_alcance').value = 'anio';
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_historial_financiero')).show();
  cargarHistorialFinanciero();
}

function cargarHistorialFinanciero() {
  const alcance = document.getElementById('hf_alcance')?.value || 'anio';
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
  return data.alcance === 'todo' ? 'Todo el historial' : `Este año, desde el ${formatearFecha(data.desde)}`;
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
    p.rut, p.bloque, p.estado !== 'activo' ? p.estado : '', Number(p.es_honorario) ? 'honorario' : '', periodoHistorialFinanciero(data)
  ].filter(Boolean).join(' · ');

  const r = data.resumen;
  const tarjeta = (titulo, valor, clase = '') => `
    <div class="col-6 col-md">
      <div class="border rounded p-2 h-100">
        <div class="small text-muted">${titulo}</div>
        <div class="fs-5 fw-bold ${clase}">${valor}</div>
      </div>
    </div>`;
  document.getElementById('hf_resumen').innerHTML =
    tarjeta('Total cuotas', formatearMonto(r.total_cuotas))
    + tarjeta('Multas pendientes', formatearMonto(r.total_multas))
    + tarjeta('Pagado en cuotas', formatearMonto(r.total_pagado_cuotas))
    + tarjeta(r.deuda < 0 ? 'Saldo a favor' : 'Deuda actual', textoDeudaHistorialFinanciero(r.deuda),
      r.deuda > 0 ? 'text-danger' : (r.deuda < 0 ? 'text-primary' : 'text-success'))
    + tarjeta('Otros pagos', formatearMonto(r.total_pagos_otros));

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
    ['Período', periodoHistorialFinanciero(data)],
    ['Total cuotas', Number(r.total_cuotas)],
    ['Multas pendientes', Number(r.total_multas)],
    ['Pagado en cuotas', Number(r.total_pagado_cuotas)],
    [r.deuda < 0 ? 'Saldo a favor' : 'Deuda actual', Math.abs(Number(r.deuda))],
    ['Otros pagos', Number(r.total_pagos_otros)],
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
    `Cuotas: ${formatearMonto(r.total_cuotas)}   ·   Multas: ${formatearMonto(r.total_multas)}   ·   Pagado en cuotas: ${formatearMonto(r.total_pagado_cuotas)}`,
    `${r.deuda < 0 ? 'Saldo a favor' : 'Deuda actual'}: ${textoDeudaHistorialFinanciero(r.deuda)}   ·   Otros pagos: ${formatearMonto(r.total_pagos_otros)}`
  ], 14, 32);

  const estilos = {
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  };

  doc.autoTable({
    startY: 54,
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

function aplicarFiltrosFinanzas() {
  renderizarTablaFinanzas(
    filtrarFinanzas(finanzasCargadas)
  );
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

function editarPago(pago) {
  pagoEditando = pago.id;

  document.getElementById('pago_tipo').value = pago.tipo_pago || 'cuota';
  document.getElementById('pago_detalle').value = pago.detalle || '';
  actualizarTipoPago();

  // Editar no cambia meses vinculados: solo los pagos sin cuotas se pueden editar
  document.getElementById('pago_cuota_grupo')?.classList.add('d-none');

  document.getElementById('pago_persona_id').value =
    pago.persona_id || '';

  cargarDepositosPago(pago.persona_id);

  document.getElementById('pago_monto').value =
    pago.monto_total || '';

  document.getElementById('pago_metodo').value =
    pago.metodo || '';

  document.getElementById('btn_guardar_pago').innerText =
    'Actualizar Pago';

  irAFormulario('#subtab_form_pago');
}

function crearPago() {
  const personaId  = document.getElementById('pago_persona_id').value;
  const montoTotal = Number(document.getElementById('pago_monto').value);
  const metodo     = document.getElementById('pago_metodo').value;
  const tipoPago   = document.getElementById('pago_tipo')?.value || 'cuota';
  const detalle    = (document.getElementById('pago_detalle')?.value || '').trim();

  const metodosPermitidos = [
    'efectivo',
    'transferencia',
    'debito'
  ];

  if (!personaId) {
    mostrarAlerta('Seleccione un integrante', 'warning');
    return;
  }

  if (!Number.isFinite(montoTotal) || montoTotal <= 0) {
    mostrarAlerta('El monto debe ser mayor a 0', 'warning');
    return;
  }

  if (!metodosPermitidos.includes(metodo)) {
    mostrarAlerta('Seleccione un metodo de pago valido', 'warning');
    return;
  }

  if (tipoPago === 'otro' && !detalle) {
    mostrarAlerta('Indique en el detalle qué se está pagando', 'warning');
    return;
  }

  const cuotaIds = tipoPago === 'cuota' && !pagoEditando
    ? cuotasMarcadasPago().map(c => Number(c.value))
    : [];
  const totalMarcado = cuotasMarcadasPago().reduce((suma, c) => suma + Number(c.dataset.saldo), 0);
  if (cuotaIds.length && montoTotal > totalMarcado) {
    mostrarAlerta(`El monto supera la suma de los meses marcados (${formatearMonto(totalMarcado)}). Marque más meses.`, 'warning');
    return;
  }

  // FormData para poder adjuntar el comprobante (opcional)
  const data = new FormData();
  data.append('persona_id', personaId);
  data.append('monto_total', montoTotal);
  data.append('metodo', metodo);
  data.append('tipo_pago', tipoPago);
  if (detalle) data.append('detalle', detalle);
  if (cuotaIds.length) data.append('cuota_ids', JSON.stringify(cuotaIds));
  const archivo = document.getElementById('pago_comprobante')?.files[0];
  if (archivo) data.append('comprobante', archivo);
  const depositoId = document.getElementById('pago_deposito_id')?.value;
  if (!archivo && depositoId) data.append('comprobante_deposito_id', depositoId);

  let url = `${API_URL}/pagos`;
  let method = 'POST';

  if (pagoEditando) {
    url = `${API_URL}/pagos/${pagoEditando}`;
    method = 'PUT';
  }

  const estadoBoton =
    bloquearBoton(
      'btn_guardar_pago',
      'Guardando...'
    );

  if (!estadoBoton) return;

  fetch(url, {
    method: method,
    headers: getAuthHeadersMultipart(),
    body: data
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);

      if (!res.ok) {
        throw new Error(
          respuesta.mensaje || 'No se pudo guardar el pago'
        );
      }

      return respuesta;
    })
    .then(data => {
      mostrarAlerta(data.mensaje, 'success');

      pagoEditando = null;

      document.getElementById('btn_guardar_pago').innerText =
        'Guardar Pago';

      document.getElementById('pago_monto').value = '';
      document.getElementById('pago_metodo').value = 'efectivo';
      document.getElementById('pago_tipo').value = 'cuota';
      document.getElementById('pago_detalle').value = '';
      document.getElementById('pago_comprobante').value = '';
      actualizarTipoPago();
      cargarCuotasPendientesPago(document.getElementById('pago_persona_id').value);
      cargarDepositosPago(document.getElementById('pago_persona_id').value);

      cargarTablaPagos();
      cargarTablaDepositos();
      cargarMultas();
      cargarFinanzas();
      if (typeof cargarCuotas === 'function') cargarCuotas();
      cargarDashboard();
      cargarGraficos();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(
          err,
          'No se pudo guardar el pago'
        ),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(
        estadoBoton,
        pagoEditando
          ? 'Actualizar Pago'
          : 'Guardar Pago'
      );
    });
}

function cargarTablaPagos() {
  fetch(`${API_URL}/pagos`, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      const tabla = document.getElementById('tabla_pagos');

      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }

      pagosCargados = data;
      renderizarTablaPagos(
        filtrarPagos(data)
      );
    })
    .catch(err => console.error(err));
}

function filtrarPagos(pagos) {
  const busqueda =
    normalizarTextoPago(
      document.getElementById('buscar_pagos')?.value
    );

  const metodo =
    document.getElementById('filtro_pago_metodo')?.value || '';

  const tipo =
    document.getElementById('filtro_pago_tipo')?.value || '';

  return pagos.filter(pago => {
    const nombreCompleto = normalizarTextoPago([
      pago.nombres,
      pago.apellido_paterno,
      pago.apellido_materno
    ].join(' '));

    const coincideBusqueda =
      !busqueda || nombreCompleto.includes(busqueda);

    const coincideMetodo =
      !metodo || pago.metodo === metodo;

    const coincideTipo =
      !tipo || (pago.tipo_pago || 'cuota') === tipo;

    return coincideBusqueda && coincideMetodo && coincideTipo;
  });
}

function renderizarTablaPagos(pagos) {
  const tabla = document.getElementById('tabla_pagos');

  tabla.innerHTML = '';

  if (!pagos.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          No hay pagos para los filtros seleccionados
        </td>
      </tr>
    `;

    return;
  }

  // Los pagos vinculados a cuotas no se editan ni eliminan (cambiarían lo abonado
  // a cada cuota): se registra un ajuste aparte. El comprobante sí se puede adjuntar.
  tabla.innerHTML = pagos.map(pago => `
    <tr>
      <td>${escaparHtml(`${pago.nombres} ${pago.apellido_paterno} ${pago.apellido_materno || ''}`)}</td>
      <td>${escaparHtml(etiquetaTipoPago(pago))}</td>
      <td>${formatearMonto(pago.monto_total)}</td>
      <td>${escaparHtml(pago.metodo || '')}</td>
      <td>${formatearFecha(pago.fecha)}</td>
      <td class="text-nowrap">
        ${pago.comprobante_path
          ? `<button type="button" class="btn btn-sm btn-outline-primary me-1" title="Ver comprobante" aria-label="Ver comprobante"
               onclick="verComprobantePago(${Number(pago.id)})"><i class="bi bi-file-earmark-text"></i></button>`
          : `<button type="button" class="btn btn-sm btn-outline-secondary me-1" title="Adjuntar comprobante" aria-label="Adjuntar comprobante"
               onclick="elegirComprobantePago(${Number(pago.id)})"><i class="bi bi-paperclip"></i></button>`}
        ${Number(pago.tiene_detalle) ? '<span class="badge bg-secondary">Vinculado a cuotas</span>' : `
        <div class="btn-group btn-group-sm" role="group" aria-label="Acciones">
          <button type="button" class="btn btn-outline-warning" title="Editar" aria-label="Editar"
            onclick='editarPago(pagosCargados.find(p => p.id === ${Number(pago.id)}))'>&#9998;</button>
          <button type="button" class="btn btn-outline-danger" title="Eliminar" aria-label="Eliminar"
            onclick='eliminarPago(${Number(pago.id)})'>&times;</button>
        </div>`}
      </td>
    </tr>
  `).join('');
}

function verComprobantePago(id) {
  abrirArchivoProtegido(`${API_URL}/pagos/${id}/comprobante`);
}

function verComprobanteDeposito(id) {
  abrirArchivoProtegido(`${API_URL}/pagos/depositos/${id}/archivo`);
}

// Descarga con el token y abre el archivo en otra pestaña.
function abrirArchivoProtegido(url) {
  fetch(url, { headers: getAuthHeaders(), cache: 'no-store' })
    .then(async res => {
      if (!res.ok) {
        const data = await leerRespuestaJson(res);
        throw new Error(data.mensaje || 'No se pudo obtener el comprobante');
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo obtener el comprobante'), 'danger');
    });
}

// Adjuntar comprobante a un pago ya registrado (sirve también para los vinculados
// a cuotas, que no se pueden editar).
let pagoComprobantePendiente = null;

// Si el socio envió comprobantes desde el Portal que aún no se usan, se ofrecen en
// un modal; si no hay ninguno, se abre directo el selector de archivo.
function elegirComprobantePago(id) {
  const pago = pagosCargados.find(p => p.id === id);
  pagoComprobantePendiente = id;
  if (!pago) return subirArchivoComprobantePago();

  fetch(`${API_URL}/pagos/depositos/persona/${pago.persona_id}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(depositos => {
      if (!Array.isArray(depositos) || !depositos.length) return subirArchivoComprobantePago();

      document.getElementById('lista_depositos_adjuntar').innerHTML = depositos.map(d => `
        <div class="list-group-item d-flex justify-content-between align-items-center gap-2">
          <div>
            <div><strong>${formatearMonto(d.monto)}</strong> · depositado ${formatearFecha(d.fecha_deposito)}</div>
            <small class="text-muted">Folio ${Number(d.id)}${d.concepto ? ` · ${escaparHtml(d.concepto)}` : ''}</small>
          </div>
          <div class="btn-group btn-group-sm">
            <button type="button" class="btn btn-outline-primary" title="Ver" onclick="verComprobanteDeposito(${Number(d.id)})"><i class="bi bi-eye"></i></button>
            <button type="button" class="btn btn-success" onclick="usarDepositoEnPago(${Number(d.id)})">Usar</button>
          </div>
        </div>
      `).join('');
      bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_adjuntar_comprobante_pago')).show();
    })
    .catch(() => subirArchivoComprobantePago());
}

function subirArchivoComprobantePago() {
  const modal = bootstrap.Modal.getInstance(document.getElementById('modal_adjuntar_comprobante_pago'));
  if (modal) modal.hide();
  const input = document.getElementById('pago_comprobante_adjuntar');
  if (!input) return;
  input.value = '';
  input.click();
}

function usarDepositoEnPago(depositoId) {
  const id = pagoComprobantePendiente;
  pagoComprobantePendiente = null;
  bootstrap.Modal.getInstance(document.getElementById('modal_adjuntar_comprobante_pago'))?.hide();
  if (!id) return;

  const data = new FormData();
  data.append('comprobante_deposito_id', depositoId);
  enviarComprobantePago(id, data);
}

function enviarComprobantePago(id, data) {
  fetch(`${API_URL}/pagos/${id}/comprobante`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: data
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(respuesta.mensaje || 'No se pudo guardar el comprobante');
      return respuesta;
    })
    .then(respuesta => {
      mostrarAlerta(respuesta.mensaje || 'Comprobante guardado', 'success');
      cargarTablaPagos();
      cargarTablaDepositos();
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo guardar el comprobante'), 'danger');
    });
}

function configurarAdjuntarComprobantePago() {
  const input = document.getElementById('pago_comprobante_adjuntar');
  if (!input) return;
  input.addEventListener('change', () => {
    const archivo = input.files[0];
    const id = pagoComprobantePendiente;
    pagoComprobantePendiente = null;
    if (!archivo || !id) return;

    const data = new FormData();
    data.append('comprobante', archivo);
    enviarComprobantePago(id, data);
  });
}

// =====================================
// DEPÓSITOS: comprobantes que los socios envían desde el Portal
// =====================================

let depositosCargados = [];

// Selector del formulario de pago: comprobantes pendientes del integrante elegido.
function cargarDepositosPago(personaId, seleccionarId = null) {
  const grupo = document.getElementById('pago_deposito_grupo');
  const select = document.getElementById('pago_deposito_id');
  if (!grupo || !select) return Promise.resolve();

  limpiarDepositosPago();
  if (!personaId) return Promise.resolve();

  return fetch(`${API_URL}/pagos/depositos/persona/${personaId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(depositos => {
      if (!Array.isArray(depositos) || !depositos.length) return;
      depositos.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        opt.dataset.monto = d.monto;
        opt.textContent = `Folio ${d.id} — ${formatearMonto(d.monto)}, depositado ${formatearFecha(d.fecha_deposito)}${d.concepto ? ` (${d.concepto})` : ''}`;
        select.appendChild(opt);
      });
      grupo.classList.remove('d-none');
      if (seleccionarId) {
        select.value = String(seleccionarId);
        actualizarDepositoPago();
      }
    })
    .catch(() => {});
}

function limpiarDepositosPago() {
  const select = document.getElementById('pago_deposito_id');
  if (select) select.innerHTML = '<option value="">No usar</option>';
  document.getElementById('pago_deposito_grupo')?.classList.add('d-none');
  const archivo = document.getElementById('pago_comprobante');
  if (archivo) archivo.disabled = false;
}

// Elegir un depósito reemplaza a subir archivo; si el monto está vacío, lo propone.
function actualizarDepositoPago() {
  const select = document.getElementById('pago_deposito_id');
  const archivo = document.getElementById('pago_comprobante');
  const opcion = select?.selectedOptions[0];
  const usaDeposito = Boolean(select?.value);

  if (archivo) {
    archivo.disabled = usaDeposito;
    if (usaDeposito) archivo.value = '';
  }

  const monto = document.getElementById('pago_monto');
  if (usaDeposito && monto && !monto.value && opcion?.dataset.monto) {
    monto.value = opcion.dataset.monto;
  }
}

function verDepositoSeleccionadoPago() {
  const id = document.getElementById('pago_deposito_id')?.value;
  if (!id) {
    mostrarAlerta('Elija primero un comprobante de la lista', 'warning');
    return;
  }
  verComprobanteDeposito(id);
}

// Desde Tablas → Depósitos: abre el formulario con el integrante, monto y comprobante.
function registrarPagoDesdeDeposito(id) {
  const deposito = depositosCargados.find(d => d.id === id);
  if (!deposito) return;

  pagoEditando = null;
  document.getElementById('btn_guardar_pago').innerText = 'Guardar Pago';
  document.getElementById('pago_persona_id').value = deposito.persona_id;
  document.getElementById('pago_tipo').value = 'cuota';
  document.getElementById('pago_detalle').value = '';
  actualizarTipoPago();
  document.getElementById('pago_monto').value = deposito.monto;
  cargarCuotasPendientesPago(deposito.persona_id);
  cargarDepositosPago(deposito.persona_id, deposito.id);

  irAFormulario('#subtab_form_pago');
}

function cargarTablaDepositos() {
  fetch(`${API_URL}/pagos/depositos`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) return;
      depositosCargados = data;

      const pendientes = data.filter(d => !d.pago_id).length;
      const badge = document.getElementById('badge_depositos');
      if (badge) {
        badge.textContent = pendientes;
        badge.classList.toggle('d-none', pendientes === 0);
      }

      renderizarTablaDepositos(filtrarDepositos(data));
    })
    .catch(err => console.error(err));
}

function filtrarDepositos(depositos) {
  const busqueda = normalizarTextoPago(document.getElementById('buscar_depositos')?.value);
  const estado = document.getElementById('filtro_deposito_estado')?.value || '';

  return depositos.filter(d => {
    const nombre = normalizarTextoPago([d.nombres, d.apellido_paterno, d.apellido_materno].join(' '));
    const coincideEstado = !estado || (estado === 'pendiente' ? !d.pago_id : Boolean(d.pago_id));
    return (!busqueda || nombre.includes(busqueda)) && coincideEstado;
  });
}

function renderizarTablaDepositos(depositos) {
  const tabla = document.getElementById('tabla_depositos');
  if (!tabla) return;

  if (!depositos.length) {
    tabla.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay comprobantes para los filtros seleccionados</td></tr>';
    return;
  }

  tabla.innerHTML = depositos.map(d => `
    <tr>
      <td>${Number(d.id)}</td>
      <td>${escaparHtml(`${d.nombres} ${d.apellido_paterno} ${d.apellido_materno || ''}`)}</td>
      <td>${formatearMonto(d.monto)}</td>
      <td>${formatearFecha(d.fecha_deposito)}</td>
      <td>${d.concepto ? escaparHtml(d.concepto) : '—'}</td>
      <td>${d.pago_id
        ? '<span class="badge bg-success">Registrado</span>'
        : '<span class="badge bg-warning text-dark">Pendiente</span>'}</td>
      <td class="text-nowrap">
        <button type="button" class="btn btn-sm btn-outline-primary" title="Ver comprobante" aria-label="Ver comprobante"
          onclick="verComprobanteDeposito(${Number(d.id)})"><i class="bi bi-file-earmark-text"></i></button>
        ${d.pago_id ? '' : `<button type="button" class="btn btn-sm btn-success ms-1" onclick="registrarPagoDesdeDeposito(${Number(d.id)})">
          Registrar pago</button>`}
      </td>
    </tr>
  `).join('');
}

function configurarFiltrosDepositos() {
  ['buscar_depositos', 'filtro_deposito_estado'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change',
      () => renderizarTablaDepositos(filtrarDepositos(depositosCargados)));
  });
}

function aplicarFiltrosPagos() {
  renderizarTablaPagos(
    filtrarPagos(pagosCargados)
  );
}

function limpiarFiltrosPagos() {
  const buscar =
    document.getElementById('buscar_pagos');

  const metodo =
    document.getElementById('filtro_pago_metodo');

  const tipo =
    document.getElementById('filtro_pago_tipo');

  if (buscar) buscar.value = '';
  if (metodo) metodo.value = '';
  if (tipo) tipo.value = '';

  aplicarFiltrosPagos();
}

function configurarFiltrosPagos() {
  configurarAdjuntarComprobantePago();

  [
    'buscar_pagos',
    'filtro_pago_metodo',
    'filtro_pago_tipo'
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
      aplicarFiltrosPagos
    );
  });
}

function eliminarPago(id) {

  mostrarConfirmacion(
    'Esta acción eliminará el pago seleccionado. ¿Deseas continuar?',
    () => ejecutarEliminarPago(id)
  );

}

function ejecutarEliminarPago(id) {

  fetch(`${API_URL}/pagos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })

  .then(async res => {
    const data = await leerRespuestaJson(res);

    if (!res.ok) {
      throw new Error(
        data.mensaje || 'No se pudo eliminar el pago'
      );
    }

    return data;
  })

  .then(data => {
    mostrarAlerta(
      data.mensaje || 'Pago eliminado correctamente',
      'warning'
    );

    cargarTablaPagos();
    cargarTablaDepositos();
    cargarDashboard();
    cargarFinanzas();
  })

  .catch(err => {
    console.error(err);
    mostrarAlerta(
      obtenerMensajeError(
        err,
        'No se pudo eliminar el pago'
      ),
      'danger'
    );
  });

}
