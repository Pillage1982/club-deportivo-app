// Interfaz del dashboard: carga el resumen de la API y administra las instancias de gráficos Chart.js.
// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartMultas = null;
let chartDeuda  = null;

// Mismos bloques que excluye Formaciones (backend/utils/formacionRules.js):
// socios y socios honorarios no bailan, no deben mezclarse en el desglose por bloque.
// En "Asistencia por Bloque" se agrupan en una sola fila "Socios" (ver más abajo).
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
      const nuevos = Number(data.total_personas_nuevas ?? 0);
      const antiguos = Number(data.total_personas ?? 0) - nuevos;
      set('desglose_personas', `${antiguos}/${nuevos}`);
      set('total_multas',   data.total_multas   ?? 0);
      set('total_pagado',   formatearMonto(data.pagos_mes    ?? 0));
      set('deuda_total',    formatearMonto(data.deuda_total  ?? 0));

      renderizarBalanceDashboard(data.balance);

      // Estadísticas por bloque usan asistenciasTabla ya cargado (sin fetch extra)
      renderizarAsistenciaDashboard(
        Array.isArray(asistenciasTabla) ? asistenciasTabla : []
      );
    })
    .catch(err => console.error(err));
}

// =====================================
// BALANCE GENERAL / TOTAL EN CAJA
// =====================================

// El backend solo envía `balance` a admin y tesorero; sin él, la tarjeta y el
// bloque quedan ocultos (entrenador u otro rol).
function renderizarBalanceDashboard(balance) {
  const tarjeta = document.getElementById('card_dashboard_caja');
  const bloque  = document.getElementById('dashboard_balance');

  if (!balance) {
    tarjeta?.classList.add('d-none');
    bloque?.classList.add('d-none');
    return;
  }

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = formatearMonto(val ?? 0);
  };

  saldoAnioAnteriorActual = Number(balance.saldo_anio_anterior || 0);

  set('saldo_caja',                balance.saldo_caja);
  set('balance_saldo_anterior',    balance.saldo_anio_anterior);
  set('balance_pagos_socios',      balance.pagos_socios);
  set('balance_pagos_integracion', balance.pagos_integracion);
  set('balance_ingresos_terceros', balance.ingresos_terceros);
  set('balance_total_ingresos',    balance.total_ingresos);
  set('balance_total_egresos',     balance.total_egresos);
  set('balance_saldo_caja',        balance.saldo_caja);

  const negativo = Number(balance.saldo_caja) < 0;
  const cuerpo = document.getElementById('card_dashboard_caja_body');
  cuerpo?.classList.toggle('text-bg-info', !negativo);
  cuerpo?.classList.toggle('text-bg-danger', negativo);
  document.getElementById('balance_saldo_caja')?.classList.toggle('text-danger', negativo);

  tarjeta?.classList.remove('d-none');
  bloque?.classList.remove('d-none');
}

// Saldo del año anterior: monto fijo que ingresa tesorería (dinero heredado que
// no está registrado como pagos ni ingresos). Se edita en la misma fila.
let saldoAnioAnteriorActual = 0;

function editarSaldoAnioAnterior() {
  const celda = document.getElementById('balance_saldo_anterior_celda');
  if (!celda || document.getElementById('input_saldo_anterior')) return;

  celda.dataset.original = celda.innerHTML;
  celda.innerHTML = `
    <div class="input-group input-group-sm ms-auto" style="max-width: 240px;">
      <span class="input-group-text">$</span>
      <input type="number" id="input_saldo_anterior" class="form-control text-end" step="1"
        value="${saldoAnioAnteriorActual}">
      <button type="button" class="btn btn-success" title="Guardar" aria-label="Guardar"
        onclick="guardarSaldoAnioAnterior()"><i class="bi bi-check-lg"></i></button>
      <button type="button" class="btn btn-outline-secondary" title="Cancelar" aria-label="Cancelar"
        onclick="cancelarSaldoAnioAnterior()"><i class="bi bi-x-lg"></i></button>
    </div>`;

  const input = document.getElementById('input_saldo_anterior');
  input.focus();
  input.select();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') guardarSaldoAnioAnterior();
    if (e.key === 'Escape') cancelarSaldoAnioAnterior();
  });
}

