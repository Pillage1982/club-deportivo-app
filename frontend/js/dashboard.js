// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartMultas = null;
let chartDeuda = null;

// =====================================
// CARGAR RESUMEN GENERAL DASHBOARD
// =====================================

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
    }).then(res => res.json()),

    fetch(`${API_URL}/asistencia`, {
      headers: getAuthHeaders()
    }).then(res => res.json())

  ])

  .then(([personas, multas, finanzas, asistencias]) => {

    document.getElementById(
      'total_personas'
    ).innerText = Array.isArray(personas) ? personas.length : 0;

    document.getElementById(
      'total_multas'
    ).innerText = Array.isArray(multas) ? multas.length : 0;

    let totalPagado = 0;
    let deudaTotal = 0;

    if (Array.isArray(finanzas)) {
      finanzas.forEach(f => {
        totalPagado += Number(f.total_pagado || 0);
        deudaTotal  += Number(f.deuda_actual || 0);
      });
    }

    document.getElementById('total_pagado').innerText = formatearMonto(totalPagado);
    document.getElementById('deuda_total').innerText  = formatearMonto(deudaTotal);

    actualizarEstadisticasAsistenciaDashboard(
      Array.isArray(asistencias) ? asistencias : []
    );

  })

  .catch(err => console.error(err));

}

// =====================================
// ESTADISTICAS ASISTENCIA POR BLOQUE
// =====================================

function actualizarEstadisticasAsistenciaDashboard(asistencias) {

  const contenedor =
    document.getElementById('asistencia_por_bloque');

  if (!contenedor) return;

  if (!asistencias.length) {
    contenedor.innerHTML =
      '<p class="text-muted small">Sin registros de asistencia aún.</p>';
    return;
  }

  // Agrupa por bloque y tipo de evento
  const porBloque = {};

  asistencias.forEach(a => {

    const bloque = a.bloque || 'Sin Bloque';

    if (!porBloque[bloque]) {
      porBloque[bloque] = {
        ensayos:        { presentes: 0, total: 0 },
        presentaciones: { presentes: 0, total: 0 }
      };
    }

    const presente =
      ['presente', 'atrasado'].includes(a.estado);

    if (a.tipo_evento === 'entrenamiento') {
      porBloque[bloque].ensayos.total++;
      if (presente) porBloque[bloque].ensayos.presentes++;
    } else if (a.tipo_evento === 'partido') {
      porBloque[bloque].presentaciones.total++;
      if (presente) porBloque[bloque].presentaciones.presentes++;
    }

  });

  const bloques = Object.keys(porBloque).sort();

  let html = `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Bloque</th>
            <th class="text-center">Ensayos</th>
            <th class="text-center">Presentaciones</th>
          </tr>
        </thead>
        <tbody>
  `;

  bloques.forEach(bloque => {

    const e = porBloque[bloque].ensayos;
    const p = porBloque[bloque].presentaciones;

    const pctE = e.total > 0
      ? Math.round((e.presentes / e.total) * 100)
      : 0;

    const pctP = p.total > 0
      ? Math.round((p.presentes / p.total) * 100)
      : 0;

    const badgeE = pctE >= 70
      ? 'bg-success'
      : pctE >= 40
      ? 'bg-warning text-dark'
      : 'bg-danger';

    const badgeP = pctP >= 70
      ? 'bg-success'
      : pctP >= 40
      ? 'bg-warning text-dark'
      : 'bg-danger';

    html += `
      <tr>
        <td><strong>${bloque}</strong></td>
        <td class="text-center">
          <span class="badge ${badgeE}">${pctE}%</span>
          <small class="text-muted ms-1">${e.presentes}/${e.total}</small>
        </td>
        <td class="text-center">
          <span class="badge ${badgeP}">${pctP}%</span>
          <small class="text-muted ms-1">${p.presentes}/${p.total}</small>
        </td>
      </tr>
    `;

  });

  html += '</tbody></table></div>';

  contenedor.innerHTML = html;

}

// =====================================
// CARGAR GRAFICOS POR BLOQUE
// =====================================

function cargarGraficos() {

  Promise.all([

    fetch(`${API_URL}/finanzas`, {
      headers: getAuthHeaders()
    }).then(res => res.json()),

    fetch(`${API_URL}/personas`, {
      headers: getAuthHeaders()
    }).then(res => res.json())

  ])

  .then(([finanzas, personas]) => {

    if (!Array.isArray(finanzas) || !Array.isArray(personas)) {
      mostrarAlerta('No se pudieron cargar los gráficos', 'warning');
      return;
    }

    // Mapa id → bloque desde personas
    const bloqueMap = {};
    personas.forEach(p => {
      bloqueMap[p.id] = p.bloque || 'Sin Bloque';
    });

    // Agrupa finanzas por bloque
    const porBloque = {};

    finanzas.forEach(f => {

      const bloque = bloqueMap[f.id] || 'Sin Bloque';

      if (!porBloque[bloque]) {
        porBloque[bloque] = { multas: 0, cuotas: 0, deuda: 0 };
      }

      porBloque[bloque].multas += Number(f.total_multas || 0);
      porBloque[bloque].cuotas += Number(f.total_cuotas  || 0);
      porBloque[bloque].deuda  += Number(f.deuda_actual  || 0);

    });

    const bloques = Object.keys(porBloque).sort();
    const multas  = bloques.map(b => porBloque[b].multas);
    const cuotas  = bloques.map(b => porBloque[b].cuotas);
    const deuda   = bloques.map(b => porBloque[b].deuda);

    // Paleta de colores para bloques
    const colores = [
      '#4e79a7', '#f28e2b', '#e15759',
      '#76b7b2', '#59a14f', '#edc948',
      '#b07aa1', '#ff9da7', '#9c755f'
    ];

    if (chartMultas) chartMultas.destroy();
    if (chartDeuda)  chartDeuda.destroy();

    chartMultas = new Chart(
      document.getElementById('graficoMultas'),
      {
        type: 'bar',
        data: {
          labels: bloques,
          datasets: [
            {
              label: 'Multas',
              data: multas,
              backgroundColor: '#e15759'
            },
            {
              label: 'Cuotas',
              data: cuotas,
              backgroundColor: '#4e79a7'
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top' }
          }
        }
      }
    );

    chartDeuda = new Chart(
      document.getElementById('graficoDeuda'),
      {
        type: 'pie',
        data: {
          labels: bloques,
          datasets: [{
            label: 'Deuda',
            data: deuda,
            backgroundColor: colores.slice(0, bloques.length)
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'right' }
          }
        }
      }
    );

  })

  .catch(err => console.error(err));

}
