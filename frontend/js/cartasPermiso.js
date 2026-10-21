// Panel "Cartas colegio": cartas de permiso para el colegio (Fiesta de Ayquina)
// pedidas desde el Portal del Integrante. Solo las ven y resuelven los roles admin y
// secretaria (exactos) y la cuenta de soporte. Al aprobar, el backend emite el PDF
// firmado y lo envía al correo del integrante; al rechazar, le avisa el motivo.

let cacheCartasPermiso = [];
let cartaPermisoEnRevision = null;

function puedeRevisarCartasPermiso() {
  try {
    const usuario = JSON.parse(localStorage.getItem('usuario')) || {};
    return ['admin', 'secretaria'].includes(usuario.rol) || Boolean(usuario.es_soporte);
  } catch {
    return false;
  }
}

function folioCartaPermiso(id) {
  return String(id).padStart(5, '0');
}

function nombreAlumnoCarta(c) {
  return [c.nombres, c.apellido_paterno, c.apellido_materno].filter(Boolean).join(' ');
}

function badgeEstadoCartaPermiso(c) {
  if (c.estado === 'aprobada') return crearBadge('Aprobada', 'bg-success');
  if (c.estado === 'rechazada') return crearBadge('Rechazada', 'bg-danger');
  return crearBadge('Pendiente', 'bg-warning text-dark');
}

function actualizarBadgeCartasPermiso() {
  fetch(`${API_URL}/cartas-permiso?estado=pendiente`, { headers: getAuthHeaders() })
    .then(res => (res.ok ? res.json() : []))
    .then(data => {
      const badge = document.getElementById('badge_cartas_permiso');
      if (!badge || !Array.isArray(data)) return;
      badge.textContent = data.length;
      badge.classList.toggle('d-none', data.length === 0);
    })
    .catch(() => {});
}

function cargarCartasPermiso() {
  const estado = document.getElementById('filtro_cartas_permiso_estado')?.value || '';
  const query = estado ? `?estado=${encodeURIComponent(estado)}` : '';

  fetch(`${API_URL}/cartas-permiso${query}`, { headers: getAuthHeaders() })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar las cartas de permiso');
      return data;
    })
    .then(data => {
      cacheCartasPermiso = Array.isArray(data) ? data : [];
      renderizarTablaCartasPermiso();
    })
    .catch(err => mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger'));

  actualizarBadgeCartasPermiso();
}

function renderizarTablaCartasPermiso() {
  const tabla = document.getElementById('tabla_cartas_permiso');
  const busqueda = String(document.getElementById('buscar_cartas_permiso')?.value || '').trim().toLowerCase();

  const filas = cacheCartasPermiso.filter(c => !busqueda || [
    nombreAlumnoCarta(c), c.rut, c.colegio, c.curso, folioCartaPermiso(c.id)
  ].join(' ').toLowerCase().includes(busqueda));

  if (!filas.length) {
    tabla.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay cartas de permiso</td></tr>';
    return;
  }

  tabla.innerHTML = filas.map(c => {
    const pendiente = c.estado === 'pendiente';
    const acciones = pendiente
      ? `<button type="button" class="btn btn-sm btn-success" onclick="abrirRevisionCartaPermiso(${c.id}, 'aprobar')">
           <i class="bi bi-check-circle"></i> Aprobar
         </button>
         <button type="button" class="btn btn-sm btn-outline-danger" onclick="abrirRevisionCartaPermiso(${c.id}, 'rechazar')">
           <i class="bi bi-x-circle"></i> Rechazar
         </button>`
      : `<button type="button" class="btn btn-sm btn-outline-secondary" onclick="abrirRevisionCartaPermiso(${c.id})">
           <i class="bi bi-eye"></i> Ver
         </button>
         ${c.estado === 'aprobada' ? `
         <button type="button" class="btn btn-sm btn-outline-primary" title="Ver PDF" aria-label="Ver PDF"
           onclick="verPdfCartaPermiso(${c.id}, this)"><i class="bi bi-file-earmark-pdf"></i></button>` : ''}`;

    return `
      <tr>
        <td>${folioCartaPermiso(c.id)}${c.email_enviado ? '' : '<i class="bi bi-envelope-x text-warning ms-1" title="El aviso a secretaría no se pudo enviar"></i>'}</td>
        <td>${formatearFechaHora(c.creado_en)}</td>
        <td>${escaparHtml(nombreAlumnoCarta(c))}<div class="small text-muted">${escaparHtml(c.rut)}</div></td>
        <td>${escaparHtml(c.colegio)}<div class="small text-muted">${escaparHtml(c.curso)}</div></td>
        <td class="text-nowrap">${formatearFecha(c.fecha_desde)} al ${formatearFecha(c.fecha_hasta)}</td>
        <td>${badgeEstadoCartaPermiso(c)}${c.estado === 'aprobada' && !c.email_carta_enviado
          ? '<i class="bi bi-envelope-x text-warning ms-1" title="La carta no se pudo enviar por correo"></i>' : ''}</td>
        <td class="text-nowrap">${acciones}</td>
      </tr>`;
  }).join('');
}