function cancelarSaldoAnioAnterior() {
  const celda = document.getElementById('balance_saldo_anterior_celda');
  if (celda?.dataset.original) celda.innerHTML = celda.dataset.original;
}

function guardarSaldoAnioAnterior() {
  const input = document.getElementById('input_saldo_anterior');
  const monto = Number(input?.value);

  if (!input || input.value.trim() === '' || !Number.isFinite(monto)) {
    mostrarAlerta('Ingrese un monto válido', 'warning');
    return;
  }

  fetch(`${API_URL}/dashboard/saldo-anio-anterior`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ monto: Math.round(monto) })
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar el saldo del año anterior');
      return data;
    })
    .then(data => {
      mostrarAlerta(data.mensaje || 'Saldo del año anterior actualizado', 'success');
      cancelarSaldoAnioAnterior();
      cargarDashboard();
    })
    .catch(err => mostrarAlerta(err.message, 'danger'));
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

// La asistencia de cada bloque se compara contra sus integrantes activos (los en
// receso no asisten), no contra los registros: estos casi siempre son solo los
// que escanearon, y así todo salía 100%. Con varias actividades en el período,
// el total esperado es integrantes × actividades.
const ESTADOS_ASISTIO_DASHBOARD = ['presente', 'atrasado', 'vestimenta_distinta'];

//
// Los que no bailan van todos a una fila "Socios": los bloques Socios y Socios
// honorarios, y los honorarios sin bloque. Un honorario que pertenece a un
// bloque de baile se cuenta en ese bloque.
const FILA_SOCIOS_DASHBOARD = 'Socios';

function personasDashboard() {
  return Array.isArray(personasTabla) && personasTabla.length
    ? personasTabla
    : (obtenerCacheApi('personas') || []);
}

function bloqueAsistenciaDashboard(bloque, esHonorario) {
  if (esBloqueExcluidoDashboard(bloque)) return FILA_SOCIOS_DASHBOARD;
  if (!bloque && Number(esHonorario) === 1) return FILA_SOCIOS_DASHBOARD;
  return bloque || 'Sin Bloque';
}

// Fila de cada integrante (por id), para ubicar sus registros de asistencia.
function filaPorPersonaDashboard() {
  return new Map(personasDashboard().map(p => [String(p.id), bloqueAsistenciaDashboard(p.bloque, p.es_honorario)]));
}

function filaAsistenciaDashboard(a, filaPorPersona) {
  return filaPorPersona.get(String(a.persona_id)) || bloqueAsistenciaDashboard(a.bloque, false);
}

function integrantesActivosPorBloqueDashboard() {
  const conteo = {};
  personasDashboard().forEach(p => {
    if ((p.estado || 'activo') !== 'activo') return;
    const bloque = bloqueAsistenciaDashboard(p.bloque, p.es_honorario);
    conteo[bloque] = (conteo[bloque] || 0) + 1;
  });
  return conteo;
}

// Bloques de baile en orden alfabético; la fila Socios al final.
function ordenarBloquesDashboard(bloques) {
  return Array.from(new Set(bloques)).sort((a, b) =>
    (a === FILA_SOCIOS_DASHBOARD) - (b === FILA_SOCIOS_DASHBOARD) ||
    a.localeCompare(b, 'es', { sensitivity: 'base' })
  );
}

function claseBadgeAsistencia(pct) {
  return pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning text-dark' : 'bg-danger';
}

// Celda "% asistieron/esperados". Sin actividades de ese tipo en el período no
// hay nada que medir: se muestra un guion en vez de un 0% en rojo. Si asistieron
// más de los esperados (integrante que pasó a receso o cambió de bloque), el
// porcentaje se limita a 100%.
function celdaAsistenciaBloque(asistieron, integrantes, actividades) {
  if (!actividades) return '<td class="text-center text-muted">—</td>';
  const esperados = integrantes * actividades;
  const pct = esperados > 0 ? Math.min(100, Math.round((asistieron / esperados) * 100)) : 0;
  return `
        <td class="text-center">
          <span class="badge ${claseBadgeAsistencia(pct)}">${pct}%</span>
          <small class="text-muted ms-1">${asistieron}/${esperados}</small>
        </td>`;
}

