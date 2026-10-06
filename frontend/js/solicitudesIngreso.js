// Panel admin "Solicitudes": postulaciones enviadas desde el botón "Súmate a la
// promesa" del sitio gdcayquina.cl. Aceptar crea el integrante con los datos
// básicos (el resto lo completa él en su primer ingreso al Portal del Socio);
// en ambos casos el backend avisa al postulante por correo.

let cacheSolicitudes = [];
let solicitudEnRevision = null;
let filtrosSolicitudesConfigurados = false;

function inicializarSolicitudesIngreso() {
  if (!filtrosSolicitudesConfigurados) {
    filtrosSolicitudesConfigurados = true;
    document.getElementById('filtro_solicitudes_estado')
      ?.addEventListener('change', cargarSolicitudesIngreso);
    document.getElementById('buscar_solicitudes')
      ?.addEventListener('input', renderizarTablaSolicitudes);
  }
  cargarSolicitudesIngreso();
}

function actualizarBadgeSolicitudes() {
  fetch(`${API_URL}/solicitudes-ingreso?estado=pendiente`, { headers: getAuthHeaders() })
    .then(res => (res.ok ? res.json() : []))
    .then(data => {
      const badge = document.getElementById('badge_solicitudes');
      if (!badge || !Array.isArray(data)) return;
      badge.textContent = data.length;
      badge.classList.toggle('d-none', data.length === 0);
    })
    .catch(() => {});
}

function cargarSolicitudesIngreso() {
  const estado = document.getElementById('filtro_solicitudes_estado')?.value || '';
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  fetch(`${API_URL}/solicitudes-ingreso${query}`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar las solicitudes');
      return data;
    })
    .then(data => {
      cacheSolicitudes = Array.isArray(data) ? data : [];
      renderizarTablaSolicitudes();
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    });

  actualizarBadgeSolicitudes();
}

function nombreSolicitante(s) {
  return `${s.nombres} ${s.apellido_paterno} ${s.apellido_materno || ''}`.trim();
}

function edadSolicitante(fechaNacimiento) {
  const [anio, mes, dia] = String(fechaNacimiento || '').substring(0, 10).split('-').map(Number);
  if (!anio) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
  return edad;
}

function badgeEstadoSolicitud(s) {
  if (s.estado === 'aprobada') return crearBadge('Aceptada', 'bg-success');
  if (s.estado === 'rechazada') return crearBadge('Rechazada', 'bg-danger');
  return crearBadge('Pendiente', 'bg-warning text-dark');
}

function filtrarSolicitudes() {
  const texto = (document.getElementById('buscar_solicitudes')?.value || '').toLowerCase().trim();
  if (!texto) return cacheSolicitudes;

  return cacheSolicitudes.filter(s => [
    nombreSolicitante(s), s.rut, s.comparsa_interes, folioJustificacion(s.id)
  ].some(v => String(v || '').toLowerCase().includes(texto)));
}

