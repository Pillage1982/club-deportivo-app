// Panel admin "Justificaciones": cartas enviadas desde el Portal del Socio
// (pestaña Documentos). La directiva revisa y aprueba o rechaza cada carta; al
// aprobar, el backend deja la asistencia en justificado/licencia_medica, borra la
// multa pendiente y recalcula el puntaje. Debajo, las postulaciones a bloques
// (solo registro: la decisión la toman los caporales fuera del sistema).

let cacheJustificaciones = [];
let justificacionEnRevision = null;
let filtrosJustificacionesConfigurados = false;

const ETIQUETA_REFERENCIA_JUST = {
  ensayo: 'Ensayo',
  reunion: 'Reunión',
  salida: 'Salida',
  otro: 'Otro'
};

const ETIQUETA_TIPO_JUST_ADMIN = {
  justificado: 'Justificación',
  licencia_medica: 'Licencia médica'
};

function folioJustificacion(id) {
  return String(id).padStart(5, '0');
}

function inicializarJustificaciones() {
  configurarFiltrosJustificaciones();
  cargarJustificaciones();
  cargarPostulacionesBloque();
}

function configurarFiltrosJustificaciones() {
  if (filtrosJustificacionesConfigurados) return;
  filtrosJustificacionesConfigurados = true;

  document.getElementById('filtro_justificaciones_estado')
    ?.addEventListener('change', cargarJustificaciones);
  document.getElementById('buscar_justificaciones')
    ?.addEventListener('input', renderizarTablaJustificaciones);
}

// Contador de pendientes en la pestaña (se llama al iniciar y tras cada revisión).
function actualizarBadgeJustificaciones() {
  fetch(`${API_URL}/justificaciones?estado=pendiente`, { headers: getAuthHeaders() })
    .then(res => (res.ok ? res.json() : []))
    .then(data => {
      const badge = document.getElementById('badge_justificaciones');
      if (!badge || !Array.isArray(data)) return;
      badge.textContent = data.length;
      badge.classList.toggle('d-none', data.length === 0);
    })
    .catch(() => {});
}

function cargarJustificaciones() {
  const estado = document.getElementById('filtro_justificaciones_estado')?.value || '';
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  fetch(`${API_URL}/justificaciones${query}`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar las justificaciones');
      return data;
    })
    .then(data => {
      cacheJustificaciones = Array.isArray(data) ? data : [];
      renderizarTablaJustificaciones();
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    });

  actualizarBadgeJustificaciones();
}

function nombreIntegranteJust(j) {
  return `${j.nombres} ${j.apellido_paterno} ${j.apellido_materno || ''}`.trim();
}

function actividadJustificacion(j) {
  return j.evento
    ? `${j.evento} (${formatearFechaHora(j.fecha_evento)})`
    : `${ETIQUETA_REFERENCIA_JUST[j.referencia] || 'Otro'}: ${j.referencia_otro || '—'} (${formatearFecha(j.fecha_actividad)})`;
}

function badgeEstadoJustificacion(j) {
  if (j.estado === 'aprobada') {
    return crearBadge(`Aprobada · ${ETIQUETA_TIPO_JUST_ADMIN[j.estado_aplicado] || ''}`, 'bg-success');
  }
  if (j.estado === 'rechazada') return crearBadge('Rechazada', 'bg-danger');
  return crearBadge('Pendiente', 'bg-warning text-dark');
}

function filtrarJustificaciones() {
  const texto = (document.getElementById('buscar_justificaciones')?.value || '').toLowerCase().trim();
  if (!texto) return cacheJustificaciones;

  return cacheJustificaciones.filter(j => [
    nombreIntegranteJust(j), j.rut, actividadJustificacion(j), folioJustificacion(j.id), j.bloque
  ].some(v => String(v || '').toLowerCase().includes(texto)));
}

