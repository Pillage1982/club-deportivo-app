// Panel admin "Acceso Socios": seguimiento del login del Portal del Socio.
// No hay PIN que generar: todo integrante activo entra la primera vez con su RUT
// como usuario y como clave (sin puntos ni guion) y el portal le exige crear su
// PIN de 6 dígitos, y luego debe actualizar sus datos (obligatorio). Desde aquí
// el admin ve quién ya lo hizo, restablece el acceso de quien olvidó su PIN,
// vuelve a exigir la actualización de datos y envía las instrucciones por WhatsApp.

let cacheEstadoAccesoSocios = [];

function inicializarAccesoSocios() {
  cargarEstadoAccesoSocios();
  configurarBuscadorAccesoSocios();
}

function cargarEstadoAccesoSocios() {
  fetch(`${API_URL}/socio-auth/admin/estado`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {
      cacheEstadoAccesoSocios = Array.isArray(data) ? data : [];
      renderizarTablaAccesoSocios(cacheEstadoAccesoSocios);
    })
    .catch(err => console.error('Error cargando estado de acceso de socios:', err));
}

function filtrarAccesoSocios(texto) {
  const t = (texto || '').toLowerCase().trim();
  if (!t) return cacheEstadoAccesoSocios;
  return cacheEstadoAccesoSocios.filter(p => {
    const nombre = `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.toLowerCase();
    return nombre.includes(t) || (p.rut || '').toLowerCase().includes(t);
  });
}

function configurarBuscadorAccesoSocios() {
  const input = document.getElementById('buscar_acceso_socios');
  if (!input) return;
  input.addEventListener('input', () => {
    renderizarTablaAccesoSocios(filtrarAccesoSocios(input.value));
  });
}

function renderizarTablaAccesoSocios(personas) {
  const tabla = document.getElementById('tabla_acceso_socios');
  if (!tabla) return;

  if (!personas || personas.length === 0) {
    tabla.innerHTML = `
      <tr><td colspan="6" class="text-center text-muted">No se encontraron integrantes</td></tr>
    `;
    return;
  }

  tabla.innerHTML = personas.map(p => {
    const nombre = `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim();
    const bloqueado = p.bloqueado_hasta && new Date(String(p.bloqueado_hasta).replace(' ', 'T')) > new Date();
    const estado = p.pin_propio
      ? '<span class="badge bg-success">PIN creado</span>'
      : '<span class="badge bg-secondary">Pendiente</span>';
    const datos = p.datos_actualizados
      ? `<span class="badge bg-success">Actualizados</span>${p.datos_actualizados_en ? `<div class="small text-muted">${formatearFechaHora(p.datos_actualizados_en)}</div>` : ''}`
      : '<span class="badge bg-secondary">Pendiente</span>';

    return `
      <tr>
        <td>${escaparHtml(nombre)}</td>
        <td>${p.rut || ''}</td>
        <td>
          ${estado}
          ${bloqueado ? '<span class="badge bg-danger ms-1">Bloqueado</span>' : ''}
        </td>
        <td>${datos}</td>
        <td>${p.ultimo_login ? formatearFechaHora(p.ultimo_login) : '—'}</td>
        <td class="text-nowrap">
          <a href="${construirLinkWhatsapp(p)}" target="_blank" rel="noopener" class="btn btn-sm btn-success" title="Enviar instrucciones por WhatsApp">
            <i class="bi bi-whatsapp"></i>
          </a>
          ${p.pin_propio || bloqueado ? `
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="restablecerAccesoSocio(${p.persona_id})">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Restablecer
          </button>` : ''}
          ${p.datos_actualizados ? `
          <button type="button" class="btn btn-sm btn-outline-secondary" title="Volver a exigir la actualización de datos" onclick="solicitarActualizacionDatos(${p.persona_id})">
            <i class="bi bi-arrow-repeat"></i>
          </button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

// =====================================
// RESTABLECER ACCESO (olvidó su PIN o quedó bloqueado)
// =====================================
function restablecerAccesoSocio(personaId) {
  const confirmar = confirm(
    'El PIN actual del socio dejará de servir. Su clave volverá a ser su RUT sin puntos ni guion ' +
    'y al entrar deberá crear un PIN nuevo.\n\n¿Continuar?'
  );
  if (!confirmar) return;

  fetch(`${API_URL}/socio-auth/admin/restablecer/${personaId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo restablecer el acceso');
      alert(data.mensaje);
      cargarEstadoAccesoSocios();
    })
    .catch(err => {
      console.error('Error restableciendo acceso:', err);
      alert(err.message || 'Ocurrió un error restableciendo el acceso. Intenta nuevamente.');
    });
}

// =====================================
// VOLVER A EXIGIR ACTUALIZACIÓN DE DATOS (individual, o a todos sin personaId)
// =====================================
function solicitarActualizacionDatos(personaId) {
  const confirmar = confirm(personaId
    ? 'En su próximo ingreso, el socio deberá revisar y actualizar sus datos antes de ver su página personal.\n\n¿Continuar?'
    : 'Todos los socios que ya actualizaron sus datos deberán hacerlo de nuevo en su próximo ingreso.\n\n¿Continuar?');
  if (!confirmar) return;

  const url = personaId
    ? `${API_URL}/socio-auth/admin/solicitar-actualizacion/${personaId}`
    : `${API_URL}/socio-auth/admin/solicitar-actualizacion`;

  fetch(url, { method: 'POST', headers: getAuthHeaders() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo solicitar la actualización');
      alert(data.mensaje);
      cargarEstadoAccesoSocios();
    })
    .catch(err => {
      console.error('Error solicitando actualización de datos:', err);
      alert(err.message || 'Ocurrió un error. Intenta nuevamente.');
    });
}

// Heurística simple: si el teléfono guardado no trae código de país, se asume
// Chile (+56) — es el único cliente actual. Si no hay teléfono, wa.me igual
// funciona sin número precargado (el admin elige el contacto a mano).
function formatearTelefonoWhatsapp(telefono) {
  const soloDigitos = String(telefono || '').replace(/\D/g, '');
  if (!soloDigitos) return '';
  return soloDigitos.startsWith('56') ? soloDigitos : `56${soloDigitos.replace(/^0+/, '')}`;
}

function construirLinkWhatsapp(persona) {
  const nombre = `${persona.nombres || ''} ${persona.apellido_paterno || ''}`.trim();
  const rutLimpio = String(persona.rut || '').replace(/[.\-]/g, '').toUpperCase();
  const texto = encodeURIComponent(
    `Hola ${nombre}, ya puedes entrar al Portal del Socio:\n` +
    `${window.location.origin}/socio/login.html\n\n` +
    `Usuario: tu RUT (${persona.rut})\n` +
    `Clave: tu RUT sin puntos ni guion (${rutLimpio})\n\n` +
    `Al entrar por primera vez deberás crear tu PIN personal de 6 dígitos.`
  );
  const numero = formatearTelefonoWhatsapp(persona.telefono);
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}
