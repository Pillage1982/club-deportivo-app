// =====================================
// GENERAR CUOTAS MENSUALES
// =====================================

let cuotasCargadas = [];

function normalizarTextoCuota(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
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

// =====================================
// CARGAR TABLA CUOTAS
// =====================================

function cargarCuotas() {

  fetch(`${API_URL}/cuotas`, {

    headers: getAuthHeaders()

  })

  .then(res => res.json())

  .then(data => {

    const tabla =
      document.getElementById(
        'tabla_cuotas'
      );

    if (!tabla) return;

    tabla.innerHTML = '';

    if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar la tabla de cuotas',
    'warning'
  );
  return;
}

    cuotasCargadas = data;
    renderizarTablaCuotas(
      filtrarCuotas(data)
    );

  })

  .catch(err => console.error(err));

}

function filtrarCuotas(cuotas) {
  const busqueda =
    normalizarTextoCuota(
      document.getElementById('buscar_cuotas')?.value
    );

  const estado =
    document.getElementById('filtro_cuota_estado')?.value || '';

  const mes =
    document.getElementById('filtro_cuota_mes')?.value || '';

  const anio =
    document.getElementById('filtro_cuota_anio')?.value || '';

  return cuotas.filter(cuota => {
    const nombreCompleto = normalizarTextoCuota([
      cuota.nombres,
      cuota.apellido_paterno,
      cuota.apellido_materno
    ].join(' '));

    const coincideBusqueda =
      !busqueda || nombreCompleto.includes(busqueda);

    // "Con abono": cuota aún no pagada que ya tiene pagos parciales.
    const coincideEstado =
      !estado ||
      (estado === 'con_abono'
        ? cuota.estado !== 'pagado' && Number(cuota.monto_pagado) > 0
        : cuota.estado === estado);

    // filtro_cuota_mes es un <input type="month"> ('AAAA-MM'): fija mes y año.
    const [anioMes, numeroMes] = String(mes).split('-');
    const coincideMes =
      !mes || (String(cuota.anio) === anioMes && Number(cuota.mes) === Number(numeroMes));

    const coincideAnio =
      !anio || String(cuota.anio) === anio;

    return (
      coincideBusqueda &&
      coincideEstado &&
      coincideMes &&
      coincideAnio
    );
  });
}

function renderizarTablaCuotas(cuotas) {
  const tabla =
    document.getElementById(
      'tabla_cuotas'
    );

  if (!tabla) return;

  tabla.innerHTML = '';

  if (!cuotas.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          No hay cuotas para los filtros seleccionados
        </td>
      </tr>
    `;

    return;
  }

  cuotas.forEach(cuota => {

    tabla.innerHTML += `

      <tr>

        <td>
          ${cuota.nombres}
          ${cuota.apellido_paterno}
          ${cuota.apellido_materno || ''}
        </td>

        <td>
          ${formatearMonto(cuota.monto)}
        </td>

        <td>
          ${cuota.mes}
        </td>

        <td>
          ${cuota.anio}
        </td>

        <td>
          ${formatearFecha(cuota.fecha_vencimiento)}
        </td>

        <td>
          ${obtenerBadgeCuota(cuota.estado)}
          ${cuota.estado !== 'pagado' && Number(cuota.monto_pagado) > 0
            ? `<span class="badge bg-info text-dark ms-1" title="Saldo ${formatearMonto(cuota.saldo)}">Abono ${formatearMonto(cuota.monto_pagado)}</span>`
            : ''}
        </td>

      </tr>

    `;

  });
}

function aplicarFiltrosCuotas() {
  renderizarTablaCuotas(
    filtrarCuotas(cuotasCargadas)
  );
}

function limpiarFiltrosCuotas() {
  [
    'buscar_cuotas',
    'filtro_cuota_estado',
    'filtro_cuota_mes',
    'filtro_cuota_anio'
  ].forEach(id => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.value = '';
    }
  });

  aplicarFiltrosCuotas();
}

function configurarFiltrosCuotas() {
  [
    'buscar_cuotas',
    'filtro_cuota_estado',
    'filtro_cuota_mes',
    'filtro_cuota_anio'
  ].forEach(id => {
    const elemento =
      document.getElementById(id);

    if (!elemento) {
      return;
    }

    const evento =
      elemento.tagName === 'SELECT'
        ? 'change'
        : 'input';

    elemento.addEventListener(
      evento,
      aplicarFiltrosCuotas
    );
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
