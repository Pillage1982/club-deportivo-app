// Interfaz del dashboard: carga el resumen de la API y administra las instancias de gráficos Chart.js.
// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartMultas = null;
let chartDeuda  = null;

// Mismos bloques que excluye Formaciones (backend/utils/formacionRules.js):
// socios y socios honorarios no bailan, no deben mezclarse en el desglose por bloque.
const BLOQUES_EXCLUIDOS_DASHBOARD = [
  'socios', 'socio', 'socios honorario', 'socios honorarios',
  'socio honorario', 'socio honorarios'
];

function esBloqueExcluidoDashboard(bloque) {
  return BLOQUES_EXCLUIDOS_DASHBOARD.includes(String(bloque || '').trim().toLocaleLowerCase('es'));
}

// =====================================
// CARGAR RESUMEN GENERAL DASHBOARD
// =====================================

function cargarDashboard() {
  // Un solo fetch al endpoint /dashboard — antes eran 4 fetches independientes
  fetch(`${API_URL}/dashboard`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!data || data.error) return;

      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
      };

      set('total_personas', data.total_personas ?? 0);
      set('total_multas',   data.total_multas   ?? 0);
      set('total_pagado',   formatearMonto(data.pagos_mes    ?? 0));
      set('deuda_total',    formatearMonto(data.deuda_total  ?? 0));

      // Estadísticas por bloque usan asistenciasTabla ya cargado (sin fetch extra)
      actualizarEstadisticasAsistenciaDashboard(
        Array.isArray(asistenciasTabla) ? asistenciasTabla : []
      );
    })
    .catch(err => console.error(err));
}

// =====================================
// ESTADISTICAS ASISTENCIA POR BLOQUE
// =====================================

