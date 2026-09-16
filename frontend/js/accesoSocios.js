// Sección admin "Acceso Socios": enrolamiento (individual y masivo) y seguimiento
// del login del Portal del Socio (RUT + PIN). Pensado para directivos sin
// afinidad informática: un botón grande, una tabla de seguimiento y un modal
// que muestra el PIN una sola vez con opción de copiar o enviar por WhatsApp.
//
// Sin emailService en esta rama (la junta no tiene correo propio todavía):
// el PIN se entrega siempre a mano, nunca por email.

let cacheEstadoAccesoSocios = [];
let pinModalActual = { pin: '', nombre: '', rut: '' };

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

function badgeAccesoSocios(condicion, textoSi, textoNo) {
  return condicion
    ? `<span class="badge bg-success">${textoSi}</span>`
    : `<span class="badge bg-secondary">${textoNo}</span>`;
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

    return `
      <tr>
        <td>${escaparHtml(nombre)}</td>
        <td>${p.rut || ''}</td>
        <td>${badgeAccesoSocios(!!p.tiene_acceso, 'Creado', 'Sin acceso')}</td>
        <td>
          ${p.tiene_acceso ? badgeAccesoSocios(!!p.pin_cambiado, 'Ya ingresó', 'Pendiente') : '—'}
          ${bloqueado ? '<span class="badge bg-danger ms-1">Bloqueado</span>' : ''}
        </td>
        <td>${p.ultimo_login ? formatearFechaHora(p.ultimo_login) : '—'}</td>
        <td>
          <button type="button" class="btn btn-sm btn-outline-primary" onclick="generarPinIndividual(${p.persona_id})">
            <i class="bi bi-key-fill me-1"></i>${p.tiene_acceso ? 'Regenerar PIN' : 'Generar PIN'}
          </button>
        </td>
      </tr>`;
  }).join('');
}

// =====================================
// ENROLAMIENTO MASIVO
// =====================================
function ejecutarEnrolamientoMasivo() {
  const confirmar = confirm(
    'Se generará un PIN nuevo para todos los integrantes activos que todavía no tienen acceso al portal.\n\n¿Continuar?'
  );
  if (!confirmar) return;

  const boton = document.getElementById('btn_enrolamiento_masivo');
  boton.disabled = true;
  boton.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Generando...';

  fetch(`${API_URL}/socio-auth/admin/enrolamiento-masivo`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      mostrarResultadoEnrolamientoMasivo(data.generados || []);
      cargarEstadoAccesoSocios();
    })
    .catch(err => {
      console.error('Error en enrolamiento masivo:', err);
      alert('Ocurrió un error generando los accesos. Intenta nuevamente.');
    })
    .finally(() => {
      boton.disabled = false;
      boton.innerHTML = '<i class="bi bi-people-fill me-2"></i>Generar accesos pendientes';
    });
}

function mostrarResultadoEnrolamientoMasivo(generados) {
  const contenedor = document.getElementById('resultado_enrolamiento_masivo');
  const tabla = document.getElementById('tabla_resultado_enrolamiento');

  if (!generados.length) {
    contenedor.style.display = 'none';
    alert('No había integrantes pendientes de acceso: todos ya lo tienen.');
    return;
  }

  tabla.innerHTML = generados.map(g => {
    const nombre = `${g.nombres} ${g.apellido_paterno} ${g.apellido_materno || ''}`.trim();
    return `
      <tr>
        <td>${escaparHtml(nombre)}</td>
        <td>${g.rut || ''}</td>
        <td><span style="font-family: monospace; letter-spacing: 2px;">${g.pin}</span></td>
        <td class="text-nowrap">
          <button type="button" class="btn btn-sm btn-outline-secondary" title="Copiar PIN" onclick="copiarTexto('${g.pin}')">
            <i class="bi bi-clipboard"></i>
          </button>
          <a href="${construirLinkWhatsapp(g)}" target="_blank" rel="noopener" class="btn btn-sm btn-success" title="Enviar por WhatsApp">
            <i class="bi bi-whatsapp"></i>
          </a>
        </td>
      </tr>`;
  }).join('');

  contenedor.style.display = 'block';
  contenedor.scrollIntoView({ behavior: 'smooth' });
}

// =====================================
// GENERAR/REGENERAR PIN INDIVIDUAL
// =====================================
function generarPinIndividual(personaId) {
  const confirmar = confirm('Se generará un PIN nuevo. El anterior dejará de servir de inmediato. ¿Continuar?');
  if (!confirmar) return;

  fetch(`${API_URL}/socio-auth/admin/generar/${personaId}`, {
    method: 'POST',
    headers: getAuthHeaders()
  })
    .then(res => res.json())
    .then(data => {
      if (!data.pin) {
        alert(data.mensaje || 'No se pudo generar el PIN');
        return;
      }
      mostrarModalPinGenerado(data.persona, data.pin);
      cargarEstadoAccesoSocios();
    })
    .catch(err => {
      console.error('Error generando PIN:', err);
      alert('Ocurrió un error generando el PIN. Intenta nuevamente.');
    });
}

function mostrarModalPinGenerado(persona, pin) {
  const nombre = `${persona.nombres} ${persona.apellido_paterno}`.trim();

  pinModalActual = { pin, nombre, rut: persona.rut };

  document.getElementById('pin_modal_nombre').textContent = nombre;
  document.getElementById('pin_modal_rut').textContent = persona.rut || '';
  document.getElementById('pin_modal_pin').textContent = pin;
  document.getElementById('pin_modal_whatsapp').href = construirLinkWhatsapp({ ...persona, pin });

  new bootstrap.Modal(document.getElementById('modal_pin_generado')).show();
}

function copiarPinModal() {
  copiarTexto(pinModalActual.pin);
}

function copiarTexto(texto) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto)
      .then(() => alert('Copiado: ' + texto))
      .catch(() => alert('No se pudo copiar. Cópialo manualmente: ' + texto));
  } else {
    alert('Cópialo manualmente: ' + texto);
  }
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
  const texto = encodeURIComponent(
    `Hola ${nombre}, tu acceso al Portal del Socio es:\n` +
    `RUT: ${persona.rut}\n` +
    `PIN: ${persona.pin}\n\n` +
    `Es personal e intransferible. Al ingresar por primera vez deberás cambiarlo.`
  );
  const numero = formatearTelefonoWhatsapp(persona.telefono);
  return numero ? `https://wa.me/${numero}?text=${texto}` : `https://wa.me/?text=${texto}`;
}
