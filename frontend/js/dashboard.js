// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartMultas = null;
let chartDeuda = null;

// =====================================
// CARGAR RESUMEN GENERAL DASHBOARD
// =====================================

function cargarDashboard() {
  fetch(`${API_URL}/dashboard`, { headers: getAuthHeaders() })
  .then(async res => {
    const data = await leerRespuestaJson(res);
    if (!res.ok) throw new Error(data.mensaje || 'No se pudo cargar el dashboard');
    return data;
  })
  .then(data => {
    aplicarDashboardPorRol(prepararResumenDashboard(data));
    renderizarBalanceDashboard(data.balance);
  })
  .catch(err => {
    console.error(err);
    mostrarAlerta(
      obtenerMensajeError(
        err,
        'No se pudo cargar el dashboard'
      ),
      'warning'
    );
  });
}

// =====================================
// BALANCE GENERAL / TOTAL EN CAJA
// =====================================

// El backend solo envía `balance` a admin y tesorero; sin él, la tarjeta y el
// bloque quedan ocultos (entrenador).
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
  set('balance_pagos_inscripcion', balance.pagos_inscripcion);
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
// no está registrado como pagos). Se edita en la misma fila.
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

function prepararResumenDashboard(data) {
  const resumen = (presentes, total) => ({
    presentes: Number(presentes || 0),
    total: Number(total || 0),
    porcentaje: Number(total || 0) > 0
      ? Math.round((Number(presentes || 0) / Number(total)) * 100)
      : 0
  });

  return {
    totalPersonas: Number(data.total_personas || 0),
    totalMultas: Number(data.total_multas || 0),
    totalPagado: Number(data.total_pagado || 0),
    deudaTotal: Number(data.deuda_total || 0),
    totalEventos: Number(data.total_eventos || 0),
    proximasActividades: Number(data.proximas_actividades || 0),
    totalAsistencias: Number(data.total_asistencias || 0),
    asistenciasConProblema: Number(data.asistencias_con_problema || 0),
    cuotasPendientes: Number(data.cuotas_pendientes || 0),
    asistenciaEnsayos: resumen(data.ensayos_presentes, data.ensayos_total),
    asistenciaPresentaciones: resumen(data.presentaciones_presentes, data.presentaciones_total)
  };
}

function obtenerJsonDashboard(ruta) {
  return fetch(`${API_URL}${ruta}`, {
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);

      if (!res.ok) {
        throw new Error(
          data.mensaje || `No se pudo cargar ${ruta}`
        );
      }

      return data;
    });
}

function obtenerSolicitudesDashboard(rol) {
  const solicitudes = {
    personas: obtenerJsonDashboard('/personas'),
    multas: Promise.resolve([]),
    finanzas: Promise.resolve([]),
    eventos: Promise.resolve([]),
    asistencias: Promise.resolve([]),
    cuotas: Promise.resolve([])
  };

  if (rol === 'admin' || rol === 'tesorero') {
    solicitudes.multas =
      obtenerJsonDashboard('/multas');

    solicitudes.finanzas =
      obtenerJsonDashboard('/finanzas');

    solicitudes.cuotas =
      obtenerJsonDashboard('/cuotas');
  }

  if (rol === 'admin' || rol === 'entrenador') {
    solicitudes.eventos =
      obtenerJsonDashboard('/eventos');

    solicitudes.asistencias =
      obtenerJsonDashboard('/asistencia');
  }

  return solicitudes;
}

function obtenerRolActual() {
  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  return usuario?.rol || 'admin';
}

