// Interfaz de cuotas: generación mensual, filtros, tabla y comunicación con /api/cuotas.
// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

let cuotasCargadas = [];

function normalizarTextoCuota(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function generarCuotasMensuales() {

  mostrarConfirmacion(
    'Esta acción generará las cuotas mensuales para todos los integrantes activos. ¿Deseas continuar?',
    ejecutarGeneracionCuotas
  );

}

function ejecutarGeneracionCuotas() {

  const estadoBoton =
    bloquearBoton(
      'btn_generar_cuotas',
      'Generando...'
    );

  if (!estadoBoton) return;

  fetch(`${API_URL}/cuotas/generar-mes`, {

    method: 'POST',

    headers: getAuthHeaders()

  })

  .then(async res => {
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.mensaje || 'Error al generar cuotas');
    }

    return data;
  })

  .then(data => {
    const tipoAlerta =
      data.cuotas_creadas > 0 ? 'success' : 'warning';

    mostrarAlerta(
      `${data.mensaje}. Cuotas creadas: ${data.cuotas_creadas || 0}`,
      tipoAlerta
    );

    cargarFinanzas();
    cargarDashboard();
    cargarGraficos();
    cargarCuotas();
  })

  .catch(err => {
    console.error(err);

    mostrarAlerta(
      err.message || 'No se pudieron generar las cuotas. Intenta nuevamente.',
      'danger'
    );
  })
  .finally(() => {
    restaurarBoton(
      estadoBoton,
      'Generar cuotas del mes'
    );
  });

}

// Misma regla que el servidor: desde octubre corre la temporada nueva
// (octubre de este año a julio del siguiente); antes, la del octubre anterior.
function anioInicioTemporadaCuotas() {
  const hoy = new Date();
  return hoy.getMonth() + 1 >= 10 ? hoy.getFullYear() : hoy.getFullYear() - 1;
}

// Genera de una vez las cuotas de los 10 meses de la temporada (incluidos meses
// futuros): necesario para poder registrar un pago anual completo (art. 9.3),
// ya que un pago no puede vincularse a una cuota que todavía no existe.
function generarCuotasTemporada() {
  mostrarConfirmacion(
    `Esta acción generará las cuotas de la temporada ${anioInicioTemporadaCuotas()}-${anioInicioTemporadaCuotas() + 1} (octubre ${anioInicioTemporadaCuotas()} a julio ${anioInicioTemporadaCuotas() + 1}, 10 meses) para todos los integrantes activos, incluidos los meses futuros. Las cuotas que ya existan no se duplican. ¿Deseas continuar?`,
    ejecutarGeneracionCuotasTemporada
  );
}

function ejecutarGeneracionCuotasTemporada() {
  const estadoBoton = bloquearBoton('btn_generar_temporada', 'Generando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/cuotas/generar-temporada`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.mensaje || 'Error al generar las cuotas de la temporada');
      return data;
    })
    .then(data => {
      mostrarAlerta(`${data.mensaje}. Cuotas creadas: ${data.cuotas_creadas || 0}`, 'success');
      cargarFinanzas();
      cargarDashboard();
      cargarGraficos();
      cargarCuotas();
    })
    .catch(err => {
      console.error(err);
      mostrarAlerta(err.message || 'No se pudieron generar las cuotas de la temporada. Intenta nuevamente.', 'danger');
    })
    .finally(() => {
      restaurarBoton(estadoBoton, 'Generar cuotas de toda la temporada');
    });
}

// =====================================
// CARGAR TABLA CUOTAS
// =====================================

