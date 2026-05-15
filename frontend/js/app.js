let pagoEditando = null;
let chartMultas = null;
let chartDeuda = null;
let eventoEditando = null;
let personaEditando = null;
const API_URL = 'http://localhost:3000';


// ==============================
// CARGAR DATOS AL INICIAR
// ==============================

window.onload = () => {

  const token = localStorage.getItem('token');

  if (!token) {

    window.location.href = 'login.html';

    return;

  }

  cargarPersonas();
  cargarEventos();
  cargarAsistencias();
  cargarMultas();
  cargarFinanzas();
  cargarDashboard();
  cargarGraficos();
  mostrarUsuario();
  aplicarRolesFrontend();
  cargarTablaPersonas();
  cargarTablaEventos();
  cargarTablaPagos();

};

function getAuthHeaders() {

  return {

    'Content-Type': 'application/json',

    Authorization:
      `Bearer ${localStorage.getItem('token')}`

  };

}

// ==============================
// CARGAR PERSONAS
// ==============================

function cargarPersonas() {

  fetch(`${API_URL}/personas`, {

   headers: getAuthHeaders()

  })
    
    .then(res => res.json())
    .then(data => {

      const select = document.getElementById('persona_id');
      const selectPago = document.getElementById('pago_persona_id');

      select.innerHTML = '';

      selectPago.innerHTML = '';

      data.forEach(persona => {

        const option = document.createElement('option');

        option.value = persona.id;
        option.textContent = `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`;

        select.appendChild(option);
        const optionPago = option.cloneNode(true); selectPago.appendChild(optionPago);

      });

    })
    .catch(err => console.error(err));

}


// ==============================
// CARGAR EVENTOS
// ==============================

function cargarEventos() {

  fetch(`${API_URL}/eventos`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const select = document.getElementById('evento_id');

      select.innerHTML = '';

      data.forEach(evento => {

        const option = document.createElement('option');

        option.value = evento.id;
        option.textContent = evento.nombre;

        select.appendChild(option);

      });

    })
    .catch(err => console.error(err));

}


// ==============================
// REGISTRAR ASISTENCIA
// ==============================