// accion: 'aprobar' o 'rechazar' según el botón (solo ubica el foco); sin accion,
// la carta ya revisada se abre en modo lectura.
function abrirRevisionCartaPermiso(id, accion) {
  const c = cacheCartasPermiso.find(item => item.id === id);
  if (!c) return;
  cartaPermisoEnRevision = c;
  const pendiente = c.estado === 'pendiente';

  document.getElementById('revisar_cp_folio').textContent = folioCartaPermiso(c.id);
  document.getElementById('revisar_cp_detalle').innerHTML = `
    <dl class="row mb-0">
      <dt class="col-sm-4">Alumno</dt>
      <dd class="col-sm-8">${escaparHtml(nombreAlumnoCarta(c))} — ${escaparHtml(c.rut)}</dd>
      <dt class="col-sm-4">Colegio</dt>
      <dd class="col-sm-8">${escaparHtml(c.colegio)}</dd>
      <dt class="col-sm-4">Director/a</dt>
      <dd class="col-sm-8">${escaparHtml(c.director)}</dd>
      <dt class="col-sm-4">Curso</dt>
      <dd class="col-sm-8">${escaparHtml(c.curso)}</dd>
      <dt class="col-sm-4">Permiso</dt>
      <dd class="col-sm-8">${formatearFecha(c.fecha_desde)} al ${formatearFecha(c.fecha_hasta)}</dd>
      <dt class="col-sm-4">Correo</dt>
      <dd class="col-sm-8">${escaparHtml(c.email || 'Sin email registrado')}</dd>
      <dt class="col-sm-4">Recibida</dt>
      <dd class="col-sm-8">${formatearFechaHora(c.creado_en)}</dd>
      ${!pendiente ? `
      <dt class="col-sm-4">Resolución</dt>
      <dd class="col-sm-8">${badgeEstadoCartaPermiso(c)} ${c.revisado_por_usuario ? `por ${escaparHtml(c.revisado_por_usuario)}` : ''} ${c.revisado_en ? `el ${formatearFechaHora(c.revisado_en)}` : ''}</dd>
      ${c.codigo_verificacion ? `
      <dt class="col-sm-4">Código</dt>
      <dd class="col-sm-8"><code>${escaparHtml(c.codigo_verificacion)}</code></dd>` : ''}
      ${c.observacion_directiva ? `
      <dt class="col-sm-4">Observación</dt>
      <dd class="col-sm-8">${escaparHtml(c.observacion_directiva)}</dd>` : ''}` : ''}
    </dl>
  `;

  document.getElementById('revisar_cp_observacion').value = '';
  document.getElementById('revisar_cp_acciones').classList.toggle('d-none', !pendiente);
  document.getElementById('revisar_cp_footer').classList.toggle('d-none', !pendiente);

  const modal = document.getElementById('modal_revisar_carta_permiso');
  modal.addEventListener('shown.bs.modal', () => {
    if (accion === 'rechazar') document.getElementById('revisar_cp_observacion').focus();
    else if (accion === 'aprobar') document.getElementById('btn_aprobar_carta_permiso').focus();
  }, { once: true });
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

function resolverCartaPermiso(accion) {
  const c = cartaPermisoEnRevision;
  if (!c) return;

  const observacion = document.getElementById('revisar_cp_observacion').value.trim();
  if (accion === 'rechazar' && !observacion) {
    mostrarAlerta('Escribe el motivo del rechazo en "Observación": se le informa al integrante.', 'warning');
    document.getElementById('revisar_cp_observacion').focus();
    return;
  }

  const botones = ['btn_aprobar_carta_permiso', 'btn_rechazar_carta_permiso'];
  botones.forEach(id => { document.getElementById(id).disabled = true; });

  fetch(`${API_URL}/cartas-permiso/${c.id}/${accion}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ observacion })
  })
    .then(async res => {
      const data = await leerRespuestaJson(res);
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo guardar la revisión');
      return data;
    })
    .then(data => {
      bootstrap.Modal.getInstance(document.getElementById('modal_revisar_carta_permiso'))?.hide();
      mostrarAlerta(escaparHtml(data.mensaje), 'success');
      cargarCartasPermiso();
    })
    .catch(err => mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger'))
    .finally(() => {
      botones.forEach(id => { document.getElementById(id).disabled = false; });
    });
}

// El PDF exige el token: se descarga con fetch y se abre como blob en otra pestaña
// (abierta antes del fetch para que el navegador no la bloquee).
function verPdfCartaPermiso(id, boton) {
  const pestana = window.open('', '_blank');
  if (boton) boton.disabled = true;

  fetch(`${API_URL}/cartas-permiso/${id}/pdf`, { headers: getAuthHeaders() })
    .then(async res => {
      if (!res.ok) {
        const data = await leerRespuestaJson(res);
        throw new Error(data.mensaje || 'No se pudo generar la carta');
      }
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      if (pestana) {
        pestana.location.href = url;
      } else {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = `Carta_permiso_${folioCartaPermiso(id)}.pdf`;
        enlace.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      if (pestana) pestana.close();
      mostrarAlerta(escaparHtml(obtenerMensajeError(err)), 'danger');
    })
    .finally(() => { if (boton) boton.disabled = false; });
}

document.addEventListener('DOMContentLoaded', () => {
  if (!puedeRevisarCartasPermiso()) return;

  document.getElementById('nav_subtab_cartas_permiso')?.classList.remove('d-none');
  actualizarBadgeCartasPermiso();

  document.querySelector('[href="#subtab_cartas_permiso"]')
    ?.addEventListener('shown.bs.tab', cargarCartasPermiso);
  document.getElementById('filtro_cartas_permiso_estado')
    ?.addEventListener('change', cargarCartasPermiso);
  document.getElementById('buscar_cartas_permiso')
    ?.addEventListener('input', renderizarTablaCartasPermiso);
});
