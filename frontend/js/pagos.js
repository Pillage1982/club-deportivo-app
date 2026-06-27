let pagoEditando = null;

// cargarFinanzas -> movida a finanzas.js

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

      data.forEach(pago => {
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
    })
    .catch(err => console.error(err));
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