function registrarAsistencia() {

  const persona_id = document.getElementById('persona_id').value;
  const evento_id = document.getElementById('evento_id').value;
  const estado = document.getElementById('estado').value;
  const minutos = document.getElementById('minutos').value;

  const data = {
    persona_id,
    evento_id,
    estado,
    minutos
  };

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

    })
    .catch(err => {

      console.error(err);

      document.getElementById('respuesta').innerText =
        'Error al registrar';

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

// ==============================
// CARGAR TABLA DE FINANZAS
// ==============================

function cargarFinanzas() {

  fetch(`${API_URL}/finanzas`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla =
        document.getElementById('tabla_finanzas');

      tabla.innerHTML = '';

      data.forEach(finanza => {

        tabla.innerHTML += `
          <tr>
            <td>${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}</td>
            <td>$${finanza.total_multas}</td>
            <td>$${finanza.total_pagado}</td>
            <td>$${finanza.deuda_actual}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}

// ==============================
// LOGOUT -- CERRAR SESION
// ==============================

function logout() {

  localStorage.removeItem('token');

  localStorage.removeItem('usuario');

  window.location.href = 'login.html';

}

// ==============================
// FUNCION DASHBOARD
// ==============================

function cargarDashboard() {

  Promise.all([

    fetch(`${API_URL}/personas`, {
      headers: getAuthHeaders()
    }).then(res => res.json()),

    fetch(`${API_URL}/multas`, {
      headers: getAuthHeaders()
    }).then(res => res.json()),

    fetch(`${API_URL}/finanzas`, {
      headers: getAuthHeaders()
    }).then(res => res.json())

  ])

  .then(([personas, multas, finanzas]) => {

    document.getElementById(
      'total_personas'
    ).innerText = personas.length;

    document.getElementById(
      'total_multas'
    ).innerText = multas.length;

    let totalPagado = 0;
    let deudaTotal = 0;

    finanzas.forEach(f => {

      totalPagado +=
        Number(f.total_pagado);

      deudaTotal +=
        Number(f.deuda_actual);

    });

    document.getElementById(
      'total_pagado'
    ).innerText =
      `$${totalPagado}`;

    document.getElementById(
      'deuda_total'
    ).innerText =
      `$${deudaTotal}`;

  })

  .catch(err => console.error(err));

}

// =========================
// FUNCION GRAFICOS
// =========================

function cargarGraficos() {

  fetch(`${API_URL}/finanzas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const nombres = data.map(
      f => `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ''}`
    );

    const multas = data.map(
      f => Number(f.total_multas)
    );

    const deuda = data.map(
      f => Number(f.deuda_actual)
    );

    // =========================
    // GRÁFICO MULTAS
    // =========================

if (chartMultas) {

  chartMultas.destroy();

}

if (chartDeuda) {

  chartDeuda.destroy();

}

    chartMultas = new Chart(

      document.getElementById(
        'graficoMultas'
      ),

      {

        type: 'bar',

        data: {

          labels: nombres,

          datasets: [{

            label: 'Multas',

            data: multas

          }]

        }

      }

    );

    // =========================
    // GRÁFICO DEUDA
    // =========================

    chartDeuda = new Chart(

      document.getElementById(
        'graficoDeuda'
      ),

      {

        type: 'pie',

        data: {

          labels: nombres,

          datasets: [{

            label: 'Deuda',

            data: deuda

          }]

        }

      }

    );

  })

  .catch(err => console.error(err));

}

// =========================
// MOSTRAR USUARIO
// =========================

function mostrarUsuario() {

  const usuario =
    JSON.parse(
      localStorage.getItem('usuario')
    );

  if (usuario) {

    document.getElementById(
      'usuario_logeado'
    ).innerText =
      `${usuario.usuario} (${usuario.rol})`;

  }

}

// =========================
// FUNCION ROLES
// =========================

function aplicarRolesFrontend() {

  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  // =========================
  // ENTRENADOR
  // =========================

  if (usuario.rol === 'entrenador') {

    document.getElementById(
      'modulo_multas'
    ).style.display = 'none';

    document.getElementById(
      'modulo_finanzas'
    ).style.display = 'none';

  }

  // =========================
  // TESORERO
  // =========================

  if (usuario.rol === 'tesorero') {

    document.getElementById(
      'modulo_asistencia'
    ).style.display = 'none';

  }

}

  // =========================
  // MODIFICAR SQL DESDE WEB
  // =========================

  function crearPersona() {

  const data = {

    rut:
      document.getElementById('rut').value,

    nombres:
      document.getElementById('nombres').value,

    apellido_paterno:
      document.getElementById(
        'apellido_paterno'
      ).value,

    apellido_materno:
      document.getElementById(
        'apellido_materno'
      ).value,

    email:
      document.getElementById('email').value,

    telefono:
      document.getElementById(
        'telefono'
      ).value

  };

  let url = `${API_URL}/personas`;

  let method = 'POST';

  if (personaEditando) {

    url =
      `${API_URL}/personas/${personaEditando}`;

    method = 'PUT';

  }

  fetch(url, {

    method: method,

    headers: getAuthHeaders(),

    body: JSON.stringify(data)

  })

  .then(res => res.json())

  .then(data => {

   document.getElementById(
      'respuesta_persona'
    ).innerText = data.mensaje;

    personaEditando = null;

    document.getElementById(
      'btn_guardar_persona'
    ).innerText = 'Guardar Persona';

    document.getElementById('rut').value = '';

document.getElementById(
  'nombres'
).value = '';

document.getElementById(
  'apellido_paterno'
).value = '';

document.getElementById(
  'apellido_materno'
).value = '';

document.getElementById(
  'email'
).value = '';

document.getElementById(
  'telefono'
).value = '';

    cargarPersonas();

    cargarTablaPersonas();

  })

  .catch(err => console.error(err));

}

  // =============================
  // FUNCION CARGAR TABLA PERSONAS
  // =============================

  function cargarTablaPersonas() {

  fetch(`${API_URL}/personas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_personas'
      );

    tabla.innerHTML = '';

    data.forEach(persona => {

      tabla.innerHTML += `

        <tr>

          <td>

            ${persona.nombres}
            ${persona.apellido_paterno}
            ${persona.apellido_materno || ''}

          </td>

          <td>
            ${persona.rut || ''}
          </td>

          <td>
            ${persona.email || ''}
          </td>

          <td>
            ${persona.telefono || ''}
          </td>

          <td>

            <button
              class="btn btn-warning btn-sm"
              onclick='editarPersona(${JSON.stringify(persona)}
            )'>

              Editar

            </button>

            <button
              class="btn btn-danger btn-sm"
              onclick='eliminarPersona(${persona.id}
            )'>

              Eliminar

            </button>

          </td>

        </tr>

      `;

    });

  })

  .catch(err => console.error(err));

}

// =============================
// FUNCION EDITAR PERSONAS
// =============================

function editarPersona(persona) {

  personaEditando = persona.id;

  document.getElementById('rut').value =
    persona.rut || '';

  document.getElementById('nombres').value =
    persona.nombres || '';

  document.getElementById(
    'apellido_paterno'
  ).value =
    persona.apellido_paterno || '';

  document.getElementById(
    'apellido_materno'
  ).value =
    persona.apellido_materno || '';

  document.getElementById('email').value =
    persona.email || '';

  document.getElementById('telefono').value =
    persona.telefono || '';

  document.getElementById(
    'btn_guardar_persona'
  ).innerText = 'Actualizar Persona';

}

// =============================
// FUNCION ELIMINAR PERSONAS
// =============================

function eliminarPersona(id) {

  const confirmar = confirm(
    '¿Eliminar persona?'
  );

  if (!confirmar) return;

  fetch(

    `${API_URL}/personas/${id}`,

    {

      method: 'DELETE',

      headers: getAuthHeaders()

    }

  )

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    cargarTablaPersonas();

    cargarPersonas();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN CREAR EVENTO
// ==============================

function crearEvento() {

  const data = {

    nombre:
      document.getElementById(
        'evento_nombre'
      ).value,

    tipo:
      document.getElementById(
        'evento_tipo'
      ).value,

    fecha:
      document.getElementById(
        'evento_fecha'
      ).value,

    ubicacion:
      document.getElementById(
        'evento_ubicacion'
      ).value,

    descripcion:
      document.getElementById(
        'evento_descripcion'
      ).value

  };

  let url = `${API_URL}/eventos`;

  let method = 'POST';

  if (eventoEditando) {

    url =
      `${API_URL}/eventos/${eventoEditando}`;

    method = 'PUT';

  }

  fetch(url, {

    method: method,

    headers: getAuthHeaders(),

    body: JSON.stringify(data)

  })

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    eventoEditando = null;

    document.getElementById(
      'btn_guardar_evento'
    ).innerText = 'Guardar Evento';

    document.getElementById(
  'evento_nombre'
).value = '';

document.getElementById(
  'evento_tipo'
).value =
  'entrenamiento';

document.getElementById(
  'evento_fecha'
).value = '';

document.getElementById(
  'evento_ubicacion'
).value = '';

document.getElementById(
  'evento_descripcion'
).value = '';

    cargarTablaEventos();

    cargarEventos();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN TABLA EVENTOS
// ==============================

function cargarTablaEventos() {

  fetch(`${API_URL}/eventos`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_eventos'
      );

    tabla.innerHTML = '';

    data.forEach(evento => {

      tabla.innerHTML += `

        <tr>

          <td>
            ${evento.nombre}
          </td>

          <td>
            ${evento.tipo}
          </td>

          <td>
            ${evento.fecha}
          </td>

          <td>
            ${evento.ubicacion || ''}
          </td>

          <td>

            <button

              class="btn btn-warning btn-sm"

              onclick='editarEvento(
                ${JSON.stringify(evento)}
              )'>

              Editar

            </button>

            <button

              class="btn btn-danger btn-sm"

              onclick='eliminarEvento(
                ${evento.id}
              )'>

              Eliminar

            </button>

          </td>


        </tr>

      `;

    });

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN EDITAR EVENTO
// ==============================

function editarEvento(evento) {

  eventoEditando = evento.id;

  document.getElementById(
    'evento_nombre'
  ).value =
    evento.nombre || '';

  document.getElementById(
    'evento_tipo'
  ).value =
    evento.tipo || '';

  document.getElementById(
    'evento_fecha'
  ).value =
    evento.fecha || '';

  document.getElementById(
    'evento_ubicacion'
  ).value =
    evento.ubicacion || '';

  document.getElementById(
    'evento_descripcion'
  ).value =
    evento.descripcion || '';

  document.getElementById(
    'btn_guardar_evento'
  ).innerText =
    'Actualizar Evento';

}

// ==============================
// FUNCIÓN ELIMINAR EVENTOS
// ==============================

function eliminarEvento(id) {

  const confirmar = confirm(
    '¿Eliminar evento?'
  );

  if (!confirmar) return;

  fetch(

    `${API_URL}/eventos/${id}`,

    {

      method: 'DELETE',

      headers: getAuthHeaders()

    }

  )

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    cargarTablaEventos();

    cargarEventos();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN EDITAR PAGOS
// ==============================

function editarPago(pago) {

  pagoEditando = pago.id;

  document.getElementById(
    'pago_persona_id'
  ).value =
    pago.persona_id || '';

  document.getElementById(
    'pago_monto'
  ).value =
    pago.monto_total || '';

  document.getElementById(
    'pago_metodo'
  ).value =
    pago.metodo || '';

  document.getElementById(
    'btn_guardar_pago'
  ).innerText =
    'Actualizar Pago';

}

// ==============================
// FUNCIÓN CREAR PAGOS
// ==============================

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

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

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

    cargarFinanzas();

    cargarDashboard();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN TABLA PAGOS
// ==============================

function cargarTablaPagos() {

  fetch(`${API_URL}/pagos`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_pagos'
      );

    tabla.innerHTML = '';

    data.forEach(pago => {

      tabla.innerHTML += `

        <tr>

          <td>

            ${pago.nombres}
            ${pago.apellido_paterno}
            ${pago.apellido_materno || ''}

          </td>

          <td>

            $${pago.monto_total}

          </td>

          <td>

            ${pago.metodo}

          </td>

          <td>

            ${pago.fecha}

          </td>

          <td>

            <button

              class="btn btn-warning btn-sm"

              onclick='editarPago(
                ${JSON.stringify(pago)}
              )'>

              Editar

            </button>

            <button

              class="btn btn-danger btn-sm"

              onclick='eliminarPago(
                ${pago.id}
              )'>

              Eliminar

            </button>

          </td>

        </tr>

      `;

    });

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN ELIMINAR PAGOS
// ==============================

function eliminarPago(id) {

  const confirmar = confirm(
    '¿Eliminar pago?'
  );

  if (!confirmar) return;

  fetch(

    `${API_URL}/pagos/${id}`,

    {

      method: 'DELETE',

      headers: getAuthHeaders()

    }

  )

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    cargarTablaPagos();

    cargarDashboard();

    cargarFinanzas();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN CREAR PAGOS
// ==============================

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

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    pagoEditando = null;

    document.getElementById(
      'btn_guardar_pago'
    ).innerText =
      'Guardar Pago';

    cargarTablaPagos();

    cargarDashboard();

    cargarFinanzas();

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN TABLA PAGOS
// ==============================

function cargarTablaPagos() {

  fetch(`${API_URL}/pagos`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_pagos'
      );

    tabla.innerHTML = '';

    data.forEach(pago => {

      tabla.innerHTML += `

        <tr>

          <td>

            ${pago.nombres}
            ${pago.apellido_paterno}
            ${pago.apellido_materno || ''}

          </td>

          <td>

            $${pago.monto_total}

          </td>

          <td>

            ${pago.metodo}

          </td>

          <td>

            ${pago.fecha}

          </td>

          <td>

            <button

              class="btn btn-warning btn-sm"

              onclick='editarPago(
                ${JSON.stringify(pago)}
              )'>

              Editar

            </button>

            <button

              class="btn btn-danger btn-sm"

              onclick='eliminarPago(
                ${pago.id}
              )'>

              Eliminar

            </button>

          </td>

        </tr>

      `;

    });

  })

  .catch(err => console.error(err));

}

// ==============================
// FUNCIÓN ELIMINAR PAGOS
// ==============================

function eliminarPago(id) {

  const confirmar = confirm(
    '¿Eliminar pago?'
  );

  if (!confirmar) return;

  fetch(

    `${API_URL}/pagos/${id}`,

    {

      method: 'DELETE',

      headers: getAuthHeaders()

    }

  )

  .then(res => res.json())

  .then(data => {

    alert(data.mensaje);

    cargarTablaPagos();

    cargarDashboard();

    cargarFinanzas();

  })

  .catch(err => console.error(err));

}