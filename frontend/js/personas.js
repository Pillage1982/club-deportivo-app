// =====================================
// VARIABLES GLOBALES PERSONAS
// =====================================

let personaEditando = null;
let personasTabla = [];

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

      select.innerHTML =
        '<option value="">Seleccione un integrante</option>';

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

        if ((persona.estado || 'activo') === 'activo') {
          select.appendChild(option);
        }

        const optionPago = option.cloneNode(true);
        selectPago.appendChild(optionPago);

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

    fecha_ingreso:
      document.getElementById('fecha_ingreso').value || null,

    bloque:
      document.getElementById('bloque').value,

    sexo:
      document.getElementById('sexo').value || null,

    direccion:
      document.getElementById('direccion').value,

    nombre_apoderado:
      document.getElementById('nombre_apoderado').value,

    telefono_apoderado:
      document.getElementById('telefono_apoderado').value,

    estado:
      document.getElementById(
        'persona_estado'
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
      data.mensaje || 'No se pudo guardar el integrante'
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

document.getElementById('fecha_ingreso').value = '';
document.getElementById('bloque').value = '';
document.getElementById('sexo').value = '';
document.getElementById('direccion').value = '';
document.getElementById('nombre_apoderado').value = '';
document.getElementById('telefono_apoderado').value = '';

document.getElementById(
  'persona_estado'
).value = 'activo';

// Refresca selectores y tabla personas
    cargarPersonas();

    cargarTablaPersonas();

  })

  .catch(err => {
  console.error(err);
  mostrarAlerta(
    err.message || 'No se pudo guardar el integrante',
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

    if (!Array.isArray(data)) {
      mostrarAlerta(
      data.mensaje || 'No se pudo cargar la tabla de integrantes',
      'warning'
      );
      return;
    }

    personasTabla = data;

    renderizarTablaPersonas(
      filtrarPersonas(obtenerTerminoBusquedaPersonas())
    );

  })

  .catch(err => console.error(err));

}

function obtenerTerminoBusquedaPersonas() {
  const input =
    document.getElementById('buscar_personas');

  return input ? input.value : '';
}

