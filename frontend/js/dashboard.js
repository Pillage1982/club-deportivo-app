// =====================================
// INSTANCIAS GRAFICOS CHART.JS
// =====================================

let chartDeuda = null;

// =====================================
// CARGAR RESUMEN GENERAL DASHBOARD
// =====================================

function cargarDashboard() {

  const rol =
    obtenerRolActual();

  const solicitudes =
    obtenerSolicitudesDashboard(rol);

  Promise.all(
    Object.values(solicitudes)
  )

  .then(resultados => {
    const claves =
      Object.keys(solicitudes);

    const data =
      claves.reduce((acumulado, clave, index) => {
        acumulado[clave] = resultados[index];
        return acumulado;
      }, {});

    const datos = prepararDatosDashboard({
      personas: data.personas,
      multas: data.multas,
      finanzas: data.finanzas,
      eventos: data.eventos,
      asistencias: data.asistencias,
      cuotas: data.cuotas,
      gastos: data.gastos
    });

    aplicarDashboardPorRol(datos);

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
    cuotas: Promise.resolve([]),
    gastos: Promise.resolve([])
  };

  if (rol === 'admin' || rol === 'tesorero') {
    solicitudes.multas =
      obtenerJsonDashboard('/multas');

    solicitudes.finanzas =
      obtenerJsonDashboard('/finanzas');

    solicitudes.cuotas =
      obtenerJsonDashboard('/cuotas');

    solicitudes.gastos =
      obtenerJsonDashboard('/gastos');
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

  const gastos =
    Array.isArray(data.gastos) ? data.gastos : [];

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

  const cuotasPendientes =
    cuotas.filter(cuota => {
      return cuota.estado === 'pendiente' ||
        cuota.estado === 'vencido';
    }).length;

  const totalGastosMes =
    gastos
      .filter(gasto => {
        const fechaGasto = new Date(gasto.fecha);
        return (
          !Number.isNaN(fechaGasto.getTime()) &&
          fechaGasto.getMonth() === fechaActual.getMonth() &&
          fechaGasto.getFullYear() === fechaActual.getFullYear()
        );
      })
      .reduce((suma, gasto) => suma + Number(gasto.monto || 0), 0);

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
    totalGastosMes,
    eventos
  };
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
  eventosCalendario = datos.eventos;
  renderizarCalendarioActividades();

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
        label: '<i class="bi bi-cash-coin"></i> Gastos (mes)',
        value: formatearMonto(datos.totalGastosMes),
        color: 'text-bg-secondary'
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

    // Destruye el gráfico anterior
    // para evitar duplicados visuales
    if (chartDeuda) {
      chartDeuda.destroy();
    }

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

// =====================================
// CALENDARIO MENSUAL DE ACTIVIDADES
// =====================================

let eventosCalendario = [];
let mesCalendario = new Date();
mesCalendario.setDate(1);

const MESES_CALENDARIO = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DIAS_CALENDARIO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function cambiarMesCalendario(delta) {
  mesCalendario.setMonth(mesCalendario.getMonth() + delta);
  renderizarCalendarioActividades();
}

// La fecha llega como 'YYYY-MM-DD HH:MM:SS' (dateStrings): se lee tal cual
// para no desplazar el día por zona horaria.
function obtenerClaveDiaEvento(fecha) {
  return String(fecha || '').substring(0, 10);
}

function obtenerHoraEvento(fecha) {
  const hora = String(fecha || '').substring(11, 16);
  return hora && hora !== '00:00' ? hora : '';
}

function claveDia(anio, mes, dia) {
  return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function renderizarCalendarioActividades() {
  const contenedor =
    document.getElementById('calendario_actividades');

  const titulo =
    document.getElementById('calendario_titulo');

  if (!contenedor || !titulo) {
    return;
  }

  const anio = mesCalendario.getFullYear();
  const mes = mesCalendario.getMonth();

  titulo.innerText = `${MESES_CALENDARIO[mes]} ${anio}`;

  const eventosPorDia = {};

  eventosCalendario.forEach(evento => {
    const clave = obtenerClaveDiaEvento(evento.fecha);
    (eventosPorDia[clave] = eventosPorDia[clave] || []).push(evento);
  });

  Object.values(eventosPorDia).forEach(lista => {
    lista.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  });

  const hoy = new Date();
  const claveHoy = claveDia(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // Semana parte en lunes: getDay() 0 = domingo -> columna 6
  const desfase = (new Date(anio, mes, 1).getDay() + 6) % 7;
  const diasMes = new Date(anio, mes + 1, 0).getDate();

  contenedor.innerHTML = '';

  DIAS_CALENDARIO.forEach(nombre => {
    const cabecera = document.createElement('div');
    cabecera.className = 'calendario-dia-semana';
    cabecera.innerText = nombre;
    contenedor.appendChild(cabecera);
  });

  for (let i = 0; i < desfase; i++) {
    const vacio = document.createElement('div');
    vacio.className = 'calendario-dia calendario-dia-vacio';
    contenedor.appendChild(vacio);
  }

  for (let dia = 1; dia <= diasMes; dia++) {
    const clave = claveDia(anio, mes, dia);
    const celda = document.createElement('div');

    celda.className = 'calendario-dia';

    if (clave === claveHoy) {
      celda.classList.add('calendario-hoy');
    }

    const numero = document.createElement('span');
    numero.className = 'calendario-numero';
    numero.innerText = dia;
    celda.appendChild(numero);

    (eventosPorDia[clave] || []).forEach(evento => {
      const hora = obtenerHoraEvento(evento.fecha);
      const item = document.createElement('div');

      item.className = `calendario-evento calendario-evento-${evento.tipo}`;
      item.innerText = hora ? `${hora} ${evento.nombre}` : evento.nombre;
      item.title = [
        obtenerTipoActividad(evento.tipo),
        evento.nombre,
        hora,
        evento.ubicacion
      ].filter(Boolean).join(' · ');

      celda.appendChild(item);
    });

    contenedor.appendChild(celda);
  }
}
