// Interfaz de actas de reunión: formulario, filtros, adjuntos, tabla y eliminación.
let actasCargadas = [];

function normalizarTextoActa(valor) {
  return String(valor || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Carga en el selector del formulario solo las reuniones (eventos tipo
// 'reunion') que todavia no tienen acta registrada.
function cargarEventosDisponiblesActa() {
  const select = document.getElementById('acta_evento_id');
  if (!select) return;

  fetch(`${API_URL}/actas/eventos-disponibles`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }

      select.innerHTML = '<option value="">Seleccione la reunión</option>' +
        data.map(evento => `
          <option value="${evento.id}">
            ${escaparHtml(evento.nombre)} — ${formatearFecha(evento.fecha)}
          </option>
        `).join('');
    })
    .catch(err => console.error(err));
}

function crearActa() {
  const eventoId    = document.getElementById('acta_evento_id').value;
  const titulo      = document.getElementById('acta_titulo').value.trim();
  const contenido   = document.getElementById('acta_contenido').value.trim();
  const responsable = document.getElementById('acta_responsable').value.trim();
  const archivo     = document.getElementById('acta_archivo').files[0] || null;

  if (!eventoId) {
    mostrarAlerta('Seleccione la reunión a la que corresponde esta acta', 'warning');
    return;
  }

  if (!titulo || titulo.length < 3) {
    mostrarAlerta('Ingrese un título válido', 'warning');
    return;
  }

  if (!contenido || contenido.length < 10) {
    mostrarAlerta('Ingrese el contenido del acta (mínimo 10 caracteres)', 'warning');
    return;
  }

  if (!archivo) {
    mostrarAlerta(
      'Se guardará sin adjunto. Se recomienda adjuntar la foto/PDF del acta firmada para respaldo.',
      'warning'
    );
  }

  const formData = new FormData();
  formData.append('evento_id', eventoId);
  formData.append('titulo', titulo);
  formData.append('contenido', contenido);
  if (responsable) formData.append('responsable', responsable);
  if (archivo) formData.append('archivo', archivo);

  const estadoBoton = bloquearBoton('btn_guardar_acta', 'Guardando...');
  if (!estadoBoton) return;

  fetch(`${API_URL}/actas`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: formData
  })
    .then(async res => {
      const respuesta = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(respuesta.mensaje || 'No se pudo guardar el acta');
      }
      return respuesta;
    })
    .then(data => {
      mostrarAlerta(data.mensaje, 'success');

      document.getElementById('acta_evento_id').value = '';
      document.getElementById('acta_titulo').value = '';
      document.getElementById('acta_contenido').value = '';
      document.getElementById('acta_responsable').value = '';
      document.getElementById('acta_archivo').value = '';

      cargarEventosDisponiblesActa();
      cargarTablaActas();
    })
    .catch(err => {
      mostrarAlerta(
        obtenerMensajeError(err, 'No se pudo guardar el acta'),
        'danger'
      );
    })
    .finally(() => {
      restaurarBoton(estadoBoton, 'Guardar Acta');
    });
}

function cargarTablaActas() {
  fetch(`${API_URL}/actas`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      if (!Array.isArray(data)) {
        console.error('No llego un arreglo', data);
        return;
      }
      actasCargadas = data;
      renderizarTablaActas(filtrarActas(data));
    })
    .catch(err => console.error(err));
}

function filtrarActas(actas) {
  const busqueda = normalizarTextoActa(
    document.getElementById('buscar_actas')?.value
  );

  return actas.filter(acta => {
    const texto = normalizarTextoActa([
      acta.titulo,
      acta.evento_nombre,
      acta.responsable
    ].join(' '));

    return !busqueda || texto.includes(busqueda);
  });
}

function renderizarTablaActas(actas) {
  const tabla = document.getElementById('tabla_actas');

  tabla.innerHTML = '';

  if (!actas.length) {
    tabla.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          No hay actas para los filtros seleccionados
        </td>
      </tr>
    `;
    return;
  }

  tabla.innerHTML = actas.map(acta => `
    <tr>
      <td>${formatearFecha(acta.evento_fecha)}</td>
      <td>${escaparHtml(acta.evento_nombre)}</td>
      <td>${escaparHtml(acta.titulo)}</td>
      <td>${acta.responsable ? escaparHtml(acta.responsable) : '—'}</td>
      <td class="text-nowrap">
        <button type="button" class="btn btn-sm btn-outline-secondary" title="Ver contenido" onclick="verContenidoActa(${acta.id})">
          <i class="bi bi-eye"></i>
        </button>
        ${acta.archivo_path
          ? `<button type="button" class="btn btn-sm btn-outline-primary ms-1" title="Ver adjunto" onclick="verAdjuntoActa(${acta.id})">
               <i class="bi bi-paperclip"></i>
             </button>`
          : ''
        }
        <button type="button" class="btn btn-sm btn-outline-danger ms-1" title="Eliminar" onclick="eliminarActa(${acta.id})">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

function aplicarFiltrosActas() {
  renderizarTablaActas(filtrarActas(actasCargadas));
}

function limpiarFiltrosActas() {
  const buscar = document.getElementById('buscar_actas');
  if (buscar) buscar.value = '';
  aplicarFiltrosActas();
}

function configurarFiltrosActas() {
  const el = document.getElementById('buscar_actas');
  if (!el) return;
  el.addEventListener('input', aplicarFiltrosActas);
}

// Muestra el contenido de la minuta en un modal de solo lectura. Se escapa
// primero (evita XSS) y el contenedor usa white-space:pre-line para
// respetar los saltos de línea del texto ya escapado.
function verContenidoActa(id) {
  const acta = actasCargadas.find(a => a.id === id);
  if (!acta) return;

  mostrarInfoModal(acta.titulo, escaparHtml(acta.contenido));
}

function verAdjuntoActa(id) {
  fetch(`${API_URL}/actas/${id}/adjunto`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) {
        const data = await leerRespuestaJson(res);
        throw new Error(data.mensaje || 'No se pudo obtener el adjunto');
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo obtener el adjunto'), 'danger');
    });
}

function eliminarActa(id) {
  mostrarConfirmacion(
    'Esta acción eliminará el acta y su adjunto. ¿Deseas continuar?',
    () => ejecutarEliminarActa(id)
  );
}

function ejecutarEliminarActa(id) {
  fetch(`${API_URL}/actas/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) {
        throw new Error(data.mensaje || 'No se pudo eliminar el acta');
      }
      return data;
    })
    .then(data => {
      mostrarAlerta(data.mensaje || 'Acta eliminada correctamente', 'warning');
      cargarEventosDisponiblesActa();
      cargarTablaActas();
    })
    .catch(err => {
      mostrarAlerta(obtenerMensajeError(err, 'No se pudo eliminar el acta'), 'danger');
    });
}
