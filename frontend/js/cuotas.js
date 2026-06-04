// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

function generarCuotasMensuales() {

  const confirmar =
    confirm(
      '¿Deseas generar las cuotas mensuales para todos los socios activos?'
    );

  if (!confirmar) {

    return;

  }

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

  })

  .catch(err => {

    console.error(err);

    mostrarAlerta(
      'Error al generar cuotas',
      'danger'
    );

  });

}