function prepararDatosDashboard(data) {
  const personas =
    Array.isArray(data.personas) ? data.personas : [];

  const multas =
    Array.isArray(data.multas) ? data.multas : [];

  const eventos =
    Array.isArray(data.eventos) ? data.eventos : [];

  const asistencias =
    Array.isArray(data.asistencias) ? data.asistencias : [];

  const cuotas =
    Array.isArray(data.cuotas) ? data.cuotas : [];

  const finanzas =
    Array.isArray(data.finanzas) ? data.finanzas : [];

  let totalPagado = 0;
  let deudaTotal = 0;

  finanzas.forEach(finanza => {
    const deuda =
      Number(finanza.deuda_actual || 0);

    totalPagado +=
      Number(finanza.total_pagado || 0);

    deudaTotal += deuda;
  });

  const fechaActual =
    new Date();

  const proximasActividades =
    eventos.filter(evento => {
      const fechaEvento =
        new Date(evento.fecha);

      return (
        !Number.isNaN(fechaEvento.getTime()) &&
        fechaEvento >= fechaActual
      );
    }).length;

  const asistenciasConProblema =
    asistencias.filter(asistencia => {
      return [
        'ausente',
        'atrasado'
      ].includes(asistencia.estado);
    }).length;

  const asistenciaEnsayos =
    calcularResumenAsistenciaPorTipo(
      asistencias,
      ['entrenamiento']
    );

  const asistenciaPresentaciones =
    calcularResumenAsistenciaPorTipo(
      asistencias,
      ['partido']
    );

  const cuotasPendientes =
    cuotas.filter(cuota => {
      return cuota.estado === 'pendiente' ||
        cuota.estado === 'vencido';
    }).length;

  return {
    totalPersonas: personas.length,
    totalMultas: multas.length,
    totalPagado,
    deudaTotal,
    totalEventos: eventos.length,
    proximasActividades,
    totalAsistencias: asistencias.length,
    asistenciasConProblema,
    cuotasPendientes,
    asistenciaEnsayos,
    asistenciaPresentaciones
  };
}

function calcularResumenAsistenciaPorTipo(asistencias, tipos) {
  const registros =
    asistencias.filter(asistencia => {
      return tipos.includes(asistencia.tipo_evento);
    });

  const presentes =
    registros.filter(asistencia => {
      return [
        'presente',
        'atrasado'
      ].includes(asistencia.estado);
    }).length;

  const total =
    registros.length;

  return {
    presentes,
    total,
    porcentaje: total > 0
      ? Math.round((presentes / total) * 100)
      : 0
  };
}

function actualizarEstadisticasAsistenciaDashboard(datos) {
  const ensayosPorcentaje =
    document.getElementById('asistencia_ensayos_porcentaje');

  const ensayosDetalle =
    document.getElementById('asistencia_ensayos_detalle');

  const presentacionesPorcentaje =
    document.getElementById('asistencia_presentaciones_porcentaje');

  const presentacionesDetalle =
    document.getElementById('asistencia_presentaciones_detalle');

  if (
    !ensayosPorcentaje ||
    !ensayosDetalle ||
    !presentacionesPorcentaje ||
    !presentacionesDetalle
  ) {
    return;
  }

  ensayosPorcentaje.innerText =
    `${datos.asistenciaEnsayos.porcentaje}%`;

  ensayosDetalle.innerText =
    `${datos.asistenciaEnsayos.presentes} presentes de ${datos.asistenciaEnsayos.total} registros`;

  presentacionesPorcentaje.innerText =
    `${datos.asistenciaPresentaciones.porcentaje}%`;

  presentacionesDetalle.innerText =
    `${datos.asistenciaPresentaciones.presentes} presentes de ${datos.asistenciaPresentaciones.total} registros`;
}

function actualizarTarjetaDashboard(config) {
  const card =
    document.querySelector(
      `#${config.cardId} .card`
    );

  if (card) {
    card.classList.remove(
      'text-bg-primary',
      'text-bg-danger',
      'text-bg-success',
      'text-bg-warning',
      'text-bg-info',
      'text-bg-secondary'
    );

    card.classList.add(config.color);
  }

  document.getElementById(
    config.labelId
  ).innerHTML = config.label;

  document.getElementById(
    config.valueId
  ).innerText = config.value;
}

