// =====================================
// VARIABLES GLOBALES EVENTOS
// =====================================

let eventoEditando = null;

function obtenerTipoActividad(tipo) {

  const config =
    window.APP_CONFIG || {};

  const tipos =
    config.tiposActividad || {
      entrenamiento: 'Actividad',
      partido: 'Encuentro',
      reunion: 'Reunion'
    };

  return tipos[tipo] || tipo;

}

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

      if (!Array.isArray(data)) {
        mostrarAlerta(
        data.mensaje || 'No se pudieron cargar las actividades',
        'warning'
        );
        return;
      }

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

  data.nombre = data.nombre.trim();
  data.ubicacion = data.ubicacion.trim();
  data.descripcion = data.descripcion.trim();

  const tiposPermitidos = [
    'entrenamiento',
    'partido',
    'reunion'
  ];

  const textoValido = valor => {
    return (
      valor.length >= 3 &&
      /[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(valor) &&
      /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s.,#°-]+$/.test(valor)
    );
  };

  if (!textoValido(data.nombre)) {
    mostrarAlerta('Ingrese un nombre de actividad valido', 'warning');
    return;
  }

  if (!tiposPermitidos.includes(data.tipo)) {
    mostrarAlerta('Seleccione un tipo de actividad valido', 'warning');
    return;
  }

  if (!data.fecha) {
    mostrarAlerta('Seleccione una fecha válida', 'warning');
    return;
  }

  if (!textoValido(data.ubicacion)) {
    mostrarAlerta('Ingrese una ubicacion válida', 'warning');
    return;
  }

  if (data.descripcion && !textoValido(data.descripcion)) {
    mostrarAlerta('Ingrese una descripcion válida', 'warning');
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

    .then(async res => {
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.mensaje || 'Error al guardar actividad');
    }

    return data;
  })

  .then(data => {

    mostrarAlerta(data.mensaje,'success');

    eventoEditando = null;

    document.getElementById(
      'btn_guardar_evento'
    ).innerText = 'Guardar Actividad';

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

  .catch(err => {
  mostrarAlerta(err.message, 'danger');
  });

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

    if (!Array.isArray(data)) {
      mostrarAlerta(
        data.mensaje || 'No se pudo cargar la tabla de actividades',
        'warning'
      );
      return;
    }

    data.forEach(evento => {

      // Acciones CRUD eventos
      tabla.innerHTML += `

        <tr>

          <td>
            ${evento.nombre}
          </td>

          <td>
            ${obtenerTipoActividad(evento.tipo)}
          </td>

          <td>
            ${formatearFechaHora(evento.fecha)}
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
    'Actualizar Actividad';

}

// =====================================
// ELIMINAR EVENTOS
// =====================================

function eliminarEvento(id) {

  mostrarConfirmacion(
    'Esta acción eliminará la actividad seleccionada. ¿Deseas continuar?',
    () => ejecutarEliminarEvento(id)
  );

}

function ejecutarEliminarEvento(id) {

  fetch(
    `${API_URL}/eventos/${id}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders()
    }
  )

  .then(res => res.json())

  .then(data => {

    mostrarAlerta(data.mensaje, 'warning');

    cargarTablaEventos();
    cargarEventos();

  })

  .catch(err => console.error(err));

}
