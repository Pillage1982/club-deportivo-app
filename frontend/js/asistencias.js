// =====================================
// REGISTRAR ASISTENCIA EVENTO
// =====================================

function registrarAsistencia() {

  const persona_id = document.getElementById('persona_id').value;
  const evento_id = document.getElementById('evento_id').value;
  const estado = document.getElementById('estado').value;
  let minutos =
  document.getElementById('minutos').value;

    // Solo se solicitan minutos
    // cuando el estado es atrasado
    if (estado !== 'atrasado') {

      minutos = 0;

    }

    // Datos enviados al backend
    const data = {
      persona_id,
      evento_id,
      estado,
      minutos
    };

    // =====================================
    // VALIDACIONES FRONTEND ASISTENCIA
    // =====================================

    if (!data.persona_id) {

      mostrarAlerta(
        'Seleccione un integrante',
        'warning'
      );

      return;

    }

    if (!data.evento_id) {

      mostrarAlerta(
        'Seleccione una actividad',
        'warning'
      );

      return;

    }

    if (!data.estado) {

      mostrarAlerta(
        'Seleccione un estado',
        'warning'
      );

      return;

    }

    // Validación exclusiva para atrasos
    if (data.estado === 'atrasado' &&

        (
          !data.minutos ||

          Number(data.minutos) < 0
        )

      ) {

        mostrarAlerta(

          'Ingrese minutos de atraso válidos',

          'warning'

        );

        return;

      }

      const estadoBoton =
        bloquearBoton(
          'btn_registrar_asistencia',
          'Registrando...'
        );

      if (!estadoBoton) return;

      // Registra asistencia en backend
      fetch(`${API_URL}/asistencia`, {

        method: 'POST',

        headers: getAuthHeaders(),

        body: JSON.stringify(data)

      })

      .then(async res => {
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : { mensaje: await res.text() };

  if (!res.ok) {
    throw new Error(
      data.mensaje || 'No se pudo registrar la asistencia'
    );
  }

  return data;
})
.then(response => {

document.getElementById('respuesta').innerText =
  response.mensaje || 'Asistencia registrada';

mostrarAlerta(
  response.mensaje || 'Asistencia registrada',
  'success'
);

      // Refresca automáticamente:
      // asistencias
      // multas
      // finanzas
      // dashboard
      // gráficos
      cargarAsistencias();
      cargarMultas();
      cargarFinanzas();
      cargarDashboard();
      cargarGraficos();

      document.getElementById('minutos').value = 0;

    })

    .catch(err => {

    console.error(err);

    // Evita registros duplicados
    // misma persona + mismo evento
    mostrarAlerta(
  err.message,
  'danger'
);

})
  .finally(() => {
    restaurarBoton(
      estadoBoton,
      'Registrar'
    );
  });

}

// =====================================
// CARGAR HISTORIAL ASISTENCIAS
// =====================================

function cargarAsistencias() {

  fetch(`${API_URL}/asistencia`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_asistencias');

      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar la tabla de asistencias',
    'warning'
  );
  return;
}

      data.forEach(asistencia => {

        // Estado visual asistencia
        tabla.innerHTML += `
          <tr>
            <td>${asistencia.nombres} ${asistencia.apellido_paterno} ${asistencia.apellido_materno || ''}</td>
            <td>${asistencia.evento}</td>
            <td>${obtenerBadgeAsistencia(asistencia.estado)}</td>
            <td>${asistencia.minutos_atraso}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}

// =====================================
// CARGAR MULTAS AUTOMATICAS
// =====================================

function cargarMultas() {

  fetch(`${API_URL}/multas`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_multas');

      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar la tabla de multas',
    'warning'
  );
  return;
}

      data.forEach(multa => {

        // Multas generadas automáticamente
        // desde registro de asistencia
        tabla.innerHTML += `

          <tr>
            <td>${multa.nombres} ${multa.apellido_paterno} ${multa.apellido_materno || ''}</td>
            <td>${formatearMonto(multa.monto)}</td>
            <td>${multa.motivo}</td>
            <td>${formatearFecha(multa.fecha)}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}