function renderizarTablaJustificaciones() {
  const tabla = document.getElementById('tabla_justificaciones');
  if (!tabla) return;
  const filas = filtrarJustificaciones();

  if (!filas.length) {
    tabla.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay justificaciones</td></tr>';
    return;
  }

  tabla.innerHTML = filas.map(j => {
    const motivo = String(j.motivo || '');
    const motivoCorto = motivo.length > 80 ? `${motivo.substring(0, 80)}…` : motivo;
    const correo = j.email_enviado
      ? ''
      : '<i class="bi bi-envelope-x text-warning ms-1" title="El correo a la directiva no se pudo enviar"></i>';

    return `
      <tr>
        <td>${folioJustificacion(j.id)}${correo}</td>
        <td>${formatearFechaHora(j.creado_en)}</td>
        <td>${escaparHtml(nombreIntegranteJust(j))}<div class="small text-muted">${escaparHtml(j.rut)}${j.bloque ? ` · ${escaparHtml(j.bloque)}` : ''}</div></td>
        <td>${escaparHtml(actividadJustificacion(j))}</td>
        <td>${ETIQUETA_TIPO_JUST_ADMIN[j.tipo_solicitado] || '—'}${j.tiene_adjunto ? ' <i class="bi bi-paperclip" title="Con documento adjunto"></i>' : ''}</td>
        <td class="small">${escaparHtml(motivoCorto)}</td>
        <td>${badgeEstadoJustificacion(j)}</td>
        <td class="text-nowrap">
          <button type="button" class="btn btn-sm ${j.estado === 'pendiente' ? 'btn-primary' : 'btn-outline-secondary'}" onclick="abrirRevisionJustificacion(${j.id})">
            <i class="bi bi-${j.estado === 'pendiente' ? 'pencil-square' : 'eye'}"></i> ${j.estado === 'pendiente' ? 'Revisar' : 'Ver'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirRevisionJustificacion(id) {
  const j = cacheJustificaciones.find(item => item.id === id);
  if (!j) return;
  justificacionEnRevision = j;

  const pendiente = j.estado === 'pendiente';

  document.getElementById('revisar_just_folio').textContent = folioJustificacion(j.id);
  document.getElementById('revisar_just_detalle').innerHTML = `
    <dl class="row mb-0">
      <dt class="col-sm-4">Integrante</dt>
      <dd class="col-sm-8">${escaparHtml(nombreIntegranteJust(j))} — ${escaparHtml(j.rut)}${j.bloque ? ` (${escaparHtml(j.bloque)})` : ''}</dd>
      <dt class="col-sm-4">Condición</dt>
      <dd class="col-sm-8">${j.condicion === 'socio' ? 'Socio' : 'Bailarín'}</dd>
      <dt class="col-sm-4">Actividad</dt>
      <dd class="col-sm-8">${escaparHtml(actividadJustificacion(j))}${j.evento_id ? '' : ' <span class="badge bg-secondary">No registrada en el sistema</span>'}</dd>
      <dt class="col-sm-4">Solicita</dt>
      <dd class="col-sm-8">${ETIQUETA_TIPO_JUST_ADMIN[j.tipo_solicitado] || '—'}</dd>
      <dt class="col-sm-4">Recibida</dt>
      <dd class="col-sm-8">${formatearFechaHora(j.creado_en)}</dd>
      ${j.quien_entrega ? `
      <dt class="col-sm-4">Entregada por</dt>
      <dd class="col-sm-8">${escaparHtml(j.quien_entrega)} (no es el titular)</dd>` : ''}
      <dt class="col-sm-4">Motivo</dt>
      <dd class="col-sm-8" style="white-space: pre-wrap;">${escaparHtml(j.motivo)}</dd>
      ${j.tiene_adjunto ? `
      <dt class="col-sm-4">Respaldo</dt>
      <dd class="col-sm-8">
        <button type="button" class="btn btn-sm btn-outline-primary" onclick="verAdjuntoJustificacion(${j.id})">
          <i class="bi bi-paperclip"></i> Ver documento adjunto
        </button>
      </dd>` : ''}
      ${!pendiente ? `
      <dt class="col-sm-4">Resolución</dt>
      <dd class="col-sm-8">${badgeEstadoJustificacion(j)} ${j.revisado_por_usuario ? `por ${escaparHtml(j.revisado_por_usuario)}` : ''} ${j.revisado_en ? `el ${formatearFechaHora(j.revisado_en)}` : ''}</dd>
      ${j.observacion_directiva ? `
      <dt class="col-sm-4">Observación</dt>
      <dd class="col-sm-8">${escaparHtml(j.observacion_directiva)}</dd>` : ''}` : ''}
    </dl>
  `;

  document.getElementById('revisar_just_acciones').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_just_footer').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_just_estado').value = j.tipo_solicitado || 'justificado';
  document.getElementById('revisar_just_observacion').value = '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_revisar_justificacion')).show();
}

function resolverJustificacion(accion) {
  const j = justificacionEnRevision;
  if (!j) return;

  const observacion = document.getElementById('revisar_just_observacion').value.trim();
  const estadoAplicado = document.getElementById('revisar_just_estado').value;

  if (accion === 'rechazar' && !observacion) {
    mostrarAlerta('Escribe el motivo del rechazo en "Observación": se le informa al integrante.', 'warning');
    document.getElementById('revisar_just_observacion').focus();
    return;
  }

  const botones = ['btn_aprobar_justificacion', 'btn_rechazar_justificacion'];
  botones.forEach(id => { document.getElementById(id).disabled = true; });

  fetch(`${API_URL}/justificaciones/${j.id}/${accion}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ estado_aplicado: estadoAplicado, observacion })
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar la revisión');
      return data;
    })
    .then(data => {
      bootstrap.Modal.getInstance(document.getElementById('modal_revisar_justificacion'))?.hide();
      mostrarAlerta(escaparHtml(data.mensaje), 'success');
      cargarJustificaciones();
      // La asistencia cambió: el listado de asistencias del panel queda desactualizado.
      if (accion === 'aprobar' && typeof cargarAsistencias === 'function') cargarAsistencias();
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    })
    .finally(() => {
      botones.forEach(id => { document.getElementById(id).disabled = false; });
    });
}