function renderizarTablaSolicitudes() {
  const tabla = document.getElementById('tabla_solicitudes');
  if (!tabla) return;
  const filas = filtrarSolicitudes();

  if (!filas.length) {
    tabla.innerHTML = '<tr><td colspan="8" class="text-center text-muted">No hay solicitudes</td></tr>';
    return;
  }

  tabla.innerHTML = filas.map(s => {
    const edad = edadSolicitante(s.fecha_nacimiento);
    const correo = s.email_enviado
      ? ''
      : '<i class="bi bi-envelope-x text-warning ms-1" title="El correo a la directiva no se pudo enviar"></i>';
    const pendiente = s.estado === 'pendiente';

    return `
      <tr>
        <td>${folioJustificacion(s.id)}${correo}</td>
        <td>${formatearFechaHora(s.creado_en)}</td>
        <td>${escaparHtml(nombreSolicitante(s))}<div class="small text-muted">${escaparHtml(s.rut)}</div></td>
        <td>${edad ?? '—'}${s.nombre_apoderado ? ' ' + crearBadge('Menor', 'bg-info text-dark') : ''}</td>
        <td>${escaparHtml(s.comparsa_interes || '—')}</td>
        <td class="small">${escaparHtml(s.telefono)}<br>${escaparHtml(s.email)}</td>
        <td>${badgeEstadoSolicitud(s)}</td>
        <td class="text-nowrap">
          <button type="button" class="btn btn-sm ${pendiente ? 'btn-primary' : 'btn-outline-secondary'}" onclick="abrirRevisionSolicitud(${s.id})">
            <i class="bi bi-${pendiente ? 'pencil-square' : 'eye'}"></i> ${pendiente ? 'Revisar' : 'Ver'}
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function abrirRevisionSolicitud(id) {
  const s = cacheSolicitudes.find(item => item.id === id);
  if (!s) return;
  solicitudEnRevision = s;

  const pendiente = s.estado === 'pendiente';
  const edad = edadSolicitante(s.fecha_nacimiento);

  document.getElementById('revisar_sol_folio').textContent = folioJustificacion(s.id);
  document.getElementById('revisar_sol_detalle').innerHTML = `
    <dl class="row mb-0">
      <dt class="col-sm-4">Postulante</dt>
      <dd class="col-sm-8">${escaparHtml(nombreSolicitante(s))} — ${escaparHtml(s.rut)}</dd>
      <dt class="col-sm-4">Nacimiento</dt>
      <dd class="col-sm-8">${formatearFecha(s.fecha_nacimiento)}${edad !== null ? ` (${edad} años)` : ''}</dd>
      <dt class="col-sm-4">Contacto</dt>
      <dd class="col-sm-8">${escaparHtml(s.telefono)} · ${escaparHtml(s.email)}</dd>
      <dt class="col-sm-4">Comparsa de interés</dt>
      <dd class="col-sm-8">${escaparHtml(s.comparsa_interes || '—')}</dd>
      ${s.mensaje ? `
      <dt class="col-sm-4">Mensaje</dt>
      <dd class="col-sm-8" style="white-space: pre-wrap;">${escaparHtml(s.mensaje)}</dd>` : ''}
      ${s.nombre_apoderado ? `
      <dt class="col-sm-4">Apoderado</dt>
      <dd class="col-sm-8">${escaparHtml(s.nombre_apoderado)} — ${escaparHtml(s.rut_apoderado)} · ${escaparHtml(s.telefono_apoderado)}</dd>` : ''}
      <dt class="col-sm-4">Recibida</dt>
      <dd class="col-sm-8">${formatearFechaHora(s.creado_en)}</dd>
      ${!pendiente ? `
      <dt class="col-sm-4">Resolución</dt>
      <dd class="col-sm-8">${badgeEstadoSolicitud(s)} ${s.revisado_por_usuario ? `por ${escaparHtml(s.revisado_por_usuario)}` : ''} ${s.revisado_en ? `el ${formatearFechaHora(s.revisado_en)}` : ''}</dd>
      ${s.observacion_directiva ? `
      <dt class="col-sm-4">Mensaje enviado</dt>
      <dd class="col-sm-8">${escaparHtml(s.observacion_directiva)}</dd>` : ''}` : ''}
    </dl>
  `;

  document.getElementById('revisar_sol_acciones').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_sol_footer').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_sol_bloque').value = '';
  document.getElementById('revisar_sol_observacion').value = '';

  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_revisar_solicitud')).show();
}

function resolverSolicitudIngreso(accion) {
  const s = solicitudEnRevision;
  if (!s) return;

  const confirmacion = accion === 'aprobar'
    ? `¿Aceptar a ${nombreSolicitante(s)} como integrante activo?`
    : `¿Rechazar la solicitud de ${nombreSolicitante(s)}? Se le enviará un aviso por correo.`;
  if (!confirm(confirmacion)) return;

  const botones = ['btn_aprobar_solicitud', 'btn_rechazar_solicitud'];
  botones.forEach(id => { document.getElementById(id).disabled = true; });

  fetch(`${API_URL}/solicitudes-ingreso/${s.id}/${accion}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      bloque: document.getElementById('revisar_sol_bloque').value.trim(),
      observacion: document.getElementById('revisar_sol_observacion').value.trim()
    })
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar la revisión');
      return data;
    })
    .then(data => {
      bootstrap.Modal.getInstance(document.getElementById('modal_revisar_solicitud'))?.hide();
      mostrarAlerta(escaparHtml(data.mensaje), 'success');
      cargarSolicitudesIngreso();
      // Un integrante nuevo: refrescar la lista de Integrantes del panel.
      if (accion === 'aprobar' && typeof cargarPersonas === 'function') {
        invalidarCacheApi('personas');
        cargarPersonas();
      }
    })
    .catch(err => {
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    })
    .finally(() => {
      botones.forEach(id => { document.getElementById(id).disabled = false; });
    });
}
