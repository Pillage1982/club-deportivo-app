// =====================================
// CARGAR ESTADO FINANCIERO
// =====================================

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
            <td>${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}</td>
            <td>$${finanza.total_multas || 0}</td>
            <td>$${finanza.total_cuotas || 0}</td>
            <td>$${finanza.total_pagado || 0}</td>
            <td>
              ${
                Number(finanza.deuda_actual) === 0
                  ? `<span class="badge bg-success">AL DIA</span>`
                  : Number(finanza.deuda_actual) < 0
                    ? `<span class="badge bg-primary">$${Math.abs(finanza.deuda_actual)} (A FAVOR)</span>`
                    : `<span class="badge bg-danger">Deuda: $${finanza.deuda_actual}</span>`
              }
            </td>
          </tr>
        `;
      });

    })
    .catch(err => console.error(err));
}