function aplicarDashboardPorRol(datos) {
  actualizarEstadisticasAsistenciaDashboard(datos);

  const rol =
    obtenerRolActual();

  const configuraciones = {
    admin: [
      {
        cardId: 'card_dashboard_integrantes',
        labelId: 'label_dashboard_integrantes',
        valueId: 'total_personas',
        label: '<i class="bi bi-people-fill"></i> Integrantes',
        value: datos.totalPersonas,
        color: 'text-bg-primary'
      },
      {
        cardId: 'card_dashboard_multas',
        labelId: 'label_dashboard_multas',
        valueId: 'total_multas',
        label: '<i class="bi bi-calendar-event"></i> Actividades',
        value: datos.totalEventos,
        color: 'text-bg-info'
      },
      {
        cardId: 'card_dashboard_pagado',
        labelId: 'label_dashboard_pagado',
        valueId: 'total_pagado',
        label: '<i class="bi bi-check2-square"></i> Asistencias',
        value: datos.totalAsistencias,
        color: 'text-bg-success'
      },
      {
        cardId: 'card_dashboard_deuda',
        labelId: 'label_dashboard_deuda',
        valueId: 'deuda_total',
        label: '<i class="bi bi-wallet2"></i> Deuda',
        value: formatearMonto(datos.deudaTotal),
        color: 'text-bg-warning'
      }
    ],

    tesorero: [
      {
        cardId: 'card_dashboard_integrantes',
        labelId: 'label_dashboard_integrantes',
        valueId: 'total_personas',
        label: '<i class="bi bi-cash-stack"></i> Pagado',
        value: formatearMonto(datos.totalPagado),
        color: 'text-bg-success'
      },
      {
        cardId: 'card_dashboard_multas',
        labelId: 'label_dashboard_multas',
        valueId: 'total_multas',
        label: '<i class="bi bi-wallet2"></i> Deuda',
        value: formatearMonto(datos.deudaTotal),
        color: 'text-bg-warning'
      },
      {
        cardId: 'card_dashboard_pagado',
        labelId: 'label_dashboard_pagado',
        valueId: 'total_pagado',
        label: '<i class="bi bi-receipt"></i> Cuotas pendientes',
        value: datos.cuotasPendientes,
        color: 'text-bg-warning'
      },
      {
        cardId: 'card_dashboard_deuda',
        labelId: 'label_dashboard_deuda',
        valueId: 'deuda_total',
        label: '<i class="bi bi-exclamation-triangle-fill"></i> Multas',
        value: datos.totalMultas,
        color: 'text-bg-danger'
      }
    ],

    entrenador: [
      {
        cardId: 'card_dashboard_integrantes',
        labelId: 'label_dashboard_integrantes',
        valueId: 'total_personas',
        label: '<i class="bi bi-people-fill"></i> Integrantes',
        value: datos.totalPersonas,
        color: 'text-bg-primary'
      },
      {
        cardId: 'card_dashboard_multas',
        labelId: 'label_dashboard_multas',
        valueId: 'total_multas',
        label: '<i class="bi bi-calendar-event"></i> Próximas',
        value: datos.proximasActividades,
        color: 'text-bg-info'
      },
      {
        cardId: 'card_dashboard_pagado',
        labelId: 'label_dashboard_pagado',
        valueId: 'total_pagado',
        label: '<i class="bi bi-check2-square"></i> Asistencias',
        value: datos.totalAsistencias,
        color: 'text-bg-success'
      },
      {
        cardId: 'card_dashboard_deuda',
        labelId: 'label_dashboard_deuda',
        valueId: 'deuda_total',
        label: '<i class="bi bi-exclamation-triangle-fill"></i> Ausentes/atrasados',
        value: datos.asistenciasConProblema,
        color: 'text-bg-warning'
      }
    ]
  };

  const tarjetas =
    configuraciones[rol] || configuraciones.admin;

  tarjetas.forEach(actualizarTarjetaDashboard);
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
    if (!Array.isArray(data)) {
      mostrarAlerta(
      data.mensaje || 'No se pudieron cargar los gráficos',
      'warning'
      );
      return;
    }

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

    const opcionesGraficos = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 10,
            font: {
              size: 10
            }
          }
        }
      }
    };

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

        },

        options: {
          ...opcionesGraficos,
          scales: {
            x: {
              ticks: {
                maxRotation: 45,
                minRotation: 25,
                font: {
                  size: 10
                }
              }
            },
            y: {
              ticks: {
                precision: 0,
                font: {
                  size: 10
                }
              }
            }
          }
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

        },

        options: opcionesGraficos

      }

    );

  })

  .catch(err => console.error(err));

}
