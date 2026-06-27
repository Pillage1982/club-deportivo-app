// =====================================
// VARIABLES GLOBALES EVENTOS
// =====================================

let eventoEditando = null;
let eventosAsistencia = [];
let eventosCargados = [];

function normalizarTextoEvento(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function obtenerFechaEvento(fecha) {
  if (!fecha) return '';
  return String(fecha).substring(0, 10);
}

function obtenerTipoActividad(tipo) {

  const config =
    window.APP_CONFIG || {};

  const tipos =
    config.tiposActividad || {
      entrenamiento: 'Ensayo',
      partido: 'Presentacion',
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

      select.innerHTML =
        '<option value="">Seleccione una actividad</option>';

      if (!Array.isArray(data)) {
        mostrarAlerta(
        data.mensaje || 'No se pudieron cargar las actividades',
        'warning'
        );
        return;
      }

      eventosAsistencia = data;

      data.forEach(evento => {

        const option = document.createElement('option');

        option.value = evento.id;
        option.textContent = evento.finalizado
          ? `${evento.nombre} (Cerrado)`
          : evento.nombre;
        option.dataset.fecha = evento.fecha || '';
        option.dataset.finalizado = evento.finalizado ? '1' : '0';

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

    if (!Array.isArray(data)) {
      mostrarAlerta(
        data.mensaje || 'No se pudo cargar la tabla de actividades',
        'warning'
      );
      return;
    }

    eventosCargados = data;
    renderizarTablaEventos(filtrarEventos(data));

  })

  .catch(err => console.error(err));

}

function filtrarEventos(eventos) {
  const busqueda =
    normalizarTextoEvento(
      document.getElementById('buscar_eventos')?.value
    );

  const tipo =
    document.getElementById('filtro_evento_tipo')?.value || '';

  const fecha =
    document.getElementById('filtro_evento_fecha')?.value || '';

  return eventos.filter(evento => {
    const textoEvento = normalizarTextoEvento([
      evento.nombre,
      evento.ubicacion,
      evento.descripcion
    ].join(' '));

    const coincideBusqueda =
      !busqueda || textoEvento.includes(busqueda);

    const coincideTipo =
      !tipo || evento.tipo === tipo;

    const coincideFecha =
      !fecha || obtenerFechaEvento(evento.fecha) === fecha;

    return coincideBusqueda && coincideTipo && coincideFecha;
  });
}

function renderizarTablaEventos(eventos) {
  const tabla =
    document.getElementById('tabla_eventos');

  tabla.innerHTML = '';

  if (!eventos.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">
          No hay actividades para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  eventos.forEach(evento => {

    const finalizado = evento.finalizado ? 1 : 0;

    tabla.innerHTML += `

      <tr>

        <td>${evento.nombre}</td>

        <td>${obtenerTipoActividad(evento.tipo)}</td>

        <td>${formatearFechaHora(evento.fecha)}</td>

        <td>${evento.ubicacion || ''}</td>

        <td>${evento.descripcion || ''}</td>

        <td>
          ${finalizado
            ? '<span class="badge bg-secondary">Finalizado</span>'
            : '<span class="badge bg-success">Activo</span>'
          }
        </td>

        <td class="text-nowrap">
          <div class="btn-group btn-group-sm" role="group" aria-label="Acciones">
            ${!finalizado ? `
            <button
              type="button"
              class="btn btn-outline-warning"
              title="Editar"
              aria-label="Editar"
              onclick='editarEvento(${JSON.stringify(evento)})'>
              &#9998;
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary"
              title="Finalizar"
              aria-label="Finalizar"
              onclick='cerrarEvento(${evento.id})'>
              &#10003;
            </button>
            ` : ''}
            <button
              type="button"
              class="btn btn-outline-danger"
              title="Eliminar"
              aria-label="Eliminar"
              onclick='eliminarEvento(${evento.id})'>
              &times;
            </button>
          </div>
        </td>

      </tr>

    `;

  });
}

function aplicarFiltrosEventos() {
  renderizarTablaEventos(filtrarEventos(eventosCargados));
}

function limpiarFiltrosEventos() {
  const buscar = document.getElementById('buscar_eventos');
  const tipo   = document.getElementById('filtro_evento_tipo');
  const fecha  = document.getElementById('filtro_evento_fecha');

  if (buscar) buscar.value = '';
  if (tipo)   tipo.value   = '';
  if (fecha)  fecha.value  = '';

  aplicarFiltrosEventos();
}

function configurarFiltrosEventos() {
  ['buscar_eventos', 'filtro_evento_tipo', 'filtro_evento_fecha']
    .forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener(
        el.tagName === 'INPUT' ? 'input' : 'change',
        aplicarFiltrosEventos
      );
    });
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
  ).value = (() => {
    if (!evento.fecha) return '';
    const d = new Date(String(evento.fecha).replace(' ', 'T'));
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  })();

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

// =====================================
// FINALIZAR EVENTO
// =====================================

function cerrarEvento(id) {

  mostrarConfirmacion(
    'Al finalizar esta actividad ya no se podrá registrar asistencia. ¿Deseas continuar?',
    () => ejecutarCerrarEvento(id)
  );

}

function ejecutarCerrarEvento(id) {

  fetch(`${API_URL}/eventos/${id}/cerrar`, {

    method: 'PATCH',

    headers: getAuthHeaders()

  })

  .then(async res => {

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.mensaje || 'Error al finalizar actividad');
    }

    return data;

  })

  .then(data => {

    mostrarAlerta(data.mensaje, 'success');

    cargarTablaEventos();
    cargarEventos();

  })

  .catch(err => mostrarAlerta(err.message, 'danger'));

}