function normalizarTextoBusqueda(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function filtrarPersonas(termino) {
  const busqueda =
    normalizarTextoBusqueda(termino);

  if (!busqueda) {
    return personasTabla;
  }

  return personasTabla.filter(persona => {
    const textoBusqueda = [
      persona.nombres,
      persona.apellido_paterno,
      persona.apellido_materno,
      persona.rut,
      persona.email,
      persona.telefono,
      persona.bloque
    ].map(normalizarTextoBusqueda).join(' ');

    return textoBusqueda.includes(busqueda);
  });
}

function renderizarTablaPersonas(personas) {
  const tabla =
    document.getElementById('tabla_personas');

  tabla.innerHTML = '';

  if (personas.length === 0) {
    tabla.innerHTML = `
      <tr>
        <td colspan="13" class="text-center text-muted">
          No se encontraron integrantes
        </td>
      </tr>
    `;
    return;
  }

  const sorted = [...personas].sort((a, b) => {
    const bloqueA = (a.bloque || '').toLowerCase();
    const bloqueB = (b.bloque || '').toLowerCase();
    if (bloqueA !== bloqueB) return bloqueA.localeCompare(bloqueB, 'es');
    const apA = (a.apellido_paterno || '').toLowerCase();
    const apB = (b.apellido_paterno || '').toLowerCase();
    return apA.localeCompare(apB, 'es');
  });

  let bloqueActual = null;

  sorted.forEach(persona => {

    const bloquePersona = persona.bloque || '';

    if (bloquePersona !== bloqueActual) {
      bloqueActual = bloquePersona;
      tabla.innerHTML += `
        <tr class="tabla-bloque-header">
          <td colspan="13"><i class="bi bi-people-fill me-2"></i>${bloquePersona || 'Sin bloque'}</td>
        </tr>
      `;
    }

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
            ${persona.bloque || ''}
          </td>

          <td>
            ${persona.sexo || ''}
          </td>

          <td>
            ${persona.email || ''}
          </td>

          <td>
            ${persona.telefono || ''}
          </td>

          <td title="${persona.direccion || ''}">
            ${persona.direccion ? persona.direccion.substring(0, 25) + (persona.direccion.length > 25 ? '…' : '') : ''}
          </td>

          <td>
            ${persona.fecha_nacimiento ? formatearFecha(persona.fecha_nacimiento) : ''}
          </td>

          <td>
            ${persona.fecha_ingreso ? formatearFecha(persona.fecha_ingreso) : ''}
          </td>

          <td>
            ${persona.nombre_apoderado || ''}
          </td>

          <td>
            ${persona.telefono_apoderado || ''}
          </td>

          <td>
            ${obtenerBadgeEstadoPersona(persona.estado)}
          </td>

          <td class="text-nowrap">

            <div class="btn-group btn-group-sm" role="group" aria-label="Acciones">
              <button
                type="button"
                class="btn btn-outline-warning"
                title="Editar"
                aria-label="Editar"
                onclick='editarPersona(${JSON.stringify(persona)})'>
                &#9998;
              </button>

              <button
                type="button"
                class="btn btn-outline-danger"
                title="Eliminar"
                aria-label="Eliminar"
                onclick='eliminarPersona(${persona.id})'>
                &times;
              </button>
            </div>

          </td>

        </tr>

      `;

  });

}

function configurarBuscadorPersonas() {
  const input =
    document.getElementById('buscar_personas');

  if (!input) {
    return;
  }

  input.addEventListener('input', () => {
    renderizarTablaPersonas(
      filtrarPersonas(input.value)
    );
  });
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

  document.getElementById('fecha_ingreso').value =
    persona.fecha_ingreso
      ? persona.fecha_ingreso.split('T')[0]
      : '';

  document.getElementById('bloque').value =
    persona.bloque || '';

  document.getElementById('sexo').value =
    persona.sexo || '';

  document.getElementById('direccion').value =
    persona.direccion || '';

  document.getElementById('nombre_apoderado').value =
    persona.nombre_apoderado || '';

  document.getElementById('telefono_apoderado').value =
    persona.telefono_apoderado || '';

  document.getElementById(
    'persona_estado'
  ).value = persona.estado || 'activo';

  document.getElementById(
    'btn_guardar_persona'
  ).innerText = 'Actualizar Integrante';

  actualizarVisibilidadApoderado();
}

function calcularEdad(fechaNacimiento) {
  if (!fechaNacimiento) return null;
  const hoy = new Date();
  const nac = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function actualizarVisibilidadApoderado() {
  const fechaInput = document.getElementById('fecha_nacimiento');
  const bloque = document.getElementById('bloque_apoderado');
  if (!fechaInput || !bloque) return;
  const edad = calcularEdad(fechaInput.value);
  if (edad !== null && edad < 18) {
    bloque.classList.remove('d-none');
  } else {
    bloque.classList.add('d-none');
  }
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

function obtenerBadgeEstadoPersona(estado) {
  const valor =
    estado || 'activo';

  if (valor === 'receso') {
    return '<span class="badge bg-info text-dark">Receso</span>';
  }

  if (valor === 'inactivo') {
    return '<span class="badge bg-secondary">Inactivo</span>';
  }

  return '<span class="badge bg-success">Activo</span>';
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

  if (!['activo', 'receso'].includes(data.estado || 'activo')) {
    return 'Seleccione un estado de integrante valido';
  }

  return null;
}

document.addEventListener('DOMContentLoaded', () => {
  const fechaInput = document.getElementById('fecha_nacimiento');
  if (fechaInput) {
    fechaInput.addEventListener('change', actualizarVisibilidadApoderado);
  }
});
