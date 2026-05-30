// =====================================
// VARIABLES GLOBALES PAGOS
// =====================================

let pagoEditando = null;

// =====================================
// CARGAR ESTADO FINANCIERO SOCIOS
// =====================================

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

        // Estado financiero dinámico:
        // 0 = al día
        // negativo = saldo a favor
        // positivo = deuda pendiente
        tabla.innerHTML += `
          <tr>
            <td>${finanza.nombres} ${finanza.apellido_paterno} ${finanza.apellido_materno || ''}</td>
            <td>$${finanza.total_multas}</td>
            <td>$${finanza.total_pagado}</td>
            <td>${Number(finanza.deuda_actual) === 0 ? `<span class="badge bg-success">AL DÍA</span>`
              : Number(finanza.deuda_actual) < 0 ? `<span class="badge bg-primary">
                  $${Math.abs(finanza.deuda_actual)} (A FAVOR)
                </span>`
              : `<span class="badge bg-danger">Deuda: $${finanza.deuda_actual}</span>`}
            </td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}

// Activa modo edición de pago
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

// =====================================
// CREAR / ACTUALIZAR PAGOS
// =====================================

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

  // =====================================
  // VALIDACIONES FRONTEND PAGOS
  // =====================================

  if (!data.persona_id) {

    mostrarAlerta(
      'Seleccione una persona',
      'warning'
    );

  return;

  }

  if (!data.monto_total) {

    mostrarAlerta(
    'Ingrese un monto',
    'warning'
    );

    return;

  }

  if (Number(data.monto_total) <= 0) {

    mostrarAlerta(
      'El monto debe ser mayor a 0',
      'warning'
    );

    return;

  }

  if (!data.metodo) {

    mostrarAlerta(
      'Seleccione un método de pago',
      'warning'
    );

    return;

  }

  let url = `${API_URL}/pagos`;

  let method = 'POST';

  // Si existe pagoEditando,
  // se actualiza el pago
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

    mostrarAlerta(data.mensaje,'success');

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

    // Refresca módulos financieros
    // automáticamente sin F5
    cargarTablaPagos();
    cargarMultas();
    cargarFinanzas();
    cargarDashboard();
    cargarGraficos();

  })

  .catch(err => console.error(err));

}

// =====================================
// CARGAR TABLA PAGOS
// =====================================

function cargarTablaPagos() {

  fetch(`${API_URL}/pagos`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

  console.log(
    'Respuesta pagos:',
    data
  );

  const tabla =
    document.getElementById(
      'tabla_pagos'
    );

  tabla.innerHTML = '';

  if (!Array.isArray(data)) {

    console.error(
      'No llegó un arreglo',
      data
    );

    return;

  }

  data.forEach(pago => {

      // Acciones CRUD pagos
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

// =====================================
// ELIMINAR PAGOS
// =====================================

function eliminarPago(id) {

  // Solicita confirmación antes de eliminar
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

    mostrarAlerta(data.mensaje,'warning');

    // Refresca automáticamente
    // módulos financieros
    cargarTablaPagos();

    cargarDashboard();

    cargarFinanzas();

  })

  .catch(err => console.error(err));

}