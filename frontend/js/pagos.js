// Interfaz de pagos: CRUD, filtros, selección de cuotas y actualización de módulos financieros relacionados.
let pagoEditando = null;
let pagosCargados = [];

// cargarFinanzas -> movida a finanzas.js

function normalizarTextoPago(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Tipos de pago: solo 'cuota' rebaja la deuda; el resto son pagos extra
// (trajes, chaquetas, otros) que entran a caja sin abonar cuotas.
const TIPOS_PAGO = {
  cuota: 'Cuota mensual',
  traje: 'Traje',
  chaqueta: 'Chaqueta institucional',
  otro: 'Otro'
};

function etiquetaTipoPago(pago) {
  const tipo = TIPOS_PAGO[pago.tipo_pago] || TIPOS_PAGO.cuota;
  return pago.detalle ? `${tipo} — ${pago.detalle}` : tipo;
}

// Con un pago extra no aplica vincular cuota ni pago anual: se ocultan.
function actualizarTipoPago() {
  const tipo = document.getElementById('pago_tipo')?.value || 'cuota';
  const esCuota = tipo === 'cuota';

  document.getElementById('pago_cuota_grupo')?.classList.toggle('d-none', !esCuota);
  document.getElementById('pago_anual_grupo')?.classList.toggle('d-none', !esCuota);

  if (!esCuota) {
    const selectCuota = document.getElementById('pago_cuota_id');
    if (selectCuota) selectCuota.value = '';
    const check = document.getElementById('pago_anual_check');
    if (check?.checked) {
      check.checked = false;
      actualizarModoPagoAnual();
    }
  }

  const ayuda = document.getElementById('pago_detalle_ayuda');
  if (ayuda) ayuda.textContent = tipo === 'otro' ? '(obligatorio)' : '(opcional)';
}

function editarPago(pago) {
  pagoEditando = pago.id;

  document.getElementById('pago_tipo').value = pago.tipo_pago || 'cuota';
  document.getElementById('pago_detalle').value = pago.detalle || '';
  actualizarTipoPago();

  document.getElementById('pago_persona_id').value =
    pago.persona_id || '';

  document.getElementById('pago_monto').value =
    pago.monto_total || '';

  document.getElementById('pago_metodo').value =
    pago.metodo || '';

  cargarDepositosPago(pago.persona_id);

  document.getElementById('btn_guardar_pago').innerText =
    'Actualizar Pago';

  irAFormulario('#subtab_form_pago');
}

const MESES = ['','Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function cargarCuotasPendientesPago(persona_id) {
  const select = document.getElementById('pago_cuota_id');
  if (!select) return;
  select.innerHTML = '<option value="">Sin vincular a cuota</option>';
  if (!persona_id) return;

  fetch(`${API_URL}/cuotas/pendientes/${persona_id}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(cuotas => {
      if (!Array.isArray(cuotas) || cuotas.length === 0) return;
      cuotas.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${MESES[c.mes]} ${c.anio} — saldo ${formatearMonto(c.saldo)} (${c.estado})`;
        select.appendChild(opt);
      });
    })
    .catch(() => {});
}

function configurarSelectorCuotaPago() {
  const sel = document.getElementById('pago_persona_id');
  if (!sel) return;
  sel.addEventListener('change', () => {
    cargarCuotasPendientesPago(sel.value);
    cargarDepositosPago(sel.value);
    if (document.getElementById('pago_anual_check')?.checked) cargarPagoAnual();
  });
}

// =====================================
// PAGO ANUAL (varias cuotas en un solo pago — art. 9.3)
// =====================================

let cuotasPendientesParaAnual = [];

function actualizarModoPagoAnual() {
  const activo       = Boolean(document.getElementById('pago_anual_check')?.checked);
  const selectCuota  = document.getElementById('pago_cuota_id');
  const inputMonto   = document.getElementById('pago_monto');

  if (selectCuota) selectCuota.disabled = activo;
  if (inputMonto)  inputMonto.readOnly  = activo;

  if (activo) {
    cargarPagoAnual();
  } else {
    cuotasPendientesParaAnual = [];
    if (inputMonto) inputMonto.value = '';
    const aviso = document.getElementById('pago_anual_aviso');
    if (aviso) aviso.textContent = '';
  }
}

function cargarPagoAnual() {
  const personaId = document.getElementById('pago_persona_id')?.value;
  const inputMonto = document.getElementById('pago_monto');
  const aviso = document.getElementById('pago_anual_aviso');

  cuotasPendientesParaAnual = [];
  if (inputMonto) inputMonto.value = '';
  if (aviso) aviso.textContent = '';
  if (!personaId) return;

  fetch(`${API_URL}/cuotas/pendientes/${personaId}`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(cuotas => {
      if (!Array.isArray(cuotas)) return;
      cuotasPendientesParaAnual = cuotas;
      const total = cuotas.reduce((suma, c) => suma + Number(c.saldo), 0);
      if (inputMonto) inputMonto.value = total;
      if (aviso) {
        aviso.textContent = cuotas.length >= 2
          ? `${cuotas.length} cuota(s) pendiente(s) por ${formatearMonto(total)}`
          : 'Este integrante no tiene al menos dos cuotas pendientes para un pago anual.';
      }
    })
    .catch(() => {});
}

function crearPago() {
  const esAnual    = Boolean(document.getElementById('pago_anual_check')?.checked);
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

  if (esAnual && tipoPago === 'cuota') {
    if (cuotasPendientesParaAnual.length < 2) {
      mostrarAlerta('Se necesitan al menos dos cuotas pendientes para un pago anual.', 'warning');
      return;
    }
    guardarPagoAnual(personaId, montoTotal, metodo);
    return;
  }

  // FormData para poder adjuntar el comprobante (opcional)
  const data = new FormData();
  data.append('persona_id', personaId);
  data.append('monto_total', montoTotal);
  data.append('metodo', metodo);
  data.append('tipo_pago', tipoPago);
  if (detalle) data.append('detalle', detalle);
  const cuotaId = tipoPago === 'cuota' ? document.getElementById('pago_cuota_id')?.value : '';
  if (cuotaId) data.append('cuota_id', cuotaId);
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

      document.getElementById('btn_guardar_pago').innerText = 'Guardar Pago';
      document.getElementById('pago_monto').value   = '';
      document.getElementById('pago_metodo').value  = 'efectivo';
      document.getElementById('pago_tipo').value    = 'cuota';
      document.getElementById('pago_detalle').value = '';
      document.getElementById('pago_comprobante').value = '';
      limpiarDepositosPago();
      actualizarTipoPago();
      const selectCuota = document.getElementById('pago_cuota_id');
      if (selectCuota) {
        selectCuota.innerHTML = '<option value="">Sin vincular a cuota</option>';
      }

      cargarTablaPagos();
      cargarTablaDepositos();
      cargarMultas();
      cargarFinanzas();
      cargarCuotas();
      cargarDashboard();
      cargarGraficos();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(err, 'No se pudo guardar el pago'),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(
        estadoBoton,
        pagoEditando ? 'Actualizar Pago' : 'Guardar Pago'
      );
    });
}

