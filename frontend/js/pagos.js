function crearPago() {
  const data = {
    persona_id:
      document.getElementById(
        'pago_persona_id'
      ).value,

    monto_total:
      document.getElementById(
        'pago_monto'
      ).value,

    metodo:
      document.getElementById(
        'pago_metodo'
      ).value
  };

  data.monto_total = Number(data.monto_total);

  const metodosPermitidos = [
    'efectivo',
    'transferencia',
    'debito'
  ];

  if (!data.persona_id) {
    mostrarAlerta(
      'Seleccione una persona',
      'warning'
    );

    return;
  }

  if (!Number.isFinite(data.monto_total) || data.monto_total <= 0) {
    mostrarAlerta(
      'El monto debe ser mayor a 0',
      'warning'
    );

    return;
  }

  if (!metodosPermitidos.includes(data.metodo)) {
    mostrarAlerta(
      'Seleccione un metodo de pago valido',
      'warning'
    );

    return;
  }

  let url = `${API_URL}/pagos`;
  let method = 'POST';

  if (pagoEditando) {
    url =
      `${API_URL}/pagos/${pagoEditando}`;

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
    mostrarAlerta(
      data.mensaje,
      'success'
    );

    pagoEditando = null;

    document.getElementById(
      'btn_guardar_pago'
    ).innerText =
      'Guardar Pago';

    document.getElementById(
      'pago_monto'
    ).value = '';

    document.getElementById(
      'pago_metodo'
    ).value =
      'efectivo';

    cargarTablaPagos();
    cargarMultas();
    cargarFinanzas();
    cargarDashboard();
    cargarGraficos();
  })

  .catch(err => {
    mostrarAlerta(
      err.message,
      'danger'
    );
  });
}