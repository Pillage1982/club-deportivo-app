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
      renderizarAsistenciaDashboard(
        Array.isArray(asistenciasTabla) ? asistenciasTabla : []
      );
    })
    .catch(err => console.error(err));
}

// =====================================
// FILTROS ASISTENCIA POR BLOQUE (mes / actividad)
// =====================================

const MESES_DASHBOARD_ASISTENCIA = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function claveMesDashboardAsistencia(fecha) {
  const texto = String(fecha || '').trim();
  if (!texto) return '';
  const normalizada = texto.includes('T') ? texto : texto.replace(' ', 'T');
  const dt = new Date(normalizada);
  if (Number.isNaN(dt.getTime())) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function etiquetaMesDashboardAsistencia(clave) {
  const [anio, mes] = clave.split('-').map(Number);
  return `${MESES_DASHBOARD_ASISTENCIA[mes - 1]} ${anio}`;
}

function claveAnioDashboardAsistencia(fecha) {
  const clave = claveMesDashboardAsistencia(fecha);
  return clave ? clave.split('-')[0] : '';
}

// Repuebla los selects de año/mes/actividad con lo presente en los datos, conservando
// la selección del usuario entre recargas. Solo la primera carga fija el año y mes
// actuales por defecto; después de eso se respeta lo que el usuario haya elegido
// (incluido "Todos"). Si el mes recordado queda de un año distinto al seleccionado,
// se limpia para no dejar una combinación contradictoria.
function poblarFiltrosDashboardAsistencia(asistencias) {
  const selAnio = document.getElementById('filtro_dashboard_asistencia_anio');
  const selMes = document.getElementById('filtro_dashboard_asistencia_mes');
  const selEvento = document.getElementById('filtro_dashboard_asistencia_evento');
  if (!selAnio || !selMes || !selEvento) return;

  const esPrimeraCarga = selMes.options.length === 0;
  const anioPrevio = selAnio.value;
  const mesPrevio = selMes.value;

  const anioActual = String(new Date().getFullYear());
  const mesActual = claveMesDashboardAsistencia(new Date().toISOString());

  const anios = new Set([anioActual]);
  const meses = new Set([mesActual]);
  asistencias.forEach(a => {
    const clave = claveMesDashboardAsistencia(a.fecha_evento);
    if (clave) {
      meses.add(clave);
      anios.add(clave.split('-')[0]);
    }
  });
  const aniosOrdenados = Array.from(anios).sort().reverse();
  const mesesOrdenados = Array.from(meses).sort().reverse();

  selAnio.innerHTML =
    aniosOrdenados.map(anio => `<option value="${anio}">${anio}</option>`).join('') +
    '<option value="">Todos los años</option>';

  selAnio.value = (!esPrimeraCarga && (aniosOrdenados.includes(anioPrevio) || anioPrevio === ''))
    ? anioPrevio
    : anioActual;

  selMes.innerHTML =
    mesesOrdenados.map(clave => `<option value="${clave}">${etiquetaMesDashboardAsistencia(clave)}</option>`).join('') +
    '<option value="">Todos los meses</option>';

  selMes.value = (!esPrimeraCarga && (mesesOrdenados.includes(mesPrevio) || mesPrevio === ''))
    ? mesPrevio
    : mesActual;

  if (selAnio.value && selMes.value && selMes.value.split('-')[0] !== selAnio.value) {
    selMes.value = '';
  }

  poblarSelectEventoDashboard(asistencias);
}

// Opciones de actividad vigentes: no futuras y, si hay año/mes activos, acotadas a ese
// período — de lo contrario aparecerían actividades de otros meses/años en el listado.
function opcionesEventoDashboardDisponibles(asistencias) {
  const anio = document.getElementById('filtro_dashboard_asistencia_anio')?.value || '';
  const mes  = document.getElementById('filtro_dashboard_asistencia_mes')?.value || '';
  const ahora = Date.now();

  const eventos = new Map();
  asistencias.forEach(a => {
    if (anio && claveAnioDashboardAsistencia(a.fecha_evento) !== anio) return;
    if (mes && claveMesDashboardAsistencia(a.fecha_evento) !== mes) return;
    if (!eventos.has(a.evento_id)) {
      eventos.set(a.evento_id, { nombre: a.evento, fecha: a.fecha_evento });
    }
  });

  return Array.from(eventos.entries())
    .filter(([, info]) => {
      const tiempo = new Date(String(info.fecha || '').replace(' ', 'T')).getTime();
      // Sin fecha válida no se puede saber si es futuro: se deja visible
      return Number.isNaN(tiempo) || tiempo <= ahora;
    })
    .sort((a, b) => {
      const tiempoA = new Date(String(a[1].fecha || '').replace(' ', 'T')).getTime();
      const tiempoB = new Date(String(b[1].fecha || '').replace(' ', 'T')).getTime();
      // Más reciente primero
      return (Number.isNaN(tiempoB) ? 0 : tiempoB) - (Number.isNaN(tiempoA) ? 0 : tiempoA);
    });
}

// Repuebla el select de actividad acotado al año/mes seleccionados actualmente. Si la
// actividad ya elegida queda fuera del nuevo período, se limpia a "Todas las actividades".
function poblarSelectEventoDashboard(asistencias) {
  const selEvento = document.getElementById('filtro_dashboard_asistencia_evento');
  if (!selEvento) return;

  const eventoPrevio = selEvento.value;
  const opcionesEventos = opcionesEventoDashboardDisponibles(asistencias);

  selEvento.innerHTML = '<option value="">Todas las actividades</option>' +
    opcionesEventos.map(([id, info]) => `<option value="${id}">${info.nombre}</option>`).join('');

  selEvento.value = opcionesEventos.some(([id]) => String(id) === eventoPrevio)
    ? eventoPrevio
    : '';
}

function filtrarAsistenciasDashboard(asistencias) {
  const anio   = document.getElementById('filtro_dashboard_asistencia_anio')?.value || '';
  const mes    = document.getElementById('filtro_dashboard_asistencia_mes')?.value || '';
  const evento = document.getElementById('filtro_dashboard_asistencia_evento')?.value || '';

  return asistencias.filter(a => (
    (!anio || claveAnioDashboardAsistencia(a.fecha_evento) === anio) &&
    (!mes || claveMesDashboardAsistencia(a.fecha_evento) === mes) &&
    (!evento || String(a.evento_id) === evento)
  ));
}

function actualizarVistaAsistenciaDashboard(asistencias) {
  const evento = document.getElementById('filtro_dashboard_asistencia_evento')?.value || '';
  actualizarEstadisticasAsistenciaDashboard(filtrarAsistenciasDashboard(asistencias), Boolean(evento));
}

function renderizarAsistenciaDashboard(asistencias) {
  poblarFiltrosDashboardAsistencia(asistencias);
  actualizarVistaAsistenciaDashboard(asistencias);
}

function configurarFiltrosDashboardAsistencia() {
  const selAnio   = document.getElementById('filtro_dashboard_asistencia_anio');
  const selMes    = document.getElementById('filtro_dashboard_asistencia_mes');
  const selEvento = document.getElementById('filtro_dashboard_asistencia_evento');

  const asistenciasActuales = () => Array.isArray(asistenciasTabla) ? asistenciasTabla : [];
  const rerenderizar = () => actualizarVistaAsistenciaDashboard(asistenciasActuales());

  if (selAnio) {
    selAnio.addEventListener('change', () => {
      // Si el mes puntual elegido no pertenece al año recién seleccionado, se limpia
      // para no dejar una combinación contradictoria (mostraría "sin registros").
      if (selMes && selMes.value && selAnio.value && selMes.value.split('-')[0] !== selAnio.value) {
        selMes.value = '';
      }
      // Las actividades disponibles dependen del período: se recalculan al vuelo
      poblarSelectEventoDashboard(asistenciasActuales());
      rerenderizar();
    });
  }

  if (selMes) {
    selMes.addEventListener('change', () => {
      // Elegir un mes puntual sincroniza el año correspondiente
      if (selAnio && selMes.value) {
        const anioDelMes = selMes.value.split('-')[0];
        if (Array.from(selAnio.options).some(o => o.value === anioDelMes)) {
          selAnio.value = anioDelMes;
        }
      }
      poblarSelectEventoDashboard(asistenciasActuales());
      rerenderizar();
    });
  }

  if (selEvento) {
    selEvento.addEventListener('change', rerenderizar);
  }
}

// =====================================
// ESTADISTICAS ASISTENCIA POR BLOQUE
// =====================================

// Vista simplificada para cuando el dashboard está filtrado por una actividad puntual:
// Presente/Ausente por bloque (Presente incluye a los atrasados, mismo criterio que
// usa el desglose por tipo de evento).
function renderizarAsistenciaPorBloquePresenteAusente(asistencias, contenedor) {
  const porBloque = {};

  asistencias.forEach(a => {
    if (esBloqueExcluidoDashboard(a.bloque)) return;
    const bloque = a.bloque || 'Sin Bloque';
    if (!porBloque[bloque]) porBloque[bloque] = { presentes: 0, total: 0 };
    porBloque[bloque].total++;
    if (['presente', 'atrasado'].includes(a.estado)) porBloque[bloque].presentes++;
  });

  const bloques = Object.keys(porBloque).sort();

  if (bloques.length === 0) {
    contenedor.innerHTML = '<p class="text-muted small">Sin registros de asistencia aún.</p>';
    return;
  }

  const filas = bloques.map(bloque => {
    const { presentes, total } = porBloque[bloque];
    const ausentes = total - presentes;
    const pct = total > 0 ? Math.round((presentes / total) * 100) : 0;
    const cls = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning text-dark' : 'bg-danger';
    return `
      <tr>
        <td><strong>${bloque}</strong></td>
        <td class="text-center">
          <span class="badge ${cls}">${pct}%</span>
          <small class="text-muted ms-1">${presentes}/${total}</small>
        </td>
        <td class="text-center">${ausentes}</td>
      </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Bloque</th>
            <th class="text-center">Presente</th>
            <th class="text-center">Ausente</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function actualizarEstadisticasAsistenciaDashboard(asistencias, filtradoPorEvento = false) {
  const contenedor = document.getElementById('asistencia_por_bloque');
  if (!contenedor) return;

  if (!asistencias.length) {
    contenedor.innerHTML = '<p class="text-muted small">Sin registros de asistencia aún.</p>';
    return;
  }

  // Con una actividad puntual seleccionada, ensayos/presentaciones/otras es
  // siempre la misma columna repetida (todas las filas comparten tipo_evento):
  // se muestra en cambio Presente/Ausente, que sí aporta información.
  if (filtradoPorEvento) {
    renderizarAsistenciaPorBloquePresenteAusente(asistencias, contenedor);
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