function actualizarEstadisticasAsistenciaDashboard(asistencias) {
  const contenedor = document.getElementById('asistencia_por_bloque');
  if (!contenedor) return;

  if (!asistencias.length) {
    contenedor.innerHTML = '<p class="text-muted small">Sin registros de asistencia aún.</p>';
    return;
  }

  const porBloque = {};

  asistencias.forEach(a => {
    if (esBloqueExcluidoDashboard(a.bloque)) return;
    const bloque = a.bloque || 'Sin Bloque';
    if (!porBloque[bloque]) {
      porBloque[bloque] = {
        ensayos:        { presentes: 0, total: 0 },
        presentaciones: { presentes: 0, total: 0 },
        otras:          { presentes: 0, total: 0 }
      };
    }
    const presente = ['presente', 'atrasado'].includes(a.estado);
    if (a.tipo_evento === 'entrenamiento') {
      porBloque[bloque].ensayos.total++;
      if (presente) porBloque[bloque].ensayos.presentes++;
    } else if (a.tipo_evento === 'partido') {
      porBloque[bloque].presentaciones.total++;
      if (presente) porBloque[bloque].presentaciones.presentes++;
    } else {
      porBloque[bloque].otras.total++;
      if (presente) porBloque[bloque].otras.presentes++;
    }
  });

  const bloques = Object.keys(porBloque).sort();

  const filas = bloques.map(bloque => {
    const e    = porBloque[bloque].ensayos;
    const p    = porBloque[bloque].presentaciones;
    const o    = porBloque[bloque].otras;
    const pctE = e.total > 0 ? Math.round((e.presentes / e.total) * 100) : 0;
    const pctP = p.total > 0 ? Math.round((p.presentes / p.total) * 100) : 0;
    const pctO = o.total > 0 ? Math.round((o.presentes / o.total) * 100) : 0;
    const clsE = pctE >= 70 ? 'bg-success' : pctE >= 40 ? 'bg-warning text-dark' : 'bg-danger';
    const clsP = pctP >= 70 ? 'bg-success' : pctP >= 40 ? 'bg-warning text-dark' : 'bg-danger';
    const clsO = pctO >= 70 ? 'bg-success' : pctO >= 40 ? 'bg-warning text-dark' : 'bg-danger';
    return `
      <tr>
        <td><strong>${bloque}</strong></td>
        <td class="text-center">
          <span class="badge ${clsE}">${pctE}%</span>
          <small class="text-muted ms-1">${e.presentes}/${e.total}</small>
        </td>
        <td class="text-center">
          <span class="badge ${clsP}">${pctP}%</span>
          <small class="text-muted ms-1">${p.presentes}/${p.total}</small>
        </td>
        <td class="text-center">
          <span class="badge ${clsO}">${pctO}%</span>
          <small class="text-muted ms-1">${o.presentes}/${o.total}</small>
        </td>
      </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Bloque</th>
            <th class="text-center">Ensayos</th>
            <th class="text-center">Presentaciones</th>
            <th class="text-center">Otras actividades</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

// =====================================
// CARGAR GRAFICOS POR BLOQUE
// =====================================

function cargarGraficos() {
  // Usa datos ya en memoria si están disponibles, evita fetches duplicados
  const tieneFinanzas  = Array.isArray(finanzasCargadas) && finanzasCargadas.length > 0;
  const tienePersonas  = Array.isArray(personasTabla)    && personasTabla.length    > 0;

  const promFinanzas = tieneFinanzas
    ? Promise.resolve(finanzasCargadas)
    : fetch(`${API_URL}/finanzas`, { headers: getAuthHeaders() }).then(r => r.json());

  const promPersonas = tienePersonas
    ? Promise.resolve(personasTabla)
    : fetch(`${API_URL}/personas`, { headers: getAuthHeaders() }).then(r => r.json());

  Promise.all([promFinanzas, promPersonas])
    .then(([finanzas, personas]) => {
      if (!Array.isArray(finanzas) || !Array.isArray(personas)) {
        mostrarAlerta('No se pudieron cargar los gráficos', 'warning');
        return;
      }

      const bloqueMap = {};
      personas.forEach(p => { bloqueMap[p.id] = p.bloque || 'Sin Bloque'; });

      const porBloque = {};
      finanzas.forEach(f => {
        const bloque = bloqueMap[f.id] || 'Sin Bloque';
        if (esBloqueExcluidoDashboard(bloque)) return;
        if (!porBloque[bloque]) porBloque[bloque] = { multas: 0, cuotas: 0, deuda: 0 };
        porBloque[bloque].multas += Number(f.total_multas || 0);
        porBloque[bloque].cuotas += Number(f.total_cuotas  || 0);
        porBloque[bloque].deuda  += Number(f.deuda_actual  || 0);
      });

      const bloques = Object.keys(porBloque).sort();
      const multas  = bloques.map(b => porBloque[b].multas);
      const cuotas  = bloques.map(b => porBloque[b].cuotas);
      const deuda   = bloques.map(b => porBloque[b].deuda);

      const colores = [
        '#4e79a7','#f28e2b','#e15759',
        '#76b7b2','#59a14f','#edc948',
        '#b07aa1','#ff9da7','#9c755f'
      ];

      if (chartMultas) chartMultas.destroy();
      if (chartDeuda)  chartDeuda.destroy();

      chartMultas = new Chart(document.getElementById('graficoMultas'), {
        type: 'bar',
        data: {
          labels: bloques,
          datasets: [
            { label: 'Multas', data: multas, backgroundColor: '#e15759' },
            { label: 'Cuotas', data: cuotas, backgroundColor: '#4e79a7' }
          ]
        },
        options: { responsive: true, plugins: { legend: { position: 'top' } } }
      });

      chartDeuda = new Chart(document.getElementById('graficoDeuda'), {
        type: 'pie',
        data: {
          labels: bloques,
          datasets: [{ label: 'Deuda', data: deuda, backgroundColor: colores.slice(0, bloques.length) }]
        },
        options: { responsive: true, plugins: { legend: { position: 'right' } } }
      });
    })
    .catch(err => console.error(err));
}
