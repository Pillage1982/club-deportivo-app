// "Registro de actividad" (solo rol admin y cuenta de soporte, botón en la barra):
// muestra quién hizo cada movimiento que modificó datos, separado por módulo
// (pestañas), con filtro por usuario y rango de fechas. Lo escribe el backend
// (auditoriaMiddleware) en cada creación/edición/eliminación exitosa.

const MODULOS_AUDITORIA = [
  ['asistencia', 'Asistencia'],
  ['integrantes', 'Integrantes'],
  ['actividades', 'Actividades'],
  ['pagos', 'Pagos'],
  ['cuotas', 'Cuotas'],
  ['gastos', 'Gastos'],
  ['ingresos', 'Ingresos'],
  ['finanzas', 'Finanzas'],
  ['justificaciones', 'Justificaciones'],
  ['solicitudes', 'Solicitudes'],
  ['cartas', 'Cartas colegio'],
  ['multas', 'Multas'],
  ['puntaje', 'Puntaje'],
  ['formaciones', 'Formaciones'],
  ['portal', 'Portal del Integrante'],
  ['usuarios', 'Usuarios']
];

const ACCIONES_AUDITORIA = {
  crear: ['Creó', 'bg-success'],
  editar: ['Editó', 'bg-primary'],
  eliminar: ['Eliminó', 'bg-danger']
};

let moduloAuditoria = 'asistencia';

function abrirAuditoria() {
  cargarAuditoria();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_auditoria')).show();
}

function seleccionarModuloAuditoria(modulo) {
  moduloAuditoria = modulo;
  cargarAuditoria();
}

function limpiarFiltrosAuditoria() {
  ['auditoria_usuario', 'auditoria_desde', 'auditoria_hasta'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  cargarAuditoria();
}

function renderizarPestanasAuditoria(conteos) {
  const cont = document.getElementById('auditoria_modulos');
  cont.innerHTML = MODULOS_AUDITORIA.map(([clave, nombre]) => `
    <button type="button"
      class="btn btn-sm ${clave === moduloAuditoria ? 'btn-primary' : 'btn-outline-secondary'}"
      onclick="seleccionarModuloAuditoria('${clave}')">
      ${nombre} <span class="badge ${clave === moduloAuditoria ? 'bg-light text-dark' : 'bg-secondary'}">${conteos[clave] || 0}</span>
    </button>
  `).join('');
}

function renderizarUsuariosAuditoria(usuarios) {
  const select = document.getElementById('auditoria_usuario');
  const actual = select.value;
  select.innerHTML = '<option value="">Todos</option>' +
    usuarios.map(u => `<option value="${escaparHtml(u)}">${escaparHtml(u)}</option>`).join('');
  if (usuarios.includes(actual)) select.value = actual;
}

function textoAccionAuditoria(r) {
  const [texto, clase] = ACCIONES_AUDITORIA[r.accion] || [r.accion.replace(/-/g, ' '), 'bg-secondary'];
  return `<span class="badge ${clase} text-capitalize">${escaparHtml(texto)}</span>`;
}

// Detalle legible: integrante y actividad involucrados, mensaje del servidor y
// los datos enviados (sin claves) en un desplegable.
function detalleAuditoria(r) {
  const partes = [];
  if (r.integrante) partes.push(`<i class="bi bi-person me-1"></i>${escaparHtml(r.integrante)}`);
  if (r.actividad) partes.push(`<i class="bi bi-calendar-event me-1"></i>${escaparHtml(r.actividad)}`);
  if (r.registro_id) partes.push(`<span class="text-muted">Registro #${r.registro_id}</span>`);

  let html = partes.join(' · ');
  if (r.resultado) html += `<div class="small text-muted">${escaparHtml(r.resultado)}</div>`;

  if (r.detalle) {
    let datos = r.detalle;
    try { datos = JSON.stringify(JSON.parse(r.detalle), null, 1); } catch { /* texto truncado */ }
    html += `
      <details class="small">
        <summary class="text-muted">Datos enviados</summary>
        <pre class="mb-0 small text-wrap">${escaparHtml(datos)}</pre>
      </details>`;
  }
  return html || '<span class="text-muted">—</span>';
}

function cargarAuditoria() {
  const tabla = document.getElementById('tabla_auditoria');
  tabla.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Cargando...</td></tr>';

  const params = new URLSearchParams({ modulo: moduloAuditoria });
  const usuario = document.getElementById('auditoria_usuario').value;
  const desde = document.getElementById('auditoria_desde').value;
  const hasta = document.getElementById('auditoria_hasta').value;
  if (usuario) params.set('usuario', usuario);
  if (desde) params.set('desde', desde);
  if (hasta) params.set('hasta', hasta);

  fetch(`${API_URL}/auditoria?${params}`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo cargar el registro de actividad');
      return data;
    })
    .then(({ registros, conteos, usuarios }) => {
      renderizarPestanasAuditoria(conteos || {});
      renderizarUsuariosAuditoria(usuarios || []);

      tabla.innerHTML = registros.map(r => {
        const fecha = new Date(String(r.fecha).replace(' ', 'T'));
        const quien = r.actor_tipo === 'integrante'
          ? `<span class="badge bg-info text-dark">Integrante</span> ${escaparHtml(r.actor_nombre || '')}`
          : `<strong>${escaparHtml(r.actor_nombre || '')}</strong><div class="small text-muted">${escaparHtml(r.rol || '')}</div>`;
        return `
          <tr>
            <td class="small text-nowrap">${fecha.toLocaleDateString('es-CL')}<br>${fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</td>
            <td>${quien}</td>
            <td>${textoAccionAuditoria(r)}</td>
            <td>${detalleAuditoria(r)}</td>
          </tr>`;
      }).join('') || '<tr><td colspan="4" class="text-center text-muted">Sin movimientos para los filtros seleccionados</td></tr>';
    })
    .catch(err => {
      tabla.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${escaparHtml(err.message)}</td></tr>`;
    });
}