function guardarPagoAnual(personaId, montoTotal, metodo) {
  const data = new FormData();
  data.append('persona_id', personaId);
  data.append('monto_total', montoTotal);
  data.append('metodo', metodo);
  data.append('cuota_ids', JSON.stringify(cuotasPendientesParaAnual.map(c => c.id)));
  const archivo = document.getElementById('pago_comprobante')?.files[0];
  if (archivo) data.append('comprobante', archivo);
  const depositoId = document.getElementById('pago_deposito_id')?.value;
  if (!archivo && depositoId) data.append('comprobante_deposito_id', depositoId);

  const estadoBoton = bloquearBoton('btn_guardar_pago', 'Guardando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/pagos/anual`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: data
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(respuesta.mensaje || 'No se pudo guardar el pago anual');
      }
      return respuesta;
    })
    .then(data => {
      mostrarAlerta(data.mensaje, 'success');

      document.getElementById('pago_monto').value  = '';
      document.getElementById('pago_metodo').value = 'efectivo';
      document.getElementById('pago_detalle').value = '';
      document.getElementById('pago_comprobante').value = '';
      limpiarDepositosPago();
      const check = document.getElementById('pago_anual_check');
      if (check) {
        check.checked = false;
        actualizarModoPagoAnual();
      }
      cuotasPendientesParaAnual = [];

      cargarTablaPagos();
      cargarTablaDepositos();
      cargarMultas();
      cargarFinanzas();
      cargarCuotas();
      cargarDashboard();
      cargarGraficos();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(err, 'No se pudo guardar el pago anual'),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(estadoBoton, 'Guardar Pago');
    });
}

function cargarTablaPagos() {
  fetch(`${API_URL}/pagos`, {
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }

      pagosCargados = data;
      renderizarTablaPagos(filtrarPagos(data));
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

  tabla.innerHTML = pagos.map(pago => `
    <tr>
      <td>${pago.nombres} ${pago.apellido_paterno} ${pago.apellido_materno || ''}</td>
      <td>${escaparHtml(etiquetaTipoPago(pago))}</td>
      <td>${formatearMonto(pago.monto_total)}</td>
      <td>${pago.metodo}</td>
      <td>${pago.fecha_precision === 'mensual'
        ? new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(pago.fecha).substring(0, 10)}T00:00:00Z`))
        : formatearFecha(pago.fecha)}</td>
      <td class="text-nowrap">
        ${pago.comprobante_path
          ? `<button type="button" class="btn btn-sm btn-outline-primary me-1" title="Ver comprobante" aria-label="Ver comprobante"
               onclick="verComprobantePago(${Number(pago.id)})"><i class="bi bi-file-earmark-text"></i></button>`
          : `<button type="button" class="btn btn-sm btn-outline-secondary me-1" title="Adjuntar comprobante" aria-label="Adjuntar comprobante"
               onclick="elegirComprobantePago(${Number(pago.id)})"><i class="bi bi-paperclip"></i></button>`}
        ${pago.referencia_externa || Number(pago.tiene_detalle) ? '<span class="badge bg-secondary">Histórico vinculado</span>' : `
        <div class="btn-group btn-group-sm" role="group" aria-label="Acciones">
          <button type="button" class="btn btn-outline-warning" title="Editar" aria-label="Editar"
            onclick='editarPago(pagosCargados.find(p => p.id === ${Number(pago.id)}))'>&#9998;</button>
          <button type="button" class="btn btn-outline-danger" title="Eliminar" aria-label="Eliminar"
            onclick='eliminarPago(${pago.id})'>&times;</button>
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

// Descarga con el token y abre el archivo en otra pestaña (mismo patrón que Ingresos).
function abrirArchivoProtegido(url) {
  fetch(url, { headers: getAuthHeaders() })
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
  if (usaDeposito && monto && !monto.value && !monto.readOnly && opcion?.dataset.monto) {
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
  document.getElementById('pago_monto').value = deposito.monto;
  document.getElementById('pago_detalle').value = '';
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
  renderizarTablaPagos(filtrarPagos(pagosCargados));
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
    cargarDashboard();
    cargarFinanzas();
  })

  .catch(err => {
    console.error(err);
    mostrarAlerta(
      obtenerMensajeError(err, 'No se pudo eliminar el pago'),
      'danger'
    );
  });

}
