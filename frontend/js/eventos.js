// =====================================
// VARIABLES GLOBALES EVENTOS
// =====================================

let eventoEditando = null;

// =====================================
// CARGAR EVENTOS EN SELECTOR
// =====================================

function cargarEventos() {

  fetch(`${API_URL}/eventos`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      // Selector utilizado en asistencias
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

// =====================================
// CREAR / ACTUALIZAR EVENTOS
// =====================================

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

  // =====================================
  // VALIDACIONES FRONTEND EVENTOS
  // =====================================

if (!data.nombre.trim()) {

  mostrarAlerta(
    'Ingrese el nombre del evento',
    'warning'
  );

  return;

}

if (!data.tipo) {

  mostrarAlerta(
    'Seleccione el tipo de evento',
    'warning'
  );

  return;

}

if (!data.fecha) {

  mostrarAlerta(
    'Seleccione una fecha',
    'warning'
  );

  return;

}

if (!data.ubicacion.trim()) {

  mostrarAlerta(
    'Ingrese una ubicación',
    'warning'
  );

  return;

}

  let url = `${API_URL}/eventos`;

  let method = 'POST';

  // Si existe eventoEditando,
  // se actualiza evento existente
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

    mostrarAlerta(data.mensaje,'success');

    eventoEditando = null;

    document.getElementById(
      'btn_guardar_evento'
    ).innerText = 'Guardar Evento';

    // Limpia formulario después guardar
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

// Refresca tabla y selector eventos
    cargarTablaEventos();

    cargarEventos();

  })

  .catch(err => console.error(err));

}

// =====================================
// CARGAR TABLA EVENTOS
// =====================================

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

      // Acciones CRUD eventos
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
            ${evento.descripcion || ''}
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

// =====================================
// EDITAR EVENTOS
// =====================================

function editarEvento(evento) {

  // Activa modo edición evento
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

// =====================================
// ELIMINAR EVENTOS
// =====================================

function eliminarEvento(id) {

  // Solicita confirmación antes eliminar
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

    mostrarAlerta(data.mensaje,'warning');

    // Refresca tabla y selector eventos
    cargarTablaEventos();

    cargarEventos();

  })

  .catch(err => console.error(err));

}