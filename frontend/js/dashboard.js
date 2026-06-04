// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartMultas = null;
let chartDeuda = null;

// =====================================
// CARGAR RESUMEN GENERAL DASHBOARD
// =====================================

function cargarDashboard() {

  // Obtiene datos generales
  // en paralelo para optimizar carga
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

// Variables acumuladoras financieras
let totalPagado = 0;
let deudaTotal = 0;
let totalCuotas = 0;
let totalMultasPendientes = 0;
let sociosConDeuda = 0;

finanzas.forEach(f => {

  totalPagado +=
    Number(f.total_pagado || 0);

  deudaTotal +=
    Number(f.deuda_actual || 0);

  totalCuotas +=
    Number(f.total_cuotas || 0);

  totalMultasPendientes +=
    Number(f.total_multas || 0);

  if (Number(f.deuda_actual || 0) > 0) {

    sociosConDeuda++;

  }

});

    // Actualiza tarjetas visuales dashboard
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

// =====================================
// CARGAR GRAFICOS FINANCIEROS
// =====================================

function cargarGraficos() {

  fetch(`${API_URL}/finanzas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    // Prepara datos para Chart.js
    const nombres = data.map(
      f => `${f.nombres} ${f.apellido_paterno} ${f.apellido_materno || ''}`
    );

    const multas = data.map(
      f => Number(f.total_multas)
    );

    const cuotas = data.map(
      f => Number(f.total_cuotas || 0)
    );

    const deuda = data.map(
      f => Number(f.deuda_actual)
    );

    // Destruye gráficos anteriores
    // para evitar duplicados visuales
    if (chartMultas) {

      chartMultas.destroy();

    } 

if (chartDeuda) {

  chartDeuda.destroy();

}

// Grafico barras multas por socio
    chartMultas = new Chart(

      document.getElementById(
        'graficoMultas'
      ),

      {

        type: 'bar',

        data: {

          labels: nombres,

          datasets: [
  {

    label: 'Multas',

    data: multas

  },
  {

    label: 'Cuotas',

    data: cuotas

  }
]

        }

      }

    );

    // Grafico circular deuda financiera
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