// Vista para cuando el dashboard está filtrado por una actividad puntual:
// cuántos integrantes de cada bloque asistieron y cuántos no.
function renderizarAsistenciaPorBloquePresenteAusente(asistencias, contenedor) {
  const integrantes = integrantesActivosPorBloqueDashboard();
  const filaPorPersona = filaPorPersonaDashboard();
  const asistieron = {};

  asistencias.forEach(a => {
    const bloque = filaAsistenciaDashboard(a, filaPorPersona);
    if (!asistieron[bloque]) asistieron[bloque] = 0;
    if (ESTADOS_ASISTIO_DASHBOARD.includes(a.estado)) asistieron[bloque]++;
  });

  const bloques = ordenarBloquesDashboard([...Object.keys(integrantes), ...Object.keys(asistieron)]);

  if (bloques.length === 0) {
    contenedor.innerHTML = '<p class="text-muted small">Sin registros de asistencia aún.</p>';
    return;
  }

  const filas = bloques.map(bloque => {
    const total = integrantes[bloque] || 0;
    const presentes = asistieron[bloque] || 0;
    return `
      <tr>
        <td><strong>${escaparHtml(bloque)}</strong> <small class="text-muted">(${total})</small></td>
        ${celdaAsistenciaBloque(presentes, total, 1)}
        <td class="text-center">${Math.max(total - presentes, 0)}</td>
      </tr>`;
  }).join('');

  contenedor.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Bloque <small class="fw-normal">(integrantes)</small></th>
            <th class="text-center">Asistieron</th>
            <th class="text-center">No asistieron</th>
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}

function tipoAsistenciaDashboard(tipoEvento) {
  if (tipoEvento === 'entrenamiento') return 'ensayos';
  if (tipoEvento === 'partido') return 'presentaciones';
  return 'otras';
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
  // se muestra en cambio Asistieron/No asistieron, que sí aporta información.
  if (filtradoPorEvento) {
    renderizarAsistenciaPorBloquePresenteAusente(asistencias, contenedor);
    return;
  }

  const integrantes = integrantesActivosPorBloqueDashboard();
  const filaPorPersona = filaPorPersonaDashboard();
  const actividades = { ensayos: new Set(), presentaciones: new Set(), otras: new Set() };
  const asistieron = {};

  asistencias.forEach(a => {
    const tipo = tipoAsistenciaDashboard(a.tipo_evento);
    actividades[tipo].add(String(a.evento_id));
    const bloque = filaAsistenciaDashboard(a, filaPorPersona);
    if (!asistieron[bloque]) asistieron[bloque] = { ensayos: 0, presentaciones: 0, otras: 0 };
    if (ESTADOS_ASISTIO_DASHBOARD.includes(a.estado)) asistieron[bloque][tipo]++;
  });

  const nE = actividades.ensayos.size;
  const nP = actividades.presentaciones.size;
  const nO = actividades.otras.size;
  const bloques = ordenarBloquesDashboard([...Object.keys(integrantes), ...Object.keys(asistieron)]);

  const filas = bloques.map(bloque => {
    const total = integrantes[bloque] || 0;
    const a = asistieron[bloque] || { ensayos: 0, presentaciones: 0, otras: 0 };
    return `
      <tr>
        <td><strong>${escaparHtml(bloque)}</strong> <small class="text-muted">(${total})</small></td>
        ${celdaAsistenciaBloque(a.ensayos, total, nE)}
        ${celdaAsistenciaBloque(a.presentaciones, total, nP)}
        ${celdaAsistenciaBloque(a.otras, total, nO)}
      </tr>`;
  }).join('');

  const encabezado = (titulo, n) =>
    `<th class="text-center">${titulo} <small class="fw-normal">(${n} ${n === 1 ? 'actividad' : 'actividades'})</small></th>`;

  contenedor.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm table-bordered align-middle mb-0">
        <thead class="table-dark">
          <tr>
            <th>Bloque <small class="fw-normal">(integrantes)</small></th>
            ${encabezado('Ensayos', nE)}
            ${encabezado('Presentaciones', nP)}
            ${encabezado('Otras actividades', nO)}
          </tr>
        </thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <p class="text-muted small mt-2 mb-0">
      Asistieron / esperados (integrantes activos del bloque × actividades del período).
      Cuentan como asistencia: presente, atrasado y vestimenta distinta.
    </p>`;
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
            ...(multasHabilitadas() ? [{ label: 'Multas', data: multas, backgroundColor: '#e15759' }] : []),
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