function verAdjuntoJustificacion(id) {
  fetch(`${API_URL}/justificaciones/${id}/adjunto`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) {
        const data = await leerRespuestaJson(res);
        throw new Error(data.mensaje || 'No se pudo obtener el documento');
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err, 'No se pudo obtener el documento')), 'danger');
    });
}

// =====================================
// POSTULACIONES A BLOQUES
// =====================================
function cargarPostulacionesBloque() {
  fetch(`${API_URL}/justificaciones/postulaciones`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar las postulaciones');
      return data;
    })
    .then(data => {
      const tabla = document.getElementById('tabla_postulaciones');
      const filas = Array.isArray(data) ? data : [];

      if (!filas.length) {
        tabla.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay postulaciones</td></tr>';
        return;
      }

      tabla.innerHTML = filas.map(p => `
        <tr>
          <td>${folioJustificacion(p.id)}${p.email_enviado ? '' : '<i class="bi bi-envelope-x text-warning ms-1" title="El correo a los caporales no se pudo enviar"></i>'}</td>
          <td>${formatearFechaHora(p.creado_en)}</td>
          <td>${escaparHtml(nombreIntegranteJust(p))}<div class="small text-muted">${escaparHtml(p.rut)}</div></td>
          <td>${p.es_nuevo ? crearBadge('Nuevo', 'bg-info text-dark') : escaparHtml(p.bloque_actual || '—')}</td>
          <td>${escaparHtml(p.opcion_1)}</td>
          <td>${escaparHtml(p.opcion_2 || '—')}</td>
          <td class="small">${escaparHtml(p.celular || '—')}<br>${escaparHtml(p.email || '—')}</td>
        </tr>
      `).join('');
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    });
}