function cargarCuotas() {

  fetch(`${API_URL}/cuotas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar la tabla de cuotas',
    'warning'
  );
  return;
}

    cuotasCargadas = data;
    inicializarMatrizCuotas(data);

  })

  .catch(err => console.error(err));

}

// Cuota pendiente/vencida con pagos parciales: etiqueta "Abono $X" (lo pagado)
// y el saldo que falta.
function tieneAbonoCuota(cuota) {
  return cuota.estado !== 'pagado' && Number(cuota.monto_pagado) > 0;
}

function badgeAbonoCuota(cuota) {
  if (!tieneAbonoCuota(cuota)) return '';
  return ` <span class="badge bg-info text-dark">Abono ${formatearMonto(cuota.monto_pagado)}</span>`
    + `<div class="small text-muted">Saldo ${formatearMonto(cuota.saldo)}</div>`;
}

// =====================================
// MATRIZ MENSUAL DE CUOTAS (planilla estilo Excel)
// =====================================
// Pivot: integrantes (filas, agrupados por bloque y alfabético, igual que la tabla
// de Integrantes) x meses de la temporada (columnas). Cada celda es el estado de esa
// cuota del integrante. Se construye con los datos que ya entrega GET /cuotas.

const MATRIZ_MESES = [
  { mes: 10, label: 'Oct', off: 0 }, { mes: 11, label: 'Nov', off: 0 }, { mes: 12, label: 'Dic', off: 0 },
  { mes: 1, label: 'Ene', off: 1 }, { mes: 2, label: 'Feb', off: 1 }, { mes: 3, label: 'Mar', off: 1 },
  { mes: 4, label: 'Abr', off: 1 }, { mes: 5, label: 'May', off: 1 }, { mes: 6, label: 'Jun', off: 1 },
  { mes: 7, label: 'Jul', off: 1 }
];
const MATRIZ_LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
const MATRIZ_GLIFO = { ok: '✓', pend: '●', venc: '✗', abono: 'A', fut: '·' };
const MATRIZ_NOMBRE = { ok: 'Pagado', pend: 'Pendiente', venc: 'Vencido', abono: 'Abono', fut: 'Sin generar' };
const MATRIZ_ESTADO_FILTRO = { pagado: 'ok', pendiente: 'pend', vencido: 'venc', abono: 'abono' };

// Año de inicio de la temporada (oct→jul) a la que pertenece una cuota.
function anioInicioDeCuota(cuota) {
  return Number(cuota.mes) >= 10 ? Number(cuota.anio) : Number(cuota.anio) - 1;
}

// Estado de celda: 'ok' | 'abono' | 'venc' | 'pend' | 'fut' (sin cuota ese mes).
function estadoCeldaCuota(cuota) {
  if (!cuota) return 'fut';
  if (cuota.estado === 'pagado') return 'ok';
  if (Number(cuota.monto_pagado) > 0) return 'abono';
  if (cuota.estado === 'vencido') return 'venc';
  return 'pend';
}

// Llena los selectores de temporada y bloque desde los datos y dibuja la matriz.
function inicializarMatrizCuotas(cuotas) {
  const temporadas = [...new Set(cuotas.map(anioInicioDeCuota))].sort((a, b) => b - a);
  const vigente = anioInicioTemporadaCuotas();

  const selTemp = document.getElementById('filtro_cuota_temporada');
  if (selTemp) {
    const previa = selTemp.value;
    selTemp.innerHTML = (temporadas.length ? temporadas : [vigente])
      .map(a => `<option value="${a}">${a}-${a + 1}</option>`).join('');
    if (previa && temporadas.includes(Number(previa))) selTemp.value = previa;
    else if (temporadas.includes(vigente)) selTemp.value = String(vigente);
  }

  const selBloque = document.getElementById('filtro_cuota_bloque');
  if (selBloque) {
    const previo = selBloque.value;
    const bloques = [...new Set(cuotas.map(c => c.bloque || ''))]
      .sort((a, b) => (!a !== !b) ? (a ? -1 : 1) : a.localeCompare(b, 'es'));
    selBloque.innerHTML = '<option value="">Todos</option>'
      + bloques.map(b => `<option value="${escaparHtml(b)}">${escaparHtml(b || 'Sin bloque')}</option>`).join('');
    if (previo) selBloque.value = previo;
  }

  renderizarMatrizCuotas();
}

function renderizarMatrizCuotas() {
  const cont = document.getElementById('matriz_cuotas_wrapper');
  if (!cont) return;

  const anioInicio = Number(document.getElementById('filtro_cuota_temporada')?.value) || anioInicioTemporadaCuotas();
  const busqueda = normalizarTextoCuota(document.getElementById('buscar_cuotas')?.value);
  const fBloque = document.getElementById('filtro_cuota_bloque')?.value || '';
  const fEstado = MATRIZ_ESTADO_FILTRO[document.getElementById('filtro_cuota_estado')?.value] || '';

  // Pivot: una fila por integrante con sus cuotas de la temporada elegida.
  const porPersona = new Map();
  cuotasCargadas.forEach(c => {
    if (anioInicioDeCuota(c) !== anioInicio) return;
    let p = porPersona.get(c.persona_id);
    if (!p) {
      p = {
        nombre: `${c.nombres} ${c.apellido_paterno} ${c.apellido_materno || ''}`.trim(),
        bloque: c.bloque || '',
        celdas: {}
      };
      porPersona.set(c.persona_id, p);
    }
    p.celdas[c.mes] = c;
  });

  let filas = [...porPersona.values()];
  if (busqueda) filas = filas.filter(p => normalizarTextoCuota(p.nombre).includes(busqueda));
  if (fBloque) filas = filas.filter(p => (p.bloque || '') === fBloque);
  if (fEstado) filas = filas.filter(p => MATRIZ_MESES.some(m => estadoCeldaCuota(p.celdas[m.mes]) === fEstado));

  // Orden: bloque (alfabético, "Sin bloque" al final), luego nombre (como Integrantes).
  filas.sort((a, b) => {
    const ba = (a.bloque || '').toLowerCase(), bb = (b.bloque || '').toLowerCase();
    if (!ba !== !bb) return ba ? -1 : 1;
    if (ba !== bb) return ba.localeCompare(bb, 'es');
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
  });

  if (!filas.length) {
    cont.innerHTML = `<div class="pc-empty">No hay cuotas de la temporada ${anioInicio}-${anioInicio + 1} para los filtros seleccionados</div>`;
    return;
  }

  const colLetras = MATRIZ_MESES.map((_, i) => `<th>${MATRIZ_LETRAS[i + 1]}</th>`).join('')
    + `<th>${MATRIZ_LETRAS[MATRIZ_MESES.length + 1]}</th>`;
  const colMeses = MATRIZ_MESES.map(m =>
    `<th>${m.label}<span class="pc-anio">'${String(m.off ? anioInicio + 1 : anioInicio).slice(2)}</span></th>`).join('');

  const totMes = new Array(MATRIZ_MESES.length).fill(0);
  let totDeuda = 0, bloqueActual = null, num = 1, cuerpo = '';

  filas.forEach(p => {
    if ((p.bloque || '') !== bloqueActual) {
      bloqueActual = p.bloque || '';
      cuerpo += `<tr class="pc-block"><td class="pc-rownum"></td>`
        + `<td colspan="${MATRIZ_MESES.length + 2}"><i class="bi bi-people-fill me-2"></i>${escaparHtml(p.bloque || 'Sin bloque')}</td></tr>`;
    }
    let deuda = 0;
    const celdas = MATRIZ_MESES.map((m, i) => {
      const c = p.celdas[m.mes];
      const est = estadoCeldaCuota(c);
      if (c) {
        if (est === 'ok') totMes[i] += Number(c.monto);
        else if (est === 'abono') { totMes[i] += Number(c.monto_pagado); deuda += Number(c.saldo); }
        else deuda += Number(c.saldo);
      }
      const titulo = c
        ? `${m.label} · ${MATRIZ_NOMBRE[est]} · ${formatearMonto(c.monto)}`
        : `${m.label} · Sin generar`;
      return `<td class="pc-mc pc-${est}" title="${titulo}">${MATRIZ_GLIFO[est]}</td>`;
    }).join('');
    totDeuda += deuda;
    const deudaTxt = deuda > 0
      ? `<span class="pc-d-si">${formatearMonto(deuda)}</span>`
      : `<span class="pc-d-no">al día</span>`;
    cuerpo += `<tr><td class="pc-rownum">${num++}</td>`
      + `<td class="pc-colname">${escaparHtml(p.nombre)}</td>${celdas}`
      + `<td class="pc-deuda">${deudaTxt}</td></tr>`;
  });

  const recaudado = totMes.reduce((a, b) => a + b, 0);
  const pie = `<tr>
      <td class="pc-tlabel" colspan="2">Recaudado · total ${formatearMonto(recaudado)}</td>
      ${totMes.map(t => `<td>${t ? formatearMonto(t) : '—'}</td>`).join('')}
      <td>${totDeuda ? formatearMonto(totDeuda) : '—'}</td>
    </tr>`;

  cont.innerHTML = `
    <div class="pc-scroll">
      <table class="pc-table">
        <thead>
          <tr class="pc-cols"><th class="pc-cTL"></th><th class="pc-cNAME">A</th>${colLetras}</tr>
          <tr class="pc-titles"><th class="pc-cTL2"></th><th class="pc-cNAME2">Integrante</th>${colMeses}<th>Deuda</th></tr>
        </thead>
        <tbody>${cuerpo}</tbody>
        <tfoot>${pie}</tfoot>
      </table>
    </div>`;
}

function limpiarFiltrosCuotas() {
  ['buscar_cuotas', 'filtro_cuota_bloque', 'filtro_cuota_estado'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderizarMatrizCuotas();
}

function configurarFiltrosCuotas() {
  ['buscar_cuotas', 'filtro_cuota_bloque', 'filtro_cuota_estado', 'filtro_cuota_temporada'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', renderizarMatrizCuotas);
  });
}

// =====================================
// APLICAR SALDOS A FAVOR
// =====================================
// Primero calcula sin escribir (vista previa) y pide confirmación con el detalle;
// recién al confirmar se aplican los saldos a las cuotas pendientes más antiguas.

function aplicarSaldosAFavor() {
  const estadoBoton = bloquearBoton('btn_aplicar_saldos', 'Calculando...');
  if (!estadoBoton) return;

  enviarAplicacionSaldos(true)
    .then(data => {
      const r = data.resumen;
      if (!r.monto) {
        mostrarAlerta('No hay saldos a favor por aplicar.', 'info');
        return;
      }
      mostrarConfirmacion(
        `Se aplicarán ${formatearMonto(r.monto)} de saldo a favor de ${r.integrantes} integrante(s): `
          + `${r.cuotas_pagadas} cuota(s) quedarán pagadas y ${r.cuotas_abonadas} con abono. ¿Deseas continuar?`,
        ejecutarAplicacionSaldos
      );
    })
    .catch(err => mostrarAlerta(obtenerMensajeError(err, 'No se pudieron calcular los saldos a favor'), 'danger'))
    .finally(() => restaurarBoton(estadoBoton, 'Aplicar saldos a favor'));
}

function ejecutarAplicacionSaldos() {
  enviarAplicacionSaldos(false)
    .then(data => {
      const r = data.resumen;
      mostrarAlerta(`Saldo a favor aplicado: ${formatearMonto(r.monto)} (${r.cuotas_pagadas} cuota(s) pagadas, ${r.cuotas_abonadas} con abono).`, 'success');
      cargarCuotas();
      cargarFinanzas();
      cargarTablaPagos();
      cargarDashboard();
    })
    .catch(err => mostrarAlerta(obtenerMensajeError(err, 'No se pudieron aplicar los saldos a favor'), 'danger'));
}

function enviarAplicacionSaldos(simular) {
  return fetch(`${API_URL}/cuotas/aplicar-saldos-favor`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ simular })
  }).then(async res => {
    const data = await leerRespuestaJson(res);
    if (!res.ok) throw new Error(data.mensaje || 'Error con los saldos a favor');
    return data;
  });
}
