// Panel admin "Justificaciones": cartas enviadas desde el Portal del Integrante
// (pestaña Documentos). La directiva revisa y aprueba o rechaza cada carta; al
// aprobar, el backend deja la asistencia en justificado/licencia_medica, borra la
// multa pendiente y recalcula el puntaje. Debajo, las postulaciones a bloques
// (solo registro: la decisión la toman los caporales fuera del sistema).

let cacheJustificaciones = [];
let justificacionEnRevision = null;
let filtrosJustificacionesConfigurados = false;

// Categorías de actividad de la agrupación ('salida' es el valor histórico de Presentación).
const ETIQUETA_REFERENCIA_JUST = {
  ensayo: 'Ensayo',
  misa: 'Misa',
  reunion: 'Reunión',
  salida: 'Presentación',
  otro: 'Otros'
};

const ETIQUETA_TIPO_JUST_ADMIN = {
  justificado: 'Justificación',
  licencia_medica: 'Licencia médica'
};

const ETIQUETA_MOTIVO_JUST_ADMIN = {
  trabajo: 'Trabajo',
  licencia_medica: 'Licencia médica',
  estudio: 'Estudio',
  otro: 'Otros'
};

// Cartas anteriores al motivo (oct-2026) solo tienen tipo_solicitado.
function motivoJustificacion(j) {
  return ETIQUETA_MOTIVO_JUST_ADMIN[j.motivo_tipo] || ETIQUETA_TIPO_JUST_ADMIN[j.tipo_solicitado] || '—';
}

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
    // Las manuales no generan correo a la directiva (la carta llegó por fuera).
    const correo = j.email_enviado || j.origen === 'manual'
      ? ''
      : '<i class="bi bi-envelope-x text-warning ms-1" title="El correo a la directiva no se pudo enviar"></i>';

    return `
      <tr>
        <td>${folioJustificacion(j.id)}${correo}</td>
        <td>${formatearFechaHora(j.creado_en)}</td>
        <td>${escaparHtml(nombreIntegranteJust(j))}<div class="small text-muted">${escaparHtml(j.rut)}${j.bloque ? ` · ${escaparHtml(j.bloque)}` : ''}</div></td>
        <td>${escaparHtml(actividadJustificacion(j))}</td>
        <td>${motivoJustificacion(j)}${j.tiene_adjunto ? ' <i class="bi bi-paperclip" title="Con documento adjunto"></i>' : ''}</td>
        <td class="small">${escaparHtml(motivoCorto)}</td>
        <td>${badgeEstadoJustificacion(j)}${j.origen === 'manual' ? ` ${crearBadge('Manual', 'bg-secondary')}` : ''}</td>
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
      <dt class="col-sm-4">Motivo</dt>
      <dd class="col-sm-8">${motivoJustificacion(j)}</dd>
      <dt class="col-sm-4">Recibida</dt>
      <dd class="col-sm-8">${formatearFechaHora(j.creado_en)}${j.origen === 'manual' ? ' <span class="badge bg-secondary">Ingresada a mano por la directiva</span>' : ''}</dd>
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

// =====================================
// JUSTIFICACIÓN MANUAL
// =====================================
// Cartas que llegan fuera del Portal (correo antiguo de la agrupación). El backend
// la deja aprobada al guardar; solo ofrece actividades de la temporada en curso y
// de hasta un mes atrás.

let integrantesJustManual = [];
let justManualConfigurado = false;

function normalizarTextoJust(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function configurarJustificacionManual() {
  if (justManualConfigurado) return;
  justManualConfigurado = true;

  document.getElementById('just_manual_buscar')
    ?.addEventListener('input', renderizarIntegrantesJustManual);
  document.getElementById('just_manual_evento')?.addEventListener('change', e => {
    document.getElementById('just_manual_otro').classList.toggle('d-none', e.target.value !== 'otro');
  });
  // Licencia médica como motivo propone registrarla así (igual que en el Portal).
  document.getElementById('just_manual_motivo_tipo')?.addEventListener('change', e => {
    document.getElementById('just_manual_estado').value =
      e.target.value === 'licencia_medica' ? 'licencia_medica' : 'justificado';
  });
}

// Filtra por nombre, apellidos o RUT (palabras en cualquier orden, sin tildes).
function renderizarIntegrantesJustManual() {
  const select = document.getElementById('just_manual_persona');
  const seleccionado = select.value;
  const palabras = normalizarTextoJust(document.getElementById('just_manual_buscar').value)
    .split(/\s+/).filter(Boolean);
  const visibles = integrantesJustManual.filter(p => palabras.every(palabra => p.busqueda.includes(palabra)));

  select.innerHTML = `<option value="">${palabras.length
    ? `${visibles.length} integrante(s) encontrado(s)`
    : 'Seleccione un integrante'}</option>`;
  visibles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.etiqueta;
    select.appendChild(opt);
  });

  select.value = palabras.length && visibles.length === 1
    ? visibles[0].id
    : (visibles.some(p => p.id === seleccionado) ? seleccionado : '');
}

function abrirJustificacionManual() {
  configurarJustificacionManual();

  fetch(`${API_URL}/justificaciones/manual/opciones`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar integrantes y actividades');
      return data;
    })
    .then(data => {
      integrantesJustManual = (data.integrantes || []).map(p => {
        const nombre = nombreIntegranteJust(p);
        return {
          id: String(p.id),
          etiqueta: `${nombre} — ${p.rut}${p.estado === 'receso' ? ' (receso)' : ''}`,
          busqueda: normalizarTextoJust(`${nombre} ${p.rut || ''} ${String(p.rut || '').replace(/[.\-]/g, '')}`)
        };
      });

      const selectEvento = document.getElementById('just_manual_evento');
      selectEvento.innerHTML = '<option value="">Seleccione la actividad</option>'
        + (data.eventos || []).map(e => `
          <option value="${e.id}">${escaparHtml(e.nombre)} (${formatearFechaHora(e.fecha)})${Number(e.finalizado) ? ' · finalizada' : ''}</option>
        `).join('')
        + '<option value="otro">Otra actividad (no registrada en el sistema)</option>';

      document.getElementById('form_justificacion_manual').reset();
      document.getElementById('just_manual_otro').classList.add('d-none');
      document.getElementById('just_manual_desde').textContent = formatearFecha(data.desde);
      document.getElementById('just_manual_fecha').min = data.desde;
      renderizarIntegrantesJustManual();

      bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_justificacion_manual')).show();
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    });
}

function registrarJustificacionManual(event) {
  event.preventDefault();

  const eventoId = document.getElementById('just_manual_evento').value;
  const datos = new FormData();
  datos.append('persona_id', document.getElementById('just_manual_persona').value);
  datos.append('condicion', document.querySelector('input[name="just_manual_condicion"]:checked')?.value || '');
  datos.append('motivo_tipo', document.getElementById('just_manual_motivo_tipo').value);
  datos.append('estado_aplicado', document.getElementById('just_manual_estado').value);
  datos.append('motivo', document.getElementById('just_manual_detalle').value.trim());
  datos.append('observacion', document.getElementById('just_manual_observacion').value.trim());

  if (eventoId === 'otro') {
    const nombre = document.getElementById('just_manual_referencia_otro').value.trim();
    const fecha = document.getElementById('just_manual_fecha').value;
    if (!nombre || !fecha) {
      mostrarAlerta('Indica el nombre y la fecha de la actividad.', 'warning');
      return;
    }
    datos.append('referencia', document.getElementById('just_manual_referencia').value);
    datos.append('referencia_otro', nombre);
    datos.append('fecha_actividad', fecha);
  } else {
    datos.append('evento_id', eventoId);
  }

  const archivo = document.getElementById('just_manual_adjunto').files[0];
  if (archivo) {
    if (archivo.size > 5 * 1024 * 1024) {
      mostrarAlerta('El archivo supera los 5 MB.', 'warning');
      return;
    }
    datos.append('adjunto', archivo);
  }

  const boton = document.getElementById('btn_guardar_just_manual');
  boton.disabled = true;

  fetch(`${API_URL}/justificaciones/manual`, {
    method: 'POST',
    headers: getAuthHeadersMultipart(),
    body: datos
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo registrar la justificación');
      return data;
    })
    .then(data => {
      bootstrap.Modal.getInstance(document.getElementById('modal_justificacion_manual'))?.hide();
      mostrarAlerta(escaparHtml(data.mensaje), 'success');
      cargarJustificaciones();
      if (typeof cargarAsistencias === 'function') cargarAsistencias();
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    })
    .finally(() => {
      boton.disabled = false;
    });
}

function verAdjuntoJustificacion(id) {
  fetch(`${API_URL}/justificaciones/${id}/adjunto`, { headers: getAuthHeaders(), cache: 'no-store' })
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

      cachePostulaciones = filas;

      if (!filas.length) {
        tabla.innerHTML = '<tr><td colspan="9" class="text-center text-muted">No hay postulaciones</td></tr>';
        return;
      }

      tabla.innerHTML = filas.map(p => {
        const pendiente = p.estado === 'pendiente';
        const acciones = pendiente
          ? `<button type="button" class="btn btn-sm btn-success" onclick="abrirRevisionPostulacion(${p.id}, 'aceptar')">
               <i class="bi bi-check-circle"></i> Aceptar
             </button>
             <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirRevisionPostulacion(${p.id}, 'rechazar')">
               <i class="bi bi-x-circle"></i> Rechazar
             </button>`
          : `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="abrirRevisionPostulacion(${p.id})">
               <i class="bi bi-eye"></i> Ver
             </button>`;

        return `
        <tr>
          <td>${folioJustificacion(p.id)}${p.email_enviado ? '' : '<i class="bi bi-envelope-x text-warning ms-1" title="El correo a los caporales no se pudo enviar"></i>'}</td>
          <td>${formatearFechaHora(p.creado_en)}</td>
          <td>${escaparHtml(nombreIntegranteJust(p))}<div class="small text-muted">${escaparHtml(p.rut)}</div></td>
          <td>${p.es_nuevo ? crearBadge('Nuevo', 'bg-info text-dark') : escaparHtml(p.bloque_actual || '—')}</td>
          <td>${escaparHtml(p.opcion_1)}</td>
          <td>${escaparHtml(p.opcion_2 || '—')}</td>
          <td class="small">${escaparHtml(p.celular || '—')}<br>${escaparHtml(p.email || '—')}</td>
          <td>${badgeEstadoPostulacion(p)}</td>
          <td class="text-nowrap">${acciones}</td>
        </tr>
      `;
      }).join('');
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    });
}

let cachePostulaciones = [];
let postulacionEnRevision = null;

function badgeEstadoPostulacion(p) {
  if (p.estado === 'aprobada') return crearBadge(`Aceptada · ${p.bloque_asignado || ''}`, 'bg-success');
  if (p.estado === 'rechazada') return crearBadge('Rechazada', 'bg-danger');
  return crearBadge('Pendiente', 'bg-warning text-dark');
}

// accion: 'aceptar' o 'rechazar' según el botón de la fila (solo ubica el foco);
// sin accion, la postulación ya revisada se abre en modo lectura.
function abrirRevisionPostulacion(id, accion) {
  const p = cachePostulaciones.find(item => item.id === id);
  if (!p) return;
  postulacionEnRevision = p;
  const pendiente = p.estado === 'pendiente';

  document.getElementById('revisar_post_folio').textContent = folioJustificacion(p.id);
  document.getElementById('revisar_post_detalle').innerHTML = `
    <dl class="row mb-0">
      <dt class="col-sm-4">Integrante</dt>
      <dd class="col-sm-8">${escaparHtml(nombreIntegranteJust(p))} — ${escaparHtml(p.rut)}</dd>
      <dt class="col-sm-4">Bloque actual</dt>
      <dd class="col-sm-8">${p.es_nuevo ? 'Nuevo (sin bloque)' : escaparHtml(p.bloque_actual || '—')}</dd>
      <dt class="col-sm-4">1ª opción</dt>
      <dd class="col-sm-8">${escaparHtml(p.opcion_1)}</dd>
      <dt class="col-sm-4">2ª opción</dt>
      <dd class="col-sm-8">${escaparHtml(p.opcion_2 || '—')}</dd>
      <dt class="col-sm-4">Recibida</dt>
      <dd class="col-sm-8">${formatearFechaHora(p.creado_en)}</dd>
      ${!pendiente ? `
      <dt class="col-sm-4">Resolución</dt>
      <dd class="col-sm-8">${badgeEstadoPostulacion(p)} ${p.revisado_por_usuario ? `por ${escaparHtml(p.revisado_por_usuario)}` : ''} ${p.revisado_en ? `el ${formatearFechaHora(p.revisado_en)}` : ''}</dd>
      ${p.observacion_directiva ? `
      <dt class="col-sm-4">Observación</dt>
      <dd class="col-sm-8">${escaparHtml(p.observacion_directiva)}</dd>` : ''}` : ''}
    </dl>
  `;

  const selector = document.getElementById('revisar_post_opcion');
  selector.innerHTML = `<option value="1">1ª opción: ${escaparHtml(p.opcion_1)}</option>` +
    (p.opcion_2 ? `<option value="2">2ª opción: ${escaparHtml(p.opcion_2)}</option>` : '');
  document.getElementById('revisar_post_observacion').value = '';
  document.getElementById('revisar_post_acciones').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_post_footer').classList.toggle('d-none', !pendiente);

  const modal = document.getElementById('modal_revisar_postulacion');
  modal.addEventListener('shown.bs.modal', () => {
    if (accion === 'rechazar') document.getElementById('revisar_post_observacion').focus();
    else if (accion === 'aceptar') selector.focus();
  }, { once: true });
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

function resolverPostulacion(accion) {
  const p = postulacionEnRevision;
  if (!p) return;

  const observacion = document.getElementById('revisar_post_observacion').value.trim();
  const opcion = Number(document.getElementById('revisar_post_opcion').value);

  if (accion === 'rechazar' && !observacion) {
    mostrarAlerta('Escribe el motivo del rechazo en "Observación": se le informa al integrante.', 'warning');
    document.getElementById('revisar_post_observacion').focus();
    return;
  }

  const botones = ['btn_aceptar_postulacion', 'btn_rechazar_postulacion'];
  botones.forEach(id => { document.getElementById(id).disabled = true; });

  fetch(`${API_URL}/justificaciones/postulaciones/${p.id}/${accion}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ opcion, observacion })
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar la revisión');
      return data;
    })
    .then(data => {
      bootstrap.Modal.getInstance(document.getElementById('modal_revisar_postulacion'))?.hide();
      mostrarAlerta(escaparHtml(data.mensaje), 'success');
      cargarPostulacionesBloque();
      // El bloque del integrante cambió: refrescar la tabla de integrantes.
      if (accion === 'aceptar' && typeof cargarTablaPersonas === 'function') {
        invalidarCacheApi('personas');
        cargarTablaPersonas();
      }
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    })
    .finally(() => {
      botones.forEach(id => { document.getElementById(id).disabled = false; });
    });
}
