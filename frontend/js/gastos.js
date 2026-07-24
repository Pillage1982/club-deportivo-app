let gastosCargados = [];

function normalizarTextoGasto(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function escaparHtmlGasto(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function crearGasto() {
  const descripcion = document.getElementById('gasto_descripcion').value.trim();
  const categoria   = document.getElementById('gasto_categoria').value.trim();
  const monto       = Number(document.getElementById('gasto_monto').value);
  const fecha       = document.getElementById('gasto_fecha').value;
  const responsable = document.getElementById('gasto_responsable').value.trim();
  const archivo     = document.getElementById('gasto_comprobante').files[0] || null;

  if (!descripcion || descripcion.length < 3) {
    mostrarAlerta('Ingrese una descripción válida', 'warning');
    return;
  }

  if (!categoria) {
    mostrarAlerta('Ingrese una categoría', 'warning');
    return;
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    mostrarAlerta('El monto debe ser mayor a 0', 'warning');
    return;
  }

  if (!fecha) {
    mostrarAlerta('Seleccione una fecha válida', 'warning');
    return;
  }

  if (!archivo) {
    mostrarAlerta(
      'Se guardará sin comprobante adjunto. Se recomienda adjuntar la boleta o factura como respaldo.',
      'warning'
    );
  }

  const formData = new FormData();
  formData.append('descripcion', descripcion);
  formData.append('categoria', categoria);
  formData.append('monto', monto);
  formData.append('fecha', fecha);
  if (responsable) formData.append('responsable', responsable);
  if (archivo) formData.append('comprobante', archivo);

  const estadoBoton = bloquearBoton('btn_guardar_gasto', 'Guardando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/gastos`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: formData
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(respuesta.mensaje || 'No se pudo guardar el gasto');
      }
      return respuesta;
    })
    .then(data => {
      mostrarAlerta(data.mensaje, 'success');

      document.getElementById('gasto_descripcion').value = '';
      document.getElementById('gasto_categoria').value   = '';
      document.getElementById('gasto_monto').value        = '';
      document.getElementById('gasto_fecha').value        = '';
      document.getElementById('gasto_responsable').value  = '';
      document.getElementById('gasto_comprobante').value  = '';

      cargarTablaGastos();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(err, 'No se pudo guardar el gasto'),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(estadoBoton, 'Guardar Gasto');
    });
}

function cargarTablaGastos() {
  fetch(`${API_URL}/gastos`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }
      gastosCargados = data;
      renderizarTablaGastos(filtrarGastos(data));
    })
    .catch(err => console.error(err));
}

function filtrarGastos(gastos) {
  const busqueda = normalizarTextoGasto(
    document.getElementById('buscar_gastos')?.value
  );

  const fecha = document.getElementById('filtro_gasto_fecha')?.value || '';

  return gastos.filter(gasto => {
    const texto = normalizarTextoGasto([
      gasto.descripcion,
      gasto.categoria,
      gasto.responsable
    ].join(' '));

    const coincideBusqueda = !busqueda || texto.includes(busqueda);
    const coincideFecha = !fecha || String(gasto.fecha).substring(0, 10) === fecha;

    return coincideBusqueda && coincideFecha;
  });
}

function renderizarTablaGastos(gastos) {
  const tabla = document.getElementById('tabla_gastos');

  tabla.innerHTML = '';

  if (!gastos.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="6" class="text-center text-muted">
          No hay gastos para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = gastos.map(gasto => `
    <tr>
      <td>${formatearFecha(gasto.fecha)}</td>
      <td>${escaparHtmlGasto(gasto.categoria)}</td>
      <td>${escaparHtmlGasto(gasto.descripcion)}</td>
      <td>${formatearMonto(gasto.monto)}</td>
      <td>${gasto.responsable ? escaparHtmlGasto(gasto.responsable) : '—'}</td>
      <td class="text-nowrap">
        ${gasto.comprobante_path
          ? `<button type="button" class="btn btn-sm btn-outline-primary" title="Ver comprobante" onclick="verComprobanteGasto(${gasto.id})">
               <i class="bi bi-file-earmark-text"></i>
             </button>`
          : '<span class="text-muted small">Sin comprobante</span>'
        }
        <button type="button" class="btn btn-sm btn-outline-danger ms-1" title="Eliminar" onclick="eliminarGasto(${gasto.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosGastos() {
  renderizarTablaGastos(filtrarGastos(gastosCargados));
}

function limpiarFiltrosGastos() {
  const buscar = document.getElementById('buscar_gastos');
  const fecha  = document.getElementById('filtro_gasto_fecha');

  if (buscar) buscar.value = '';
  if (fecha)  fecha.value  = '';

  aplicarFiltrosGastos();
}

function configurarFiltrosGastos() {
  ['buscar_gastos', 'filtro_gasto_fecha'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', aplicarFiltrosGastos);
  });
}

function verComprobanteGasto(id) {
  fetch(`${API_URL}/gastos/${id}/comprobante`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) {
        const data = await leerRespuestaJson(res);
        throw new Error(data.mensaje || 'No se pudo obtener el comprobante');
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo obtener el comprobante'), 'danger');
    });
}

function eliminarGasto(id) {
  mostrarConfirmacion(
    'Esta acción eliminará el gasto y su comprobante adjunto. ¿Deseas continuar?',
    () => ejecutarEliminarGasto(id)
  );
}

function ejecutarEliminarGasto(id) {
  fetch(`${API_URL}/gastos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(data.mensaje || 'No se pudo eliminar el gasto');
      }
      return data;
    })
    .then(data => {
      mostrarAlerta(data.mensaje || 'Gasto eliminado correctamente', 'warning');
      cargarTablaGastos();
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo eliminar el gasto'), 'danger');
    });
}
