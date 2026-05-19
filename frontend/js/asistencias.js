// ==============================
// REGISTRAR ASISTENCIA
// ==============================

function registrarAsistencia() {

  const persona_id = document.getElementById('persona_id').value;
  const evento_id = document.getElementById('evento_id').value;
  const estado = document.getElementById('estado').value;
  let minutos =
  document.getElementById('minutos').value;

    // =========================
    // SI NO ES ATRASO
    // =========================

    if (estado !== 'atrasado') {

      minutos = 0;

    }

  const data = {
    persona_id,
    evento_id,
    estado,
    minutos
  };

  // =========================
// VALIDACIONES
// =========================

if (!data.persona_id) {

  mostrarAlerta(
    'Seleccione una persona',
    'warning'
  );

  return;

}

if (!data.evento_id) {

  mostrarAlerta(
    'Seleccione un evento',
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

// =========================
// VALIDAR ATRASO
// =========================

if (

  data.estado === 'atrasado' &&

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

fetch(`${API_URL}/asistencia`, {

  method: 'POST',

  headers: getAuthHeaders(),

  body: JSON.stringify(data)

})
    .then(res => res.text())
    .then(response => {

      document.getElementById('respuesta').innerText = response;

      cargarAsistencias();
      cargarMultas();
      cargarFinanzas();
      cargarDashboard();
      cargarGraficos();

    })
    .catch(err => {

  console.error(err);

  mostrarAlerta(

    'No se puede registrar asistencia duplicada',

    'danger'

  );

});

}

// ==============================
// CARGAR TABLA DE ASISTENCIA
// ==============================

function cargarAsistencias() {

  fetch(`${API_URL}/asistencia`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_asistencias');

      tabla.innerHTML = '';

      data.forEach(asistencia => {

        tabla.innerHTML += `
          <tr>
            <td>${asistencia.nombres} ${asistencia.apellido_paterno} ${asistencia.apellido_materno || ''}</td>
            <td>${asistencia.evento}</td>
            <td>${
              asistencia.estado === 'presente'
              ? '<span class="badge bg-success">Presente</span>'
              : asistencia.estado === 'atrasado'
              ? '<span class="badge bg-warning text-dark">Atrasado</span>'
              : '<span class="badge bg-danger">Ausente</span>'
            }</td>
            <td>${asistencia.minutos_atraso}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}

// ==============================
// CARGAR TABLA DE MULTAS
// ==============================

function cargarMultas() {

  fetch(`${API_URL}/multas`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_multas');

      tabla.innerHTML = '';

      data.forEach(multa => {

        tabla.innerHTML += `
          <tr>
            <td>${multa.nombres} ${multa.apellido_paterno} ${multa.apellido_materno || ''}</td>
            <td>$${multa.monto}</td>
            <td>${multa.motivo}</td>
            <td>${multa.fecha}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}