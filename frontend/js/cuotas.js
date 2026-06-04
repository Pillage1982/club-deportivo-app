// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

function generarCuotasMensuales() {

  const confirmar = confirm(
    '¿Deseas generar las cuotas mensuales para todos los socios activos?'
  );

  if (!confirmar) return;

  fetch(`${API_URL}/cuotas/generar`, {

    method: 'POST',

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    mostrarAlerta(
      `${data.mensaje}. Cuotas creadas: ${data.cuotas_creadas}`,
      'success'
    );

    cargarFinanzas();
    cargarDashboard();
    cargarGraficos();
    cargarCuotas();

  })

  .catch(err => {

    console.error(err);

    mostrarAlerta(
      'Error al generar cuotas',
      'danger'
    );

  });

}

// =====================================
// CARGAR TABLA CUOTAS
// =====================================

function cargarCuotas() {

  fetch(`${API_URL}/cuotas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_cuotas'
      );

    if (!tabla) return;

    tabla.innerHTML = '';

    data.forEach(cuota => {

      tabla.innerHTML += `

        <tr>

          <td>
            ${cuota.nombres}
            ${cuota.apellido_paterno}
            ${cuota.apellido_materno || ''}
          </td>

          <td>
            $${cuota.monto}
          </td>

          <td>
            ${cuota.mes}
          </td>

          <td>
            ${cuota.anio}
          </td>

          <td>
            ${cuota.fecha_vencimiento || ''}
          </td>

          <td>
            ${
              cuota.estado === 'pagado'
              ? '<span class="badge bg-success">Pagado</span>'
              : cuota.estado === 'vencido'
              ? '<span class="badge bg-danger">Vencido</span>'
              : '<span class="badge bg-warning text-dark">Pendiente</span>'
            }
          </td>

        </tr>

      `;

    });

  })

  .catch(err => console.error(err));

}