// Formaciones finales GDC: genera y congela el orden por puntaje dentro de cada bloque.
let formacionesInicializadas = false;

function escaparFormacion(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

async function respuestaFormacion(respuesta) {
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.mensaje || 'No se pudo completar la operación');
  return data;
}

async function inicializarFormaciones() {
  const puedeEditar = ['admin', 'entrenador'].includes(obtenerRolActual());
  document.getElementById('formacion_generador')?.classList.toggle('d-none', !puedeEditar);
  if (!formacionesInicializadas) {
    const selectorEvento = document.getElementById('formacion_evento_id');
    selectorEvento?.addEventListener('change', cargarFormaciones);
    await Promise.all([cargarEventosFormacion(), cargarBloquesFormacion()]);
    formacionesInicializadas = true;
  }
  cargarFormaciones();
}

async function cargarEventosFormacion() {
  const selector = document.getElementById('formacion_evento_id');
  if (!selector) return;
  try {
    const eventos = await respuestaFormacion(await fetch(`${API_URL}/formaciones/eventos`, { headers: getAuthHeaders() }));
    selector.innerHTML = '<option value="">Seleccione una actividad</option>';
    eventos.forEach(evento => {
      const option = document.createElement('option');
      option.value = evento.id;
      option.textContent = `${String(evento.fecha || '').substring(0, 10)} · ${evento.nombre}`;
      selector.appendChild(option);
    });
  } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

async function cargarBloquesFormacion() {
  const selector = document.getElementById('formacion_bloque');
  if (!selector) return;
  try {
    const bloques = await respuestaFormacion(await fetch(`${API_URL}/formaciones/bloques`, { headers: getAuthHeaders() }));
    selector.innerHTML = '<option value="">Seleccione un bloque</option>';
    bloques.forEach(({ bloque }) => {
      const option = document.createElement('option');
      option.value = bloque;
      option.textContent = bloque;
      selector.appendChild(option);
    });
  } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

async function generarFormacion() {
  const eventoId = Number(document.getElementById('formacion_evento_id')?.value);
  const bloque = document.getElementById('formacion_bloque')?.value || '';
  const observaciones = document.getElementById('formacion_observaciones')?.value || '';
  if (!eventoId || !bloque) return mostrarAlerta('Seleccione una actividad y un bloque.', 'warning');
  try {
    const resultado = await respuestaFormacion(await fetch(`${API_URL}/formaciones/generar`, {
      method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ evento_id: eventoId, bloque, observaciones })
    }));
    mostrarAlerta(`${resultado.mensaje}: ${resultado.cantidad} bailarines.`, 'success');
    await cargarFormaciones();
  } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

async function cargarFormaciones() {
  const contenedor = document.getElementById('contenedor_formaciones');
  const eventoId = Number(document.getElementById('formacion_evento_id')?.value);
  if (!contenedor) return;
  if (!eventoId) {
    contenedor.innerHTML = '<div class="text-center text-muted py-4">Seleccione una actividad para ver sus formaciones.</div>';
    return;
  }
  contenedor.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div> Cargando...</div>';
  try {
    const formaciones = await respuestaFormacion(await fetch(`${API_URL}/formaciones?evento_id=${eventoId}`, { headers: getAuthHeaders() }));
    renderizarFormaciones(formaciones);
  } catch (error) {
    contenedor.innerHTML = `<div class="alert alert-danger">${escaparFormacion(error.message)}</div>`;
  }
}

function renderizarFormaciones(formaciones) {
  const contenedor = document.getElementById('contenedor_formaciones');
  if (!contenedor) return;
  if (!formaciones.length) {
    contenedor.innerHTML = '<div class="text-center text-muted py-4">Esta actividad todavía no tiene formaciones.</div>';
    return;
  }
  const esAdmin = obtenerRolActual() === 'admin';
  contenedor.innerHTML = formaciones.map(formacion => {
    const confirmada = formacion.estado === 'confirmada';
    const filas = [];
    for (let inicio = 0; inicio < formacion.posiciones.length; inicio += 8) {
      const grupo = formacion.posiciones.slice(inicio, inicio + 8);
      filas.push(`<div class="mb-3"><div class="small fw-bold text-uppercase text-muted mb-2">${inicio === 0 ? 'Frente' : `Fila ${inicio / 8}`}</div>
        <div class="row row-cols-2 row-cols-md-4 row-cols-xl-8 g-2">${grupo.map(posicion => tarjetaPosicion(formacion, posicion, confirmada)).join('')}</div></div>`);
    }
    const acciones = esAdmin
      ? confirmada
        ? `<button class="btn btn-sm btn-outline-warning" onclick="cambiarEstadoFormacion(${formacion.id},'reabrir')"><i class="bi bi-unlock"></i> Reabrir</button>`
        : `<button class="btn btn-sm btn-success" onclick="cambiarEstadoFormacion(${formacion.id},'confirmar')"><i class="bi bi-check2-circle"></i> Confirmar final</button>
           <button class="btn btn-sm btn-outline-danger" onclick="eliminarFormacion(${formacion.id})"><i class="bi bi-trash"></i></button>`
      : '';
    return `<section class="card mb-4 shadow-sm">
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div><strong>${escaparFormacion(formacion.bloque)}</strong> <span class="badge ${confirmada ? 'bg-success' : 'bg-warning text-dark'}">${escaparFormacion(formacion.estado)}</span>
          <div class="small text-muted">Ranking: ${escaparFormacion(String(formacion.fecha_ranking || '').replace('T', ' '))} · ${formacion.posiciones.length} bailarines</div></div>
        <div class="d-flex gap-2">${acciones}</div>
      </div>
      <div class="card-body">${filas.join('')}${formacion.observaciones ? `<div class="small text-muted mt-2"><strong>Observaciones:</strong> ${escaparFormacion(formacion.observaciones)}</div>` : ''}</div>
    </section>`;
  }).join('');
}

function tarjetaPosicion(formacion, posicion, confirmada) {
  const nombre = `${posicion.nombres} ${posicion.apellido_paterno} ${posicion.apellido_materno || ''}`.trim();
  const puedeEditar = ['admin', 'entrenador'].includes(obtenerRolActual());
  const controles = confirmada || !puedeEditar ? '' : `<div class="btn-group btn-group-sm mt-2" role="group">
    <button class="btn btn-outline-secondary" title="Subir" onclick="moverPosicion(${formacion.id},${posicion.id},'arriba')"><i class="bi bi-arrow-left"></i></button>
    <button class="btn btn-outline-secondary" title="Bajar" onclick="moverPosicion(${formacion.id},${posicion.id},'abajo')"><i class="bi bi-arrow-right"></i></button>
  </div>`;
  return `<div class="col"><div class="card h-100 text-center ${posicion.ajuste_manual ? 'border-warning' : ''}">
    <div class="card-body p-2"><div class="badge bg-dark mb-1">${posicion.orden_general}</div>
      <div class="small fw-semibold">${escaparFormacion(nombre)}</div><div class="small text-muted">${Number(posicion.puntaje_utilizado)} pts</div>${controles}</div>
  </div></div>`;
}

async function moverPosicion(formacionId, posicionId, direccion) {
  try {
    await respuestaFormacion(await fetch(`${API_URL}/formaciones/${formacionId}/mover`, {
      method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ posicion_id: posicionId, direccion })
    }));
    await cargarFormaciones();
  } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

async function cambiarEstadoFormacion(id, accion) {
  try {
    const resultado = await respuestaFormacion(await fetch(`${API_URL}/formaciones/${id}/${accion}`, { method: 'PATCH', headers: getAuthHeaders() }));
    mostrarAlerta(resultado.mensaje, 'success');
    await cargarFormaciones();
  } catch (error) { mostrarAlerta(error.message, 'danger'); }
}

function eliminarFormacion(id) {
  if (!window.confirm('La formación y sus posiciones serán eliminadas. ¿Desea continuar?')) return;
  (async () => {
    try {
      const resultado = await respuestaFormacion(await fetch(`${API_URL}/formaciones/${id}`, { method: 'DELETE', headers: getAuthHeaders() }));
      mostrarAlerta(resultado.mensaje, 'success');
      await cargarFormaciones();
    } catch (error) { mostrarAlerta(error.message, 'danger'); }
  })();
}
