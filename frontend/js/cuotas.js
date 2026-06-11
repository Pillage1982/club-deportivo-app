// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

function generarCuotasMensuales() {

  const confirmar = confirm(
    '¿Deseas generar las cuotas mensuales para todos los socios activos?'
  );

  if (!confirmar) return;

  fetch(`${API_URL}/cuotas/generar-mes`, {

    method: 'POST',

    headers: getAuthHeaders()

  })

  .then(async res => {
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.mensaje || 'Error al generar cuotas');
  }

  return data;
})

.then(data => {
  const tipoAlerta =
    data.cuotas_creadas > 0 ? 'success' : 'warning';

  mostrarAlerta(
    `${data.mensaje}. Cuotas creadas: ${data.cuotas_creadas || 0}`,
    tipoAlerta
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
            ${formatearFecha(cuota.fecha_vencimiento)}
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