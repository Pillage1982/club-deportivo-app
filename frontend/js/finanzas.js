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
        <td>${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}</td>
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
