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

function editarPago(pago) {
  pagoEditando = pago.id;

  document.getElementById('pago_persona_id').value =
    pago.persona_id || '';

  document.getElementById('pago_monto').value =
    pago.monto_total || '';

  document.getElementById('pago_metodo').value =
    pago.metodo || '';

  document.getElementById('btn_guardar_pago').innerText =
    'Actualizar Pago';
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

  if (esAnual) {
    if (cuotasPendientesParaAnual.length < 2) {
      mostrarAlerta('Se necesitan al menos dos cuotas pendientes para un pago anual.', 'warning');
      return;
    }
    guardarPagoAnual(personaId, montoTotal, metodo);
    return;
  }

  const data = {
    persona_id: personaId,
    monto_total: montoTotal,
    metodo,
    cuota_id: document.getElementById('pago_cuota_id')?.value || null
  };

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
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
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
      const selectCuota = document.getElementById('pago_cuota_id');
      if (selectCuota) {
        selectCuota.innerHTML = '<option value="">Sin vincular a cuota</option>';
      }

      cargarTablaPagos();
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
  const data = {
    persona_id: personaId,
    monto_total: montoTotal,
    metodo,
    cuota_ids: cuotasPendientesParaAnual.map(c => c.id)
  };

  const estadoBoton = bloquearBoton('btn_guardar_pago', 'Guardando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/pagos/anual`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
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
      const check = document.getElementById('pago_anual_check');
      if (check) {
        check.checked = false;
        actualizarModoPagoAnual();
      }
      cuotasPendientesParaAnual = [];

      cargarTablaPagos();
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

    return coincideBusqueda && coincideMetodo;
  });
}

function renderizarTablaPagos(pagos) {
  const tabla = document.getElementById('tabla_pagos');

  tabla.innerHTML = '';

  if (!pagos.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          No hay pagos para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = pagos.map(pago => `
    <tr>
      <td>${pago.nombres} ${pago.apellido_paterno} ${pago.apellido_materno || ''}</td>
      <td>${formatearMonto(pago.monto_total)}</td>
      <td>${pago.metodo}</td>
      <td>${pago.fecha_precision === 'mensual'
        ? new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(pago.fecha).substring(0, 10)}T00:00:00Z`))
        : formatearFecha(pago.fecha)}</td>
      <td class="text-nowrap">
        ${pago.referencia_externa || Number(pago.tiene_detalle) ? '<span class="badge bg-secondary">Histórico vinculado</span>' : `
        <div class="btn-group btn-group-sm" role="group" aria-label="Acciones">
          <button type="button" class="btn btn-outline-warning" title="Editar" aria-label="Editar"
            onclick='editarPago(${JSON.stringify(pago)})'>&#9998;</button>
          <button type="button" class="btn btn-outline-danger" title="Eliminar" aria-label="Eliminar"
            onclick='eliminarPago(${pago.id})'>&times;</button>
        </div>`}
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosPagos() {
  renderizarTablaPagos(filtrarPagos(pagosCargados));
}

function limpiarFiltrosPagos() {
  const buscar =
    document.getElementById('buscar_pagos');

  const metodo =
    document.getElementById('filtro_pago_metodo');

  if (buscar) buscar.value = '';
  if (metodo) metodo.value = '';

  aplicarFiltrosPagos();
}

function configurarFiltrosPagos() {
  [
    'buscar_pagos',
    'filtro_pago_metodo'
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
