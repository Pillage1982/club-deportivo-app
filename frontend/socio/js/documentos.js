// Portal del Socio → Documentos: cartas de justificación de inasistencia y de
// postulación a bloques con el mismo formato que las cartas en papel de la
// agrupación. Nombre, RUT, celular y email se autocompletan (el servidor los toma
// de la BD, no del formulario); la vista previa muestra la carta tal como llega
// por correo a la directiva/caporales. También muestra la cuenta para depositar,
// envía comprobantes de depósito a tesorería y abre los Estatutos en PDF.

let datosDocumentos = null;

const ETIQUETA_REFERENCIA = {
  ensayo: 'Ensayo',
  reunion: 'Reunión',
  salida: 'Salida',
  otro: 'Otro'
};

const ETIQUETA_TIPO_JUST = {
  justificado: 'Justificación',
  licencia_medica: 'Licencia médica'
};

function cargarDocumentos() {
  return fetch(`${API_URL}/socio-auth/documentos`, { headers: getAuthHeadersSocio() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar los documentos');
      return data;
    })
    .then(data => {
      datosDocumentos = data;
      document.getElementById('txt_minutos_cierre').textContent = data.minutos_cierre;
      renderizarHistorialDocumentos();
      prepararFormularioJustificacion();
      prepararFormularioPostulacion();
    })
    .catch(err => {
      console.error('Error cargando documentos:', err);
      document.getElementById('docs_historial').innerHTML =
        `<p class="text-danger small mb-0">${escaparHtml(err.message)}</p>`;
    });
}

// =====================================
// NAVEGACIÓN INTERNA (menú ↔ formularios)
// =====================================
function mostrarVistaDocumentos(id) {
  ['docs_menu', 'docs_form_justificacion', 'docs_form_postulacion', 'docs_cuenta', 'docs_form_comprobante'].forEach(v => {
    document.getElementById(v).classList.toggle('d-none', v !== id);
  });
  window.scrollTo(0, 0);
}

function volverMenuDocumentos() {
  mostrarVistaDocumentos('docs_menu');
}

function abrirFormularioJustificacion() {
  if (!datosDocumentos) return;
  document.getElementById('docs_respuesta').innerHTML = '';
  document.getElementById('just_respuesta').innerHTML = '';
  mostrarVistaDocumentos('docs_form_justificacion');
  actualizarPreviewJustificacion();
}

function abrirFormularioPostulacion() {
  if (!datosDocumentos) return;
  document.getElementById('docs_respuesta').innerHTML = '';
  document.getElementById('post_respuesta').innerHTML = '';
  mostrarVistaDocumentos('docs_form_postulacion');
  actualizarPreviewPostulacion();
}

function alertaDocumentos(tipo, mensaje) {
  const icono = tipo === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
  return `
    <div class="alert alert-${tipo} mt-2">
      <i class="bi bi-${icono}"></i> ${escaparHtml(mensaje)}
    </div>
  `;
}

// =====================================
// HISTORIAL
// =====================================
function badgeEstadoCarta(estado) {
  const mapa = {
    pendiente: ['bg-warning text-dark', 'En revisión'],
    aprobada: ['bg-success', 'Aprobada'],
    rechazada: ['bg-danger', 'Rechazada']
  };
  const [clase, texto] = mapa[estado] || ['bg-secondary', estado];
  return `<span class="badge ${clase}">${texto}</span>`;
}

function folioTexto(id) {
  return String(id).padStart(5, '0');
}

