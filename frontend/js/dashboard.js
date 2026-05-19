let chartMultas = null;
let chartDeuda = null;

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