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
  sel.addEventListener('change', () => cargarCuotasPendientesPago(sel.value));
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
        <td colspan="5" class="text-center text-muted">
          No hay integrantes para los filtros seleccionados
        </td>
      </tr>
    `;

    return;
  }

  finanzas.forEach(finanza => {
    tabla.innerHTML += `
      <tr>
        <td>
          ${finanza.nombres}
          ${finanza.apellido_paterno}
          ${finanza.apellido_materno || ''}
        </td>
        <td>${formatearMonto(finanza.total_multas)}</td>
        <td>${formatearMonto(finanza.total_cuotas)}</td>
        <td>${formatearMonto(finanza.total_pagado)}</td>
        <td>
          ${obtenerBadgeFinanciero(finanza.deuda_actual)}
        </td>
      </tr>
    `;
  });
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

      cargarTablaPagos();
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

function elegirComprobantePago(id) {
  pagoComprobantePendiente = id;
  const input = document.getElementById('pago_comprobante_adjuntar');
  if (!input) return;
  input.value = '';
  input.click();
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