function renderizarHistorialDocumentos() {
  const contenedor = document.getElementById('docs_historial');
  const items = [
    ...datosDocumentos.justificaciones.map(j => ({ tipo: 'j', fecha: j.creado_en, dato: j })),
    ...datosDocumentos.postulaciones.map(p => ({ tipo: 'p', fecha: p.creado_en, dato: p })),
    ...(datosDocumentos.comprobantes || []).map(c => ({ tipo: 'c', fecha: c.creado_en, dato: c }))
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

  if (!items.length) {
    contenedor.innerHTML = '<p class="text-muted small mb-0">Todavía no has enviado cartas ni comprobantes.</p>';
    return;
  }

  contenedor.innerHTML = items.map(({ tipo, dato }) => {
    if (tipo === 'c') {
      return `
        <div class="item socio-doc-item">
          <div>
            <div><strong>Comprobante de depósito</strong> · Folio ${folioTexto(dato.id)}</div>
            <small class="text-muted">
              ${formatearMonto(dato.monto)} · depositado ${formatearFecha(dato.fecha_deposito)}${dato.concepto ? ` · ${escaparHtml(dato.concepto)}` : ''}
            </small>
          </div>
          ${dato.email_enviado
            ? '<span class="badge bg-secondary">Enviado a tesorería</span>'
            : '<span class="badge bg-warning text-dark">Correo no enviado</span>'}
        </div>
      `;
    }

    if (tipo === 'p') {
      return `
        <div class="item socio-doc-item">
          <div>
            <div><strong>Postulación a bloques</strong> · Folio ${folioTexto(dato.id)}</div>
            <small class="text-muted">
              ${escaparHtml(dato.opcion_1)}${dato.opcion_2 ? ` / ${escaparHtml(dato.opcion_2)}` : ''}
              · enviada ${formatearFecha(dato.creado_en)}
            </small>
          </div>
          <span class="badge bg-secondary">Enviada</span>
        </div>
      `;
    }

    const actividad = dato.evento
      ? `${escaparHtml(dato.evento)} (${formatearFecha(dato.fecha_evento)})`
      : `${escaparHtml(dato.referencia_otro || ETIQUETA_REFERENCIA[dato.referencia])} (${formatearFecha(dato.fecha_actividad)})`;

    return `
      <div class="item socio-doc-item">
        <div>
          <div><strong>${ETIQUETA_TIPO_JUST[dato.tipo_solicitado] || 'Justificación'}</strong> · Folio ${folioTexto(dato.id)}</div>
          <small class="text-muted">${actividad}</small>
          ${dato.observacion_directiva ? `<small class="d-block fst-italic">Directiva: ${escaparHtml(dato.observacion_directiva)}</small>` : ''}
        </div>
        ${badgeEstadoCarta(dato.estado)}
      </div>
    `;
  }).join('');
}

// =====================================
// CARTA DE JUSTIFICACIÓN
// =====================================
function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaLargaHoy() {
  return new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
}

let formularioJustificacionListo = false;

function prepararFormularioJustificacion() {
  const select = document.getElementById('just_evento');
  const eventos = datosDocumentos.eventos;

  select.innerHTML = `
    <option value="">Selecciona una actividad...</option>
    ${eventos.length ? `<optgroup label="Próximas actividades">
      ${eventos.map(e => `
        <option value="${e.id}">
          ${ETIQUETA_REFERENCIA[e.referencia]} · ${formatearFechaHora(e.fecha)} · ${escaparHtml(e.nombre)}
        </option>`).join('')}
    </optgroup>` : ''}
    <option value="otro">Otra actividad (no está en la lista)</option>
  `;

  document.getElementById('just_sin_eventos').classList.toggle('d-none', eventos.length > 0);
  document.getElementById('just_fecha').min = hoyIso();

  if (formularioJustificacionListo) return;
  formularioJustificacionListo = true;

  select.addEventListener('change', () => {
    document.getElementById('just_otro_campos').classList.toggle('d-none', select.value !== 'otro');
  });

  const form = document.getElementById('form_justificacion');
  form.addEventListener('input', actualizarPreviewJustificacion);
  form.addEventListener('change', actualizarPreviewJustificacion);
}

function valorRadio(nombre) {
  return document.querySelector(`input[name="${nombre}"]:checked`)?.value || '';
}

function leerFormularioJustificacion() {
  const seleccion = document.getElementById('just_evento').value;
  const evento = datosDocumentos.eventos.find(e => String(e.id) === seleccion) || null;
  const esOtra = seleccion === 'otro';

  return {
    seleccion,
    evento,
    esOtra,
    referencia: evento ? evento.referencia : (esOtra ? valorRadio('just_referencia') : ''),
    referenciaOtro: document.getElementById('just_referencia_otro').value.trim(),
    fecha: document.getElementById('just_fecha').value,
    tipo: valorRadio('just_tipo'),
    condicion: valorRadio('just_condicion'),
    motivo: document.getElementById('just_motivo').value.trim(),
    quienEntrega: document.getElementById('just_quien_entrega').value.trim(),
    archivo: document.getElementById('just_adjunto').files[0] || null
  };
}

function casillaCarta(marcada) {
  return `<span class="carta-casilla">(${marcada ? '<strong>X</strong>' : '&nbsp;&nbsp;'})</span>`;
}

function membreteCarta(destinatarios) {
  return `
    <div class="carta-membrete">
      <img src="../img/logo-calamena.jpeg" alt="GDC">
      <div>BAILE RELIGIOSO<br>“GRAN DIABLADA CALAMEÑA”</div>
    </div>
    <p class="carta-derecha"><strong>Folio Nº</strong> <span class="text-muted">(se asigna al enviar)</span></p>
    <p class="carta-derecha"><strong>Calama,</strong> ${fechaLargaHoy()}</p>
    <p class="carta-destinatarios"><strong>Señores<br>${destinatarios}<br><u>Presente</u>.</strong></p>
  `;
}

function nombreCompletoSocio() {
  const p = datosDocumentos.persona;
  return `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim();
}

function textoOVacio(valor, vacio) {
  return valor
    ? escaparHtml(valor).replace(/\n/g, '<br>')
    : `<span class="carta-vacio">${vacio}</span>`;
}

function actualizarPreviewJustificacion() {
  if (!datosDocumentos) return;
  const f = leerFormularioJustificacion();
  const p = datosDocumentos.persona;

  let actividad = '<span class="carta-vacio">(elige la actividad)</span>';
  if (f.evento) {
    actividad = `${escaparHtml(f.evento.nombre)} — ${formatearFechaHora(f.evento.fecha)}`;
  } else if (f.esOtra) {
    actividad = `${textoOVacio(f.referenciaOtro, '(nombre de la actividad)')} — ${f.fecha ? formatearFecha(f.fecha) : '<span class="carta-vacio">(fecha)</span>'}`;
  }

  document.getElementById('just_adjunto_ayuda').textContent = f.tipo === 'licencia_medica'
    ? 'Adjunta la licencia médica (foto o PDF, máximo 5 MB).'
    : 'Foto o PDF, máximo 5 MB.';

  document.getElementById('preview_justificacion').innerHTML = `
    ${membreteCarta('Directivos, Caporales.')}
    <p class="carta-referencia">
      <strong>Referencia justifica inasistencia a:</strong>
      Ensayo ${casillaCarta(f.referencia === 'ensayo')}
      Reunión ${casillaCarta(f.referencia === 'reunion')}
      Salida ${casillaCarta(f.referencia === 'salida')}
      Otro ${casillaCarta(f.referencia === 'otro')}
    </p>
    <p class="carta-nota">
      Actividad: <strong>${actividad}</strong><br>
      Tipo: <strong>${ETIQUETA_TIPO_JUST[f.tipo] || 'Justificación'}</strong>${f.archivo ? ' · Se adjunta documento de respaldo' : ''}
    </p>
    <p class="mb-1">Respetados Srs:</p>
    <p class="carta-cuerpo">${textoOVacio(f.motivo, '(aquí va el motivo que escribas)')}</p>
    <p>Sin otro particular se despide atentamente,</p>
    <p class="mb-1"><strong>Nombre:</strong> ${escaparHtml(nombreCompletoSocio())}</p>
    <p class="mb-1"><strong>Condición:</strong>
      Bailarín ${casillaCarta(f.condicion === 'bailarin')}
      Socio ${casillaCarta(f.condicion === 'socio')}
    </p>
    <p class="mb-1"><strong>Rut:</strong> ${escaparHtml(p.rut)}</p>
    <p class="mb-1"><strong>Firma:</strong> <em class="text-muted">envío electrónico con tu sesión del portal</em></p>
    ${f.quienEntrega ? `<p class="mb-0 small">Nombre de quien entrega (no es el titular): <strong>${escaparHtml(f.quienEntrega)}</strong></p>` : ''}
  `;
}

function validarJustificacion(f) {
  if (!f.seleccion) return 'Elige la actividad a la que no podrás asistir';
  if (f.esOtra) {
    if (!f.referencia) return 'Indica el tipo de actividad (ensayo, reunión, salida u otro)';
    if (!f.referenciaOtro) return 'Indica el nombre de la actividad';
    if (!f.fecha) return 'Indica la fecha de la actividad';
    if (f.fecha < hoyIso()) return 'La fecha debe ser hoy o posterior (Art. 8.7: solo hasta el cierre de asistencia)';
  }
  if (!f.tipo) return 'Indica si es justificación o licencia médica';
  if (!f.condicion) return 'Indica tu condición (bailarín o socio)';
  if (f.motivo.length < 10) return 'Explica el motivo de tu inasistencia (mínimo 10 caracteres)';
  if (f.archivo && f.archivo.size > 5 * 1024 * 1024) return 'El archivo supera los 5 MB';
  return null;
}

function enviarJustificacion() {
  const respuesta = document.getElementById('just_respuesta');
  const f = leerFormularioJustificacion();
  const error = validarJustificacion(f);

  if (error) {
    respuesta.innerHTML = alertaDocumentos('warning', error);
    return;
  }

  const datos = new FormData();
  if (f.evento) {
    datos.append('evento_id', f.evento.id);
  } else {
    datos.append('referencia', f.referencia);
    datos.append('referencia_otro', f.referenciaOtro);
    datos.append('fecha_actividad', f.fecha);
  }
  datos.append('tipo_solicitado', f.tipo);
  datos.append('condicion', f.condicion);
  datos.append('motivo', f.motivo);
  if (f.quienEntrega) datos.append('quien_entrega', f.quienEntrega);
  if (f.archivo) datos.append('adjunto', f.archivo);

  const boton = document.getElementById('btn_enviar_justificacion');
  boton.disabled = true;
  respuesta.innerHTML = '';

  // Sin Content-Type: el navegador arma el multipart con su boundary.
  fetch(`${API_URL}/socio-auth/documentos/justificaciones`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSocioToken()}` },
    body: datos
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo enviar la carta');
      return data;
    })
    .then(data => {
      document.getElementById('form_justificacion').reset();
      document.getElementById('just_otro_campos').classList.add('d-none');
      volverMenuDocumentos();
      document.getElementById('docs_respuesta').innerHTML =
        alertaDocumentos(data.correoEnviado ? 'success' : 'warning', data.mensaje);
      cargarDocumentos();
    })
    .catch(err => {
      respuesta.innerHTML = alertaDocumentos('danger', err.message);
      // La actividad pudo cerrarse mientras escribía: refresca la lista.
      cargarDocumentos();
    })
    .finally(() => { boton.disabled = false; });
}

