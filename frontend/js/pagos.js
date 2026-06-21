let pagoEditando = null;
let pagosCargados = [];

function normalizarTextoPago(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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

      data.forEach(finanza => {
        tabla.innerHTML += `
          <tr>
            <td>
              ${finanza.nombres}
              ${finanza.apellido_paterno}
              ${finanza.apellido_materno || ''}
            </td>
            <td>$${finanza.total_multas || 0}</td>
            <td>$${finanza.total_cuotas || 0}</td>
            <td>$${finanza.total_pagado || 0}</td>
            <td>
              ${
                Number(finanza.deuda_actual) === 0
                  ? `<span class="badge bg-success">AL DIA</span>`
                  : Number(finanza.deuda_actual) < 0
                    ? `<span class="badge bg-primary">
                        $${Math.abs(finanza.deuda_actual)} (A FAVOR)
                      </span>`
                    : `<span class="badge bg-danger">
                        Deuda: $${finanza.deuda_actual}
                      </span>`
              }
            </td>
          </tr>
        `;
      });
    })
    .catch(err => console.error(err));
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

function crearPago() {
  const data = {
    persona_id: document.getElementById('pago_persona_id').value,
    monto_total: document.getElementById('pago_monto').value,
    metodo: document.getElementById('pago_metodo').value
  };

  data.monto_total = Number(data.monto_total);

  const metodosPermitidos = [
    'efectivo',
    'transferencia',
    'debito'
  ];

  if (!data.persona_id) {
    mostrarAlerta('Seleccione un integrante', 'warning');
    return;
  }

  if (!Number.isFinite(data.monto_total) || data.monto_total <= 0) {
    mostrarAlerta('El monto debe ser mayor a 0', 'warning');
    return;
  }

  if (!metodosPermitidos.includes(data.metodo)) {
    mostrarAlerta('Seleccione un metodo de pago valido', 'warning');
    return;
  }

  let url = `${API_URL}/pagos`;
  let method = 'POST';

  if (pagoEditando) {
    url = `${API_URL}/pagos/${pagoEditando}`;
    method = 'PUT';
  }

  fetch(url, {
    method: method,
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  })
    .then(async res => {
      const respuesta = await res.json();

      if (!res.ok) {
        throw new Error(
          respuesta.mensaje || 'Error al guardar pago'
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

      cargarTablaPagos();
      cargarMultas();
      cargarFinanzas();
      cargarDashboard();
      cargarGraficos();
    })
    .catch(err => {
      mostrarAlerta(err.message, 'danger');
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

  pagos.forEach(pago => {
    tabla.innerHTML += `
      <tr>
        <td>
          ${pago.nombres}
          ${pago.apellido_paterno}
          ${pago.apellido_materno || ''}
        </td>
        <td>$${pago.monto_total}</td>
        <td>${pago.metodo}</td>
        <td>${formatearFecha(pago.fecha)}</td>
        <td>
          <button
            class="btn btn-warning btn-sm"
            onclick='editarPago(${JSON.stringify(pago)})'>
            Editar
          </button>

          <button
            class="btn btn-danger btn-sm"
            onclick='eliminarPago(${pago.id})'>
            Eliminar
          </button>
        </td>
      </tr>
    `;
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

  .then(res => res.json())

  .then(data => {
    mostrarAlerta(data.mensaje, 'warning');

    cargarTablaPagos();
    cargarDashboard();
    cargarFinanzas();
  })

  .catch(err => console.error(err));

}
