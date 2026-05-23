// =====================================
// VARIABLES GLOBALES PERSONAS
// =====================================

let personaEditando = null;

// =====================================
// CARGAR PERSONAS EN SELECTORES
// =====================================

function cargarPersonas() {

  fetch(`${API_URL}/personas`, {

   headers: getAuthHeaders()

  })
    
    .then(res => res.json())
    .then(data => {

      // Selectores asistencia y pagos
      const select = document.getElementById('persona_id');
      const selectPago = document.getElementById('pago_persona_id');

      select.innerHTML = '';

      selectPago.innerHTML = '';

      data.forEach(persona => {

        // Clona opción para reutilizar
        // en selector de pagos 
        const option = document.createElement('option');

        option.value = persona.id;
        option.textContent = `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`;

        select.appendChild(option);
        const optionPago = option.cloneNode(true); selectPago.appendChild(optionPago);

      });

    })
    .catch(err => console.error(err));

}

// =====================================
// CREAR / ACTUALIZAR PERSONAS
// =====================================

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

  // =====================================
  // VALIDACIONES FRONTEND PERSONAS
  // =====================================

if (!data.rut.trim()) {

  mostrarAlerta(
    'Ingrese el RUT',
    'warning'
  );

  return;

}

if (!data.nombres.trim()) {

  mostrarAlerta(
    'Ingrese los nombres',
    'warning'
  );

  return;

}

if (!data.apellido_paterno.trim()) {

  mostrarAlerta(
    'Ingrese el apellido paterno',
    'warning'
  );

  return;

}

if (

  data.email &&

  !data.email.includes('@')

) {

  mostrarAlerta(
    'Ingrese un email válido',
    'warning'
  );

  return;

}

  let url = `${API_URL}/personas`;

  let method = 'POST';

  // Si existe personaEditando,
  // se actualiza registro existente
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

    // Limpia formulario después guardar
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

// Refresca selectores y tabla personas
    cargarPersonas();

    cargarTablaPersonas();

  })

  .catch(err => console.error(err));

}

  // =====================================
  // CARGAR TABLA PERSONAS
  // =====================================

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

      // Acciones CRUD personas
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

// =====================================
// EDITAR PERSONAS
// =====================================

function editarPersona(persona) {

  // Activa modo edición persona
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

// =====================================
// ELIMINAR PERSONAS
// =====================================

function eliminarPersona(id) {

  // Solicita confirmación antes eliminar
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

    mostrarAlerta(data.mensaje,'warning');

    // Refresca tabla y selectores
    cargarTablaPersonas();

    cargarPersonas();

  })

  .catch(err => console.error(err));

}