// =====================================
// POSTULACIÓN A BLOQUES
// =====================================
let formularioPostulacionListo = false;

function prepararFormularioPostulacion() {
  const p = datosDocumentos.persona;
  document.getElementById('post_bloque_actual').textContent = p.bloque || 'Sin bloque asignado';
  document.getElementById('lista_bloques').innerHTML = datosDocumentos.bloques
    .map(b => `<option value="${escaparHtml(b)}"></option>`)
    .join('');

  if (formularioPostulacionListo) return;
  formularioPostulacionListo = true;

  const form = document.getElementById('form_postulacion');
  form.addEventListener('input', actualizarPreviewPostulacion);
  form.addEventListener('change', actualizarPreviewPostulacion);
}

function leerFormularioPostulacion() {
  return {
    esNuevo: document.getElementById('post_es_nuevo').checked,
    opcion1: document.getElementById('post_opcion_1').value.trim(),
    opcion2: document.getElementById('post_opcion_2').value.trim()
  };
}

function actualizarPreviewPostulacion() {
  if (!datosDocumentos) return;
  const f = leerFormularioPostulacion();
  const p = datosDocumentos.persona;
  const bloqueActual = f.esNuevo ? 'Integrante nuevo' : (p.bloque || '—');

  document.getElementById('preview_postulacion').innerHTML = `
    ${membreteCarta('Caporales.')}
    <p class="carta-referencia"><strong>Referencia Postulación a Bloques Cupos Limitado.</strong></p>
    <p class="mb-1">Respetados Srs:</p>
    <p class="carta-sangria">
      Me dirijo a Ustedes, para comunicar mi postulación como bailarín/a del
      Baile Religioso “Gran Diablada Calameña”.
    </p>
    <p>Bloque y/o Fila al que pertenezco: <strong>${escaparHtml(bloqueActual)}</strong></p>
    <p class="mb-1">Primera opción de postulación: <strong>${textoOVacio(f.opcion1, '(primera opción)')}</strong></p>
    <p>Segunda opción de postulación: <strong>${f.opcion2 ? escaparHtml(f.opcion2) : '—'}</strong></p>
    <p class="mb-1"><strong>Nombre:</strong> ${escaparHtml(nombreCompletoSocio())}</p>
    <p class="mb-1"><strong>Rut:</strong> ${escaparHtml(p.rut)}</p>
    <p class="mb-1"><strong>N° Celular:</strong> ${textoOVacio(p.telefono, 'sin celular registrado')}</p>
    <p class="mb-0"><strong>E-mail:</strong> ${textoOVacio(p.email, 'sin email registrado')}</p>
  `;
}

function enviarPostulacion() {
  const respuesta = document.getElementById('post_respuesta');
  const f = leerFormularioPostulacion();

  if (!f.opcion1) {
    respuesta.innerHTML = alertaDocumentos('warning', 'Indica tu primera opción de postulación');
    return;
  }
  if (f.opcion2 && f.opcion2.toLowerCase() === f.opcion1.toLowerCase()) {
    respuesta.innerHTML = alertaDocumentos('warning', 'La segunda opción debe ser distinta de la primera');
    return;
  }

  const boton = document.getElementById('btn_enviar_postulacion');
  boton.disabled = true;
  respuesta.innerHTML = '';

  fetch(`${API_URL}/socio-auth/documentos/postulaciones`, {
    method: 'POST',
    headers: getAuthHeadersSocio(),
    body: JSON.stringify({
      es_nuevo: f.esNuevo,
      opcion_1: f.opcion1,
      opcion_2: f.opcion2 || null
    })
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo enviar la postulación');
      return data;
    })
    .then(data => {
      document.getElementById('form_postulacion').reset();
      volverMenuDocumentos();
      document.getElementById('docs_respuesta').innerHTML =
        alertaDocumentos(data.correoEnviado ? 'success' : 'warning', data.mensaje);
      cargarDocumentos();
    })
    .catch(err => {
      respuesta.innerHTML = alertaDocumentos('danger', err.message);
    })
    .finally(() => { boton.disabled = false; });
}

