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

      if (!Array.isArray(data)) {
        mostrarAlerta(
        data.mensaje || 'No se pudieron cargar los integrantes',
        'warning'
        );
        return;
      }

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
    ).value,

    fecha_nacimiento:
      document.getElementById(
      'fecha_nacimiento'
    ).value,

  };

  // =====================================
  // VALIDACIONES FRONTEND PERSONAS
  // =====================================

const errorValidacion = validarPersonaFrontend(data);

if (errorValidacion) {
  mostrarAlerta(errorValidacion, 'warning');
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

  .then(async res => {
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.mensaje || 'No se pudo guardar la persona'
    );
  }

  return data;
})
.then(data => {

    const mensaje =
  data.mensaje || 'Integrante guardado correctamente';

mostrarAlerta(
  mensaje,
  'success'
);

const respuestaPersona =
  document.getElementById('respuesta_persona');

if (respuestaPersona) {
  respuestaPersona.innerText = mensaje;
}

    personaEditando = null;

    document.getElementById(
      'btn_guardar_persona'
    ).innerText = 'Guardar Integrante';

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

document.getElementById(
  'fecha_nacimiento'
).value = '';

// Refresca selectores y tabla personas
    cargarPersonas();

    cargarTablaPersonas();

  })

  .catch(err => {
  console.error(err);
  mostrarAlerta(
    err.message || 'No se pudo guardar la persona',
    'danger'
  );
});

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

    if (!Array.isArray(data)) {
      mostrarAlerta(
      data.mensaje || 'No se pudo cargar la tabla de integrantes',
      'warning'
      );
      return;
    }

    data.forEach(persona => {

    const edad =
    calcularEdad(persona.fecha_nacimiento);

    const categoria =
    calcularCategoria(persona.fecha_nacimiento);

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
            ${edad}
          </td>

          <td>
            ${categoria}
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
    'fecha_nacimiento'
    ).value =
    persona.fecha_nacimiento
    ? persona.fecha_nacimiento.split('T')[0]
  : '';

  document.getElementById(
    'btn_guardar_persona'
  ).innerText = 'Actualizar Integrante';

}

// =====================================
// ELIMINAR PERSONAS
// =====================================

function eliminarPersona(id) {

  mostrarConfirmacion(
    'Esta acción eliminará el integrante seleccionado. ¿Deseas continuar?',
    () => ejecutarEliminarPersona(id)
  );

}

function ejecutarEliminarPersona(id) {

  fetch(
    `${API_URL}/personas/${id}`,
    {
      method: 'DELETE',
      headers: getAuthHeaders()
    }
  )

  .then(res => res.json())

  .then(data => {

    mostrarAlerta(data.mensaje, 'warning');

    cargarTablaPersonas();
    cargarPersonas();

  })

  .catch(err => console.error(err));

}

// =====================================
// CALCULAR EDAD
// =====================================

function calcularEdad(fechaNacimiento) {

  if (!fechaNacimiento) {

    return '';

  }

  const hoy =
    new Date();

  const nacimiento =
    new Date(fechaNacimiento);

  let edad =
    hoy.getFullYear() -
    nacimiento.getFullYear();

  const mes =
    hoy.getMonth() -
    nacimiento.getMonth();

  if (
    mes < 0 ||
    (
      mes === 0 &&
      hoy.getDate() < nacimiento.getDate()
    )
  ) {

    edad--;

  }

  return edad;

}

// =====================================
// CALCULAR CATEGORÍA
// =====================================

function calcularCategoria(fechaNacimiento) {

  const edad =
    calcularEdad(fechaNacimiento);

  if (edad === '') {

    return 'Fecha requerida';

  }

  if (edad <= 8) return 'Sub-8';

  if (edad <= 10) return 'Sub-10';

  if (edad <= 12) return 'Sub-12';

  if (edad <= 15) return 'Sub-15';

  if (edad <= 18) return 'Sub-18';

  if (edad <= 39) return 'Adulto';

  return 'Senior';

}

function limpiarRutFrontend(rut) {
  return String(rut || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function validarRutFrontend(rut) {
  const limpio = limpiarRutFrontend(rut);

  if (!/^[0-9]{7,8}[0-9K]$/.test(limpio)) {
    return false;
  }

  const cuerpo = limpio.slice(0, -1);
  const dv = limpio.slice(-1);
  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += Number(cuerpo[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = 11 - (suma % 11);
  const dvEsperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);

  return dv === dvEsperado;
}

function validarNombreFrontend(valor) {
  const texto = String(valor || '').trim().replace(/\s+/g, ' ');
  return texto.length >= 2 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s'-]+$/.test(texto);
}

function validarEmailFrontend(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validarTelefonoFrontend(telefono) {
  const limpio = String(telefono || '').replace(/\s+/g, '');
  return /^(\+?56)?9?[0-9]{8}$/.test(limpio);
}

function validarFechaNacimientoFrontend(fecha) {
  if (!fecha) return false;

  const nacimiento = new Date(fecha);
  const hoy = new Date();

  if (Number.isNaN(nacimiento.getTime())) {
    return false;
  }

  return nacimiento <= hoy;
}

function validarPersonaFrontend(data) {
  if (!validarRutFrontend(data.rut)) {
    return 'Ingrese un RUT chileno válido';
  }

  if (!validarNombreFrontend(data.nombres)) {
    return 'Ingrese nombres válidos';
  }

  if (!validarNombreFrontend(data.apellido_paterno)) {
    return 'Ingrese un apellido paterno válido';
  }

  if (
    data.apellido_materno &&
    !validarNombreFrontend(data.apellido_materno)
  ) {
    return 'Ingrese un apellido materno válido';
  }

  if (!validarEmailFrontend(data.email)) {
    return 'Ingrese un email válido';
  }

  if (!validarTelefonoFrontend(data.telefono)) {
    return 'Ingrese un teléfono chileno válido';
  }

  if (!validarFechaNacimientoFrontend(data.fecha_nacimiento)) {
    return 'Ingrese una fecha de nacimiento válida';
  }

  return null;
}