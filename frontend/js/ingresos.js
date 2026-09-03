// Interfaz de ingresos: proyectos adjudicados, donaciones y premios — dinero
// que entra sin ser cuota de un socio. Mismo patron que gastos.js.
let ingresosCargados = [];

function normalizarTextoIngreso(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

function crearIngreso() {
  const descripcion = document.getElementById('ingreso_descripcion').value.trim();
  const categoria   = document.getElementById('ingreso_categoria').value.trim();
  const entidad     = document.getElementById('ingreso_entidad').value.trim();
  const monto       = Number(document.getElementById('ingreso_monto').value);
  const fecha       = document.getElementById('ingreso_fecha').value;
  const responsable = document.getElementById('ingreso_responsable').value.trim();
  const archivo     = document.getElementById('ingreso_comprobante').files[0] || null;

  if (!descripcion || descripcion.length < 3) {
    mostrarAlerta('Ingrese una descripción válida', 'warning');
    return;
  }

  if (!categoria) {
    mostrarAlerta('Ingrese una categoría (ej: Proyecto, Donación, Premio)', 'warning');
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
      'Se guardará sin comprobante adjunto. Se recomienda adjuntar el documento de adjudicación/depósito para respaldo ante la asamblea.',
      'warning'
    );
  }

  const formData = new FormData();
  formData.append('descripcion', descripcion);
  formData.append('categoria', categoria);
  if (entidad) formData.append('entidad', entidad);
  formData.append('monto', monto);
  formData.append('fecha', fecha);
  if (responsable) formData.append('responsable', responsable);
  if (archivo) formData.append('comprobante', archivo);

  const estadoBoton = bloquearBoton('btn_guardar_ingreso', 'Guardando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/ingresos`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: formData
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(respuesta.mensaje || 'No se pudo guardar el ingreso');
      }
      return respuesta;
    })
    .then(data => {
      mostrarAlerta(data.mensaje, 'success');

      document.getElementById('ingreso_descripcion').value = '';
      document.getElementById('ingreso_categoria').value   = '';
      document.getElementById('ingreso_entidad').value     = '';
      document.getElementById('ingreso_monto').value       = '';
      document.getElementById('ingreso_fecha').value       = '';
      document.getElementById('ingreso_responsable').value = '';
      document.getElementById('ingreso_comprobante').value = '';

      cargarTablaIngresos();
      cargarDashboard();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(err, 'No se pudo guardar el ingreso'),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(estadoBoton, 'Guardar Ingreso');
    });
}

function cargarTablaIngresos() {
  fetch(`${API_URL}/ingresos`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }
      ingresosCargados = data;
      renderizarTablaIngresos(filtrarIngresos(data));
    })
    .catch(err => console.error(err));
}

function filtrarIngresos(ingresos) {
  const busqueda = normalizarTextoIngreso(
    document.getElementById('buscar_ingresos')?.value
  );

  const fecha = document.getElementById('filtro_ingreso_fecha')?.value || '';

  return ingresos.filter(ingreso => {
    const texto = normalizarTextoIngreso([
      ingreso.descripcion,
      ingreso.categoria,
      ingreso.entidad,
      ingreso.responsable
    ].join(' '));

    const coincideBusqueda = !busqueda || texto.includes(busqueda);
    const coincideFecha = !fecha || String(ingreso.fecha).substring(0, 10) === fecha;

    return coincideBusqueda && coincideFecha;
  });
}

function renderizarTablaIngresos(ingresos) {
  const tabla = document.getElementById('tabla_ingresos');

  tabla.innerHTML = '';

  if (!ingresos.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-muted">
          No hay ingresos para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = ingresos.map(ingreso => `
    <tr>
      <td>${formatearFecha(ingreso.fecha)}</td>
      <td>${escaparHtml(ingreso.categoria)}</td>
      <td>${escaparHtml(ingreso.descripcion)}</td>
      <td>${ingreso.entidad ? escaparHtml(ingreso.entidad) : '—'}</td>
      <td>${formatearMonto(ingreso.monto)}</td>
      <td>${ingreso.responsable ? escaparHtml(ingreso.responsable) : '—'}</td>
      <td class="text-nowrap">
        ${ingreso.comprobante_path
          ? `<button type="button" class="btn btn-sm btn-outline-primary" title="Ver comprobante" onclick="verComprobanteIngreso(${ingreso.id})">
               <i class="bi bi-file-earmark-text"></i>
             </button>`
          : '<span class="text-muted small">Sin comprobante</span>'
        }
        <button type="button" class="btn btn-sm btn-outline-danger ms-1" title="Eliminar" onclick="eliminarIngreso(${ingreso.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosIngresos() {
  renderizarTablaIngresos(filtrarIngresos(ingresosCargados));
}

function limpiarFiltrosIngresos() {
  const buscar = document.getElementById('buscar_ingresos');
  const fecha  = document.getElementById('filtro_ingreso_fecha');

  if (buscar) buscar.value = '';
  if (fecha)  fecha.value  = '';

  aplicarFiltrosIngresos();
}

function configurarFiltrosIngresos() {
  ['buscar_ingresos', 'filtro_ingreso_fecha'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change', aplicarFiltrosIngresos);
  });
}

function verComprobanteIngreso(id) {
  fetch(`${API_URL}/ingresos/${id}/comprobante`, { headers: getAuthHeaders() })
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

function eliminarIngreso(id) {
  mostrarConfirmacion(
    'Esta acción eliminará el ingreso y su comprobante adjunto. ¿Deseas continuar?',
    () => ejecutarEliminarIngreso(id)
  );
}

function ejecutarEliminarIngreso(id) {
  fetch(`${API_URL}/ingresos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(data.mensaje || 'No se pudo eliminar el ingreso');
      }
      return data;
    })
    .then(data => {
      mostrarAlerta(data.mensaje || 'Ingreso eliminado correctamente', 'warning');
      cargarTablaIngresos();
      cargarDashboard();
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo eliminar el ingreso'), 'danger');
    });
}
