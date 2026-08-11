// Formación vigente GDC: se calcula en tiempo real desde el ranking de cada bloque.
window.formacionesCargadas = [];

function escaparFormacion(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[caracter]);
}

async function inicializarFormaciones() {
  cargarFormaciones();
}

async function cargarFormaciones() {
  const contenedor = document.getElementById('contenedor_formaciones');
  if (!contenedor) return;
  contenedor.innerHTML = '<div class="text-center py-4"><div class="spinner-border spinner-border-sm"></div> Calculando ranking...</div>';
  try {
    const respuesta = await fetch(`${API_URL}/formaciones/actual`, { headers: getAuthHeaders() });
    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(data.mensaje || 'No se pudo cargar la formación vigente');
    window.formacionesCargadas = Array.isArray(data) ? data : [];
    renderizarFormacionActual(window.formacionesCargadas);
  } catch (error) {
    window.formacionesCargadas = [];
    contenedor.innerHTML = `<div class="alert alert-danger">${escaparFormacion(error.message)}</div>`;
  }
}

function renderizarFormacionActual(bloques) {
  const contenedor = document.getElementById('contenedor_formaciones');
  if (!bloques.length) {
    contenedor.innerHTML = '<div class="text-center text-muted py-4">No hay bailarines elegibles para formar.</div>';
    return;
  }
  contenedor.innerHTML = bloques.map(formacion => {
    const filas=[];
    for (let inicio=0; inicio<formacion.posiciones.length; inicio+=12) {
      const posiciones=formacion.posiciones.slice(inicio,inicio+12);
      filas.push(`<div class="mb-3"><div class="small fw-bold text-uppercase text-muted mb-2">${inicio===0?'Frente':`Fila ${inicio/8}`}</div>
        <div class="formacion-fila-estatutaria">${posiciones.map(tarjetaFormacionActual).join('')}</div></div>`);
    }
    return `<section class="card mb-4 shadow-sm"><div class="card-header">
      <strong>${escaparFormacion(formacion.bloque)}</strong>
      <span class="badge bg-primary ms-1">${formacion.posiciones.length} bailarines</span>
    </div><div class="card-body">${filas.join('')}</div></section>`;
  }).join('');
}

function tarjetaFormacionActual(posicion) {
  const nombre=`${posicion.nombres} ${posicion.apellido_paterno} ${posicion.apellido_materno || ''}`.trim();
  return `<div class="col"><div class="card h-100 text-center"><div class="card-body p-2">
    <div class="badge bg-dark mb-1">${posicion.posicion_ranking || posicion.orden_general}</div>
    <div class="small fw-semibold">${escaparFormacion(nombre)}</div>
    <div class="small text-muted">${Number(posicion.puntaje_utilizado)} pts</div>
  </div></div></div>`;
}