// =====================================
// DATOS PARA DEPOSITAR
// =====================================
const CAMPOS_CUENTA = [
  ['titular', 'Titular'],
  ['rut', 'RUT'],
  ['banco', 'Banco'],
  ['tipo_cuenta', 'Tipo de cuenta'],
  ['numero', 'N° de cuenta'],
  ['email', 'Correo']
];

function abrirDatosCuenta() {
  if (!datosDocumentos) return;
  document.getElementById('docs_respuesta').innerHTML = '';
  document.getElementById('cuenta_respuesta').innerHTML = '';
  const cuenta = datosDocumentos.cuenta_deposito || {};
  const contenedor = document.getElementById('cuenta_datos');

  if (!cuenta.numero) {
    contenedor.innerHTML = '<p class="text-muted small mb-0">Tesorería aún no publica los datos de la cuenta. Consulta directamente con tesorería.</p>';
  } else {
    const filas = CAMPOS_CUENTA.filter(([clave]) => cuenta[clave]);
    contenedor.innerHTML = filas.map(([clave, etiqueta]) => `
      <div class="item align-items-center">
        <div>
          <small class="text-muted d-block">${etiqueta}</small>
          <strong>${escaparHtml(cuenta[clave])}</strong>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="copiarDatoCuenta('${clave}')" aria-label="Copiar ${etiqueta}">
          <i class="bi bi-copy"></i>
        </button>
      </div>
    `).join('') + `
      <button type="button" class="btn btn-sm btn-outline-secondary w-100 mt-2" onclick="copiarDatoCuenta()">
        <i class="bi bi-clipboard me-1"></i>Copiar todos los datos
      </button>
      ${cuenta.nota ? `<p class="text-muted small mt-2 mb-0">${escaparHtml(cuenta.nota)}</p>` : ''}
    `;
  }
  mostrarVistaDocumentos('docs_cuenta');
}

