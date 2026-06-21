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

    const coincideEstado =
      !estado || cuota.estado === estado;

    const coincideMes =
      !mes || String(cuota.mes) === String(Number(mes));

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
          ${
            cuota.estado === 'pagado'
            ? '<span class="badge bg-success">Pagado</span>'
            : cuota.estado === 'vencido'
            ? '<span class="badge bg-danger">Vencido</span>'
            : '<span class="badge bg-warning text-dark">Pendiente</span>'
          }
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