// Sin clave copia todos los datos (para pegarlos en la app del banco).
function copiarDatoCuenta(clave) {
  const cuenta = datosDocumentos.cuenta_deposito || {};
  const texto = clave
    ? String(cuenta[clave])
    : CAMPOS_CUENTA.filter(([c]) => cuenta[c]).map(([c, etiqueta]) => `${etiqueta}: ${cuenta[c]}`).join('\n');
  const aviso = document.getElementById('cuenta_respuesta');

  const copiar = navigator.clipboard
    ? navigator.clipboard.writeText(texto)
    : Promise.reject(new Error('sin portapapeles'));
  copiar
    .then(() => { aviso.innerHTML = alertaDocumentos('success', clave ? 'Copiado.' : 'Datos de la cuenta copiados.'); })
    .catch(() => { aviso.innerHTML = alertaDocumentos('warning', 'No se pudo copiar. Mantén presionado el dato para copiarlo.'); });
}

// =====================================
// COMPROBANTE DE DEPÓSITO → TESORERÍA
// =====================================
function abrirFormularioComprobante() {
  if (!datosDocumentos) return;
  document.getElementById('docs_respuesta').innerHTML = '';
  document.getElementById('comp_respuesta').innerHTML = '';
  const fecha = document.getElementById('comp_fecha');
  fecha.max = hoyIso();
  if (!fecha.value) fecha.value = hoyIso();
  mostrarVistaDocumentos('docs_form_comprobante');
}

function leerFormularioComprobante() {
  return {
    monto: Number(document.getElementById('comp_monto').value.replace(/\D/g, '')),
    fecha: document.getElementById('comp_fecha').value,
    concepto: document.getElementById('comp_concepto').value.trim(),
    archivo: document.getElementById('comp_archivo').files[0] || null
  };
}

function validarComprobante(f) {
  if (!f.monto || f.monto < 100) return 'Indica el monto depositado';
  if (!f.fecha) return 'Indica la fecha del depósito';
  if (f.fecha > hoyIso()) return 'La fecha del depósito no puede ser futura';
  if (!f.archivo) return 'Adjunta la foto o el PDF del comprobante';
  if (f.archivo.size > 5 * 1024 * 1024) return 'El archivo supera los 5 MB';
  return null;
}

function enviarComprobante() {
  const respuesta = document.getElementById('comp_respuesta');
  const f = leerFormularioComprobante();
  const error = validarComprobante(f);

  if (error) {
    respuesta.innerHTML = alertaDocumentos('warning', error);
    return;
  }

  const datos = new FormData();
  datos.append('monto', f.monto);
  datos.append('fecha_deposito', f.fecha);
  if (f.concepto) datos.append('concepto', f.concepto);
  datos.append('comprobante', f.archivo);

  const boton = document.getElementById('btn_enviar_comprobante');
  boton.disabled = true;
  respuesta.innerHTML = '';

  // Sin Content-Type: el navegador arma el multipart con su boundary.
  fetch(`${API_URL}/socio-auth/documentos/comprobantes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getSocioToken()}` },
    body: datos
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudo enviar el comprobante');
      return data;
    })
    .then(data => {
      document.getElementById('form_comprobante').reset();
      volverMenuDocumentos();
      document.getElementById('docs_respuesta').innerHTML =
        alertaDocumentos(data.correoEnviado ? 'success' : 'warning', data.mensaje);
      cargarDocumentos();
    })
    .catch(err => {
      respuesta.innerHTML = alertaDocumentos('danger', err.message);
    })
    .finally(() => { boton.disabled = false; });
}

// =====================================
// ESTATUTOS
// =====================================
// El PDF exige el token del socio, así que no basta un <a href>: se descarga con
// fetch y se abre como blob. La pestaña se abre antes del fetch para que el
// navegador no la bloquee como popup.
function abrirEstatutos() {
  const pestana = window.open('', '_blank');
  const boton = document.getElementById('btn_estatutos');
  boton.disabled = true;

  fetch(`${API_URL}/socio-auth/documentos/estatutos`, {
    headers: { Authorization: `Bearer ${getSocioToken()}` }
  })
    .then(res => {
      if (!res.ok) throw new Error('No se pudieron abrir los Estatutos');
      return res.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      if (pestana) {
        pestana.location.href = url;
      } else {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = 'Estatutos_GDC_2016.pdf';
        enlace.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    })
    .catch(err => {
      if (pestana) pestana.close();
      document.getElementById('docs_respuesta').innerHTML = alertaDocumentos('danger', err.message);
    })
    .finally(() => { boton.disabled = false; });
}
