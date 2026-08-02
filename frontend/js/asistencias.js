// =====================================
// REGISTRAR ASISTENCIA EVENTO
// =====================================

let qrAsistenciaStream = null;
let qrAsistenciaDetector = null;
let qrAsistenciaEscaneando = false;
let qrAsistenciaUltimaLectura = '';
let qrAsistenciaCanvas = null;
let qrAsistenciaCanvasFull = null;

async function registrarAsistencia() {

  if (eventoSeleccionadoFinalizado()) {
    mostrarAlerta(
      'Esta actividad ya fue finalizada. No se puede registrar asistencia.',
      'warning'
    );
    return;
  }

  const persona_id = document.getElementById('persona_id').value;
  const evento_id = document.getElementById('evento_id').value;
  const estado = document.getElementById('estado').value;
  let minutos =
  document.getElementById('minutos').value;

    // Solo se solicitan minutos
    // cuando el estado es atrasado
    if (estado !== 'atrasado') {

      minutos = 0;

    }

    // Datos enviados al backend
    const data = {
      persona_id,
      evento_id,
      estado,
      minutos
    };

    // =====================================
    // VALIDACIONES FRONTEND ASISTENCIA
    // =====================================

    if (!data.persona_id) {

      mostrarAlerta(
        'Seleccione un integrante',
        'warning'
      );

      return;

    }

    if (!data.evento_id) {

      // Sin actividad seleccionada: guardar offline como sin_evento
      // El scanner nunca se bloquea por falta de evento
      try {
        await guardarAsistenciaOffline(data);
        mostrarAvisoSinEvento();
        actualizarBadgeOffline();
        mostrarAlerta(
          'Sin actividad — escaneo guardado localmente. Se asignará cuando se seleccione la actividad.',
          'warning'
        );
        document.getElementById('minutos').value = 0;
        const inputManual = document.getElementById('qr_asistencia_manual');
        if (inputManual) inputManual.value = '';
        const btnEnviar = document.getElementById('btn_usar_lectura');
        if (btnEnviar) btnEnviar.disabled = true;
      } catch {
        mostrarAlerta('No se pudo guardar el escaneo localmente', 'danger');
      }

      return;

    }

    if (!data.estado) {

      mostrarAlerta(
        'Seleccione un estado',
        'warning'
      );

      return;

    }

    // Validación exclusiva para atrasos
    if (data.estado === 'atrasado' &&

        (
          !data.minutos ||

          Number(data.minutos) < 0
        )

      ) {

        mostrarAlerta(

          'Ingrese minutos de atraso válidos',

          'warning'

        );

        return;

      }

      const estadoBoton =
        bloquearBoton(
          'btn_registrar_asistencia',
          'Registrando...'
        );

      if (!estadoBoton) return;

      fetch(`${API_URL}/asistencia`, {
        method:  'POST',
        headers: getAuthHeaders(),
        body:    JSON.stringify(data)
      })
      .then(async res => {
        const contentType = res.headers.get('content-type') || '';
        const resData = contentType.includes('application/json')
          ? await res.json()
          : { mensaje: await res.text() };
        if (!res.ok) throw new Error(resData.mensaje || 'No se pudo registrar la asistencia');
        return resData;
      })
      .then(response => {
        document.getElementById('respuesta').innerText = response.mensaje || 'Asistencia registrada';
        mostrarAlerta(response.mensaje || 'Asistencia registrada', 'success');
        cargarAsistencias();
        cargarDashboard();
        refrescarFinanzasPorAsistencia();
        document.getElementById('minutos').value = 0;
      })
      .catch(async err => {
        const sinRed = !navigator.onLine || err.message === 'Failed to fetch';
        if (sinRed) {
          try {
            await guardarAsistenciaOffline(data);
            await actualizarBadgeOffline();
            mostrarAlerta('Sin conexión — asistencia guardada localmente y se enviará al recuperar señal', 'warning');
            document.getElementById('respuesta').innerText = 'Guardado sin conexión';
          } catch {
            mostrarAlerta('Sin conexión y no se pudo guardar localmente', 'danger');
          }
        } else {
          console.error(err);
          mostrarAlerta(err.message, 'danger');
        }
      })
      .finally(() => {
        restaurarBoton(estadoBoton, 'Registrar');
      });

}

function actualizarEstadoQrAsistencia(mensaje, tipo = 'muted') {
  const estado =
    document.getElementById('qr_asistencia_estado');

  if (!estado) {
    return;
  }

  estado.className =
    `qr-attendance-status mt-3 mb-0 text-${tipo}`;

  estado.innerText = mensaje;
}

async function crearDetectorQrAsistencia() {
  if (
    !('BarcodeDetector' in window) ||
    typeof BarcodeDetector.getSupportedFormats !== 'function'
  ) {
    return null;
  }

  const formatosSoportados =
    await BarcodeDetector.getSupportedFormats();

  const formatos = [
    'qr_code',
    'pdf417'
  ].filter(formato => formatosSoportados.includes(formato));

  if (formatos.length === 0) {
    return null;
  }

  return new BarcodeDetector({
    formats: formatos
  });
}

async function iniciarEscaneoAsistencia() {
  const video =
    document.getElementById('qr_scanner_video');

  const wrapper =
    document.getElementById('qr_scanner_wrapper');

  if (!video || !wrapper) {
    return;
  }

  try {
    qrAsistenciaDetector =
      await crearDetectorQrAsistencia();

    qrAsistenciaStream =
      await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width:  { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

    await configurarCamaraQrAsistencia(qrAsistenciaStream);

    video.srcObject = qrAsistenciaStream;
    await video.play();

    wrapper.classList.remove('d-none');
    document.getElementById('btn_iniciar_qr')?.classList.add('d-none');
    document.getElementById('btn_detener_qr')?.classList.remove('d-none');

    qrAsistenciaEscaneando = true;
    qrAsistenciaUltimaLectura = '';
    actualizarEstadoQrAsistencia(
      qrAsistenciaDetector
        ? 'Camara activa. Centre el QR, evite reflejos e incline levemente la cedula.'
        : 'Camara activa en modo compatible. Centre el QR, evite reflejos e incline levemente la cedula.',
      'primary'
    );

    escanearFrameAsistencia();
  } catch (err) {
    console.error(err);
    actualizarEstadoQrAsistencia(
      'No se pudo iniciar la cámara. Revise permisos o use lectura manual.',
      'danger'
    );
  }
}

async function configurarCamaraQrAsistencia(stream) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track || typeof track.getCapabilities !== 'function') return;

  const capacidades = track.getCapabilities();
  if (!Array.isArray(capacidades.focusMode) || !capacidades.focusMode.includes('continuous')) return;

  try {
    await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
  } catch (err) {
    console.warn('No se pudo aplicar enfoque continuo a la camara', err);
  }
}

function detenerEscaneoAsistencia() {
  qrAsistenciaEscaneando = false;

  if (qrAsistenciaStream) {
    qrAsistenciaStream
      .getTracks()
      .forEach(track => track.stop());

    qrAsistenciaStream = null;
  }

  const wrapper =
    document.getElementById('qr_scanner_wrapper');

  const video =
    document.getElementById('qr_scanner_video');

  if (video) {
    video.srcObject = null;
  }

  if (wrapper) {
    wrapper.classList.add('d-none');
  }

  document.getElementById('btn_detener_qr')?.classList.add('d-none');
  document.getElementById('btn_iniciar_qr')?.classList.remove('d-none');

  actualizarBotonesEscaneoQr();
}

async function escanearFrameAsistencia() {
  const video =
    document.getElementById('qr_scanner_video');

  if (
    !qrAsistenciaEscaneando ||
    !video
  ) {
    return;
  }

  try {
    let lectura = '';

    if (qrAsistenciaDetector) {
      lectura = await detectarLecturaNativaAsistencia(video);
      if (lectura && !lecturaIdentificableAsistencia(lectura)) lectura = '';
    }

    if (!lectura) lectura = detectarLecturaCompatibleAsistencia(video);

    if (lectura && lectura !== qrAsistenciaUltimaLectura && lecturaIdentificableAsistencia(lectura)) {
      qrAsistenciaUltimaLectura = lectura;
      detenerEscaneoAsistencia();
      procesarLecturaAsistencia(lectura);
      return;
    }
  } catch (err) {
    console.error(err);
  }

  requestAnimationFrame(escanearFrameAsistencia);
}

// Zoom digital: recorta el centro del frame para mejorar detección en webcams de escritorio
function prepararCanvasCompletoAsistencia(video) {
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return null;
  if (!qrAsistenciaCanvasFull) qrAsistenciaCanvasFull = document.createElement('canvas');
  qrAsistenciaCanvasFull.width = video.videoWidth;
  qrAsistenciaCanvasFull.height = video.videoHeight;
  qrAsistenciaCanvasFull.getContext('2d', { willReadFrequently: true }).drawImage(video, 0, 0);
  return qrAsistenciaCanvasFull;
}

function prepararCanvasCroppedAsistencia(video, proporcion = 0.5) {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) return null;

  if (!qrAsistenciaCanvas) qrAsistenciaCanvas = document.createElement('canvas');

  const srcX = video.videoWidth  * (1 - proporcion) / 2;
  const srcY = video.videoHeight * (1 - proporcion) / 2;
  const srcW = video.videoWidth  * proporcion;
  const srcH = video.videoHeight * proporcion;

  qrAsistenciaCanvas.width  = srcW;
  qrAsistenciaCanvas.height = srcH;

  qrAsistenciaCanvas
    .getContext('2d', { willReadFrequently: true })
    .drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

  return qrAsistenciaCanvas;
}

async function detectarLecturaNativaAsistencia(video) {
  for (const proporcion of [1, 0.75, 0.5]) {
    const canvas = proporcion === 1
      ? prepararCanvasCompletoAsistencia(video)
      : prepararCanvasCroppedAsistencia(video, proporcion);
    if (!canvas) continue;
    const codigos = await qrAsistenciaDetector.detect(canvas);
    const lectura = codigos.find(codigo => codigo.rawValue)?.rawValue || '';
    if (lectura) return lectura;
  }
  return '';
}

function detectarLecturaCompatibleAsistencia(video) {
  if (typeof jsQR !== 'function') {
    actualizarEstadoQrAsistencia(
      'No se pudo cargar el lector compatible. Recargue la pagina o use lectura manual.',
      'warning'
    );
    return '';
  }

  for (const proporcion of [1, 0.75, 0.5]) {
    const canvas = proporcion === 1
      ? prepararCanvasCompletoAsistencia(video)
      : prepararCanvasCroppedAsistencia(video, proporcion);
    if (!canvas) continue;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imagen = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const codigo = jsQR(imagen.data, imagen.width, imagen.height, { inversionAttempts: 'attemptBoth' });
    if (codigo?.data) return codigo.data;
  }
  return '';
}

function lecturaIdentificableAsistencia(lectura) {
  const datos = extraerDatosLecturaAsistencia(lectura);
  return Boolean(datos.rut || datos.personaId);
}

function procesarLecturaAsistenciaManual() {
  const input =
    document.getElementById('qr_asistencia_manual');

  const lectura =
    input ? input.value.trim() : '';

  if (!lectura) {
    mostrarAlerta(
      'Ingrese o escanee una lectura valida',
      'warning'
    );
    return;
  }

  procesarLecturaAsistencia(lectura);
}

function describirPersonaAsistencia(persona) {
  return `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`.trim();
}

function limpiarFormularioAsistenciaParaLectura() {
  const persona =
    document.getElementById('persona_id');

  const estado =
    document.getElementById('estado');

  const minutos =
    document.getElementById('minutos');

  if (persona) {
    persona.value = '';
  }

  if (estado) {
    estado.value = 'presente';
  }

  if (minutos) {
    minutos.value = 0;
  }
}
async function procesarLecturaAsistencia(lectura) {
  let persona = null;
  const fechaEscaneo = new Date();

  limpiarFormularioAsistenciaParaLectura();

  try {
    persona = await buscarPersonaPorLecturaAsistencia(lectura);
  } catch (err) {
    console.error(err);
    mostrarAlerta(
      err.message || 'No se pudo procesar la lectura',
      'danger'
    );
    return;
  }

  if (!persona) {
    actualizarEstadoQrAsistencia(
      'No se encontro un integrante para la lectura recibida.',
      'danger'
    );
    mostrarAlerta(
      'No se encontro un integrante asociado al QR o RUT',
      'warning'
    );
    return;
  }

  seleccionarPersonaAsistencia(persona);

  const eventoId =
    (document.getElementById('evento_id') || {}).value || '';

  if (eventoId) {
    try {
      const eventos = await obtenerEventosParaQrAsistencia();
      const evento = eventos.find(e => String(e.id) === String(eventoId));
      if (evento) {
        aplicarAtrasoAsistencia(evento, fechaEscaneo);
      }
    } catch (err) {
      console.error(err);
    }
  }

  actualizarEstadoQrAsistencia(
    `Integrante identificado: ${describirPersonaAsistencia(persona)}`,
    'success'
  );

  registrarAsistencia();
}

function eventoSeleccionadoFinalizado() {
  const eventoId =
    (document.getElementById('evento_id') || {}).value || '';

  if (!eventoId) return false;

  const opcion = document.querySelector(
    `#evento_id option[value="${eventoId}"]`
  );

  return opcion && opcion.dataset.finalizado === '1';
}

function actualizarBotonesEscaneoQr() {
  const eventoId =
    (document.getElementById('evento_id') || {}).value || '';

  const hayEvento = eventoId !== '';
  const cerrado = eventoSeleccionadoFinalizado();

  const btnIniciar = document.getElementById('btn_iniciar_qr');
  const textoIniciar = document.getElementById('btn_iniciar_qr_texto');
  const btnManual = document.getElementById('btn_usar_lectura');

  if (btnIniciar) {
    btnIniciar.disabled = cerrado;
  }

  if (textoIniciar) {
    textoIniciar.textContent = cerrado
      ? 'Actividad finalizada'
      : !hayEvento
      ? 'Escanear QR (sin actividad — guardará localmente)'
      : 'Escanear QR';
  }

  if (btnManual) {
    btnManual.disabled = cerrado;
  }

  const aviso = document.getElementById('aviso_evento_cerrado');
  if (aviso) {
    aviso.classList.toggle('d-none', !cerrado);
  }
}

async function buscarPersonaPorLecturaAsistencia(lectura) {
  const personas =
    await obtenerPersonasParaQrAsistencia();

  const datos =
    extraerDatosLecturaAsistencia(lectura);

  if (datos.rut) {
    return personas.find(persona => (
      normalizarRutAsistencia(persona.rut) === datos.rut
    ));
  }

  return personas.find(persona => {
    const personaId =
      String(persona.id);

    return (
      datos.personaId &&
      personaId === String(datos.personaId)
    );
  });
}

async function obtenerPersonasParaQrAsistencia() {
  if (
    Array.isArray(personasTabla) &&
    personasTabla.length > 0
  ) {
    return personasTabla.filter(
      persona => (persona.estado || 'activo') === 'activo'
    );
  }

  const res =
    await fetch(`${API_URL}/personas`, {
      headers: getAuthHeaders()
    });

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok || !Array.isArray(data)) {
    throw new Error(
      data.mensaje || 'No se pudieron cargar los integrantes'
    );
  }

  personasTabla = data;
  return personasTabla.filter(
    persona => (persona.estado || 'activo') === 'activo'
  );
}

async function obtenerEventosParaQrAsistencia() {
  if (
    typeof eventosAsistencia !== 'undefined' &&
    Array.isArray(eventosAsistencia) &&
    eventosAsistencia.length > 0
  ) {
    return eventosAsistencia;
  }

  const res =
    await fetch(`${API_URL}/eventos`, {
      headers: getAuthHeaders()
    });

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok || !Array.isArray(data)) {
    throw new Error(
      data.mensaje || 'No se pudieron cargar las actividades'
    );
  }

  if (typeof eventosAsistencia !== 'undefined') {
    eventosAsistencia = data;
  }

  return data;
}

function parsearFechaEventoAsistencia(fecha) {
  const texto =
    String(fecha || '').trim();

  if (!texto) {
    return null;
  }

  const fechaNormalizada =
    texto.includes('T')
      ? texto
      : texto.replace(' ', 'T');

  const resultado =
    new Date(fechaNormalizada);

  if (Number.isNaN(resultado.getTime())) {
    return null;
  }

  return resultado;
}

function esMismaFechaAsistencia(fechaEvento, fechaEscaneo) {
  return (
    fechaEvento.getFullYear() === fechaEscaneo.getFullYear() &&
    fechaEvento.getMonth() === fechaEscaneo.getMonth() &&
    fechaEvento.getDate() === fechaEscaneo.getDate()
  );
}

async function seleccionarEventoAsistenciaPorFecha(fechaEscaneo) {
  const select =
    document.getElementById('evento_id');

  if (!select) {
    return null;
  }

  const eventos =
    await obtenerEventosParaQrAsistencia();

  const candidatos =
    eventos
      .map(evento => ({
        ...evento,
        fechaAsistencia: parsearFechaEventoAsistencia(evento.fecha)
      }))
      .filter(evento => (
        evento.fechaAsistencia &&
        esMismaFechaAsistencia(evento.fechaAsistencia, fechaEscaneo)
      ))
      .sort((a, b) => (
        Math.abs(a.fechaAsistencia - fechaEscaneo) -
        Math.abs(b.fechaAsistencia - fechaEscaneo)
      ));

  const evento =
    candidatos[0] || null;

  select.value =
    evento ? String(evento.id) : '';

  select.dispatchEvent(new Event('change'));

  return evento;
}

function aplicarAtrasoAsistencia(evento, fechaEscaneo) {
  const fechaEvento =
    evento.fechaAsistencia ||
    parsearFechaEventoAsistencia(evento.fecha);

  const estado =
    document.getElementById('estado');

  const minutos =
    document.getElementById('minutos');

  // Si el evento no es de hoy no se puede calcular atraso con precisión
  // (el evento sólo guarda fecha sin hora, comparar contra otro día daría minutos irreales)
  const esHoy =
    fechaEvento &&
    esMismaFechaAsistencia(fechaEvento, fechaEscaneo);

  const minutosAtraso =
    esHoy
      ? Math.max(
        0,
        Math.floor(
          (fechaEscaneo.getTime() - fechaEvento.getTime()) /
          60000
        )
      )
      : 0;

  const toleranciaMinutos =
    Number((window.APP_CONFIG || {}).asistencia?.toleranciaMinutosAtraso) || 0;

  if (estado) {
    estado.value =
      minutosAtraso > toleranciaMinutos
        ? 'atrasado'
        : 'presente';
  }

  if (minutos) {
    minutos.value = minutosAtraso;
  }
}
function extraerDatosLecturaAsistencia(lectura) {
  const texto =
    String(lectura || '').trim();

  const datos = {
    personaId: null,
    rut: null
  };

  const matchRUN = texto.match(/[?&]RUN=([0-9]{7,8}-[0-9Kk])/i);
  if (matchRUN) {
    const rut = normalizarRutAsistencia(matchRUN[1]);
    if (validarRutLecturaAsistencia(rut)) {
      datos.rut = rut;
      return datos;
    }
  }

  datos.rut =
    extraerRutAsistencia(texto);

  if (
    !datos.rut &&
    validarRutLecturaAsistencia(
      normalizarRutAsistencia(texto)
    )
  ) {
    datos.rut =
      normalizarRutAsistencia(texto);
  }

  try {
    const json =
      JSON.parse(texto);

    const rutJson =
      normalizarRutAsistencia(json.rut || json.run || '');

    if (
      !datos.rut &&
      validarRutLecturaAsistencia(rutJson)
    ) {
      datos.rut = rutJson;
    }

    if (!datos.rut) {
      datos.personaId =
        json.persona_id || json.personaId || json.id || null;
    }
  } catch (err) {
    datos.personaId = null;
  }

  if (!datos.rut && !datos.personaId) {
    const idEncontrado =
      texto.match(/(?:persona_id|personaId|socio|credencial|id)=?[:#-]?(\d+)/i);

    if (idEncontrado) {
      datos.personaId = idEncontrado[1];
    }
  }

  if (
    !datos.rut &&
    !datos.personaId &&
    /^\d{1,6}$/.test(texto)
  ) {
    datos.personaId = texto;
  }

  return datos;
}

function extraerRutAsistencia(texto) {
  const coincidencias =
    String(texto || '').match(/[0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9Kk]/g);

  if (!coincidencias) {
    return '';
  }

  const rut =
    coincidencias
      .map(normalizarRutAsistencia)
      .find(validarRutLecturaAsistencia);

  return rut || '';
}

function normalizarRutAsistencia(rut) {
  return String(rut || '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function validarRutLecturaAsistencia(rut) {
  if (typeof validarRutFrontend === 'function') {
    return validarRutFrontend(rut);
  }

  return /^[0-9]{7,8}[0-9K]$/.test(rut);
}

function seleccionarPersonaAsistencia(persona) {
  const select =
    document.getElementById('persona_id');

  if (!select) {
    return;
  }

  const existeOpcion =
    Array.from(select.options)
      .some(option => option.value === String(persona.id));

  if (!existeOpcion) {
    const option =
      document.createElement('option');

    option.value = persona.id;
    option.textContent =
      `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`;

    select.appendChild(option);
  }

  select.value = String(persona.id);
  select.dispatchEvent(new Event('change'));
}

function refrescarFinanzasPorAsistencia() {
  const rol =
    obtenerRolActual();

  if (rol !== 'admin' && rol !== 'tesorero') {
    return;
  }

  setTimeout(() => {
    cargarMultas();
    cargarFinanzas();
    cargarDashboard();
    cargarGraficos();
  }, 300);
}

// =====================================
// CARGAR HISTORIAL ASISTENCIAS
// =====================================

let asistenciasTabla = [];

function normalizarTextoAsistencia(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function filtrarAsistencias() {
  const busqueda = normalizarTextoAsistencia(document.getElementById('buscar_asistencias')?.value);
  const estado   = document.getElementById('filtro_asistencia_estado')?.value || '';

  return asistenciasTabla.filter(a => {
    const texto = normalizarTextoAsistencia(
      [a.nombres, a.apellido_paterno, a.apellido_materno, a.evento].join(' ')
    );
    return (!busqueda || texto.includes(busqueda)) && (!estado || a.estado === estado);
  });
}

function renderizarTablaAsistencias(asistencias) {
  const tabla = document.getElementById('tabla_asistencias');
  tabla.innerHTML = '';

  if (!asistencias.length) {
    tabla.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No hay registros para los filtros seleccionados</td></tr>';
    return;
  }

  const grupos = new Map();
  for (const a of asistencias) {
    const key = a.evento_id;
    if (!grupos.has(key)) grupos.set(key, { nombre: a.evento, fecha: a.fecha_evento, filas: [] });
    grupos.get(key).filas.push(a);
  }

  let html = '';
  for (const grupo of grupos.values()) {
    const fecha = grupo.fecha
      ? new Date(String(grupo.fecha).replace(' ', 'T')).toLocaleDateString('es-CL')
      : '';
    html += `<tr class="table-active border-top border-2"><td colspan="4"><strong>${grupo.nombre}</strong><span class="text-muted small ms-2">${fecha}</span><span class="badge bg-secondary ms-2">${grupo.filas.length}</span></td></tr>`;
    for (const a of grupo.filas) {
      html += `<tr><td>${a.nombres} ${a.apellido_paterno} ${a.apellido_materno || ''}</td><td class="text-muted small">—</td><td>${obtenerBadgeAsistencia(a.estado)}</td><td>${a.minutos_atraso}</td></tr>`;
    }
  }
  tabla.innerHTML = html;
}

function configurarFiltrosAsistencias() {
  ['buscar_asistencias', 'filtro_asistencia_estado'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener(el.tagName === 'INPUT' ? 'input' : 'change',
      () => renderizarTablaAsistencias(filtrarAsistencias()));
  });
}

function limpiarFiltrosAsistencias() {
  const buscar = document.getElementById('buscar_asistencias');
  const estado = document.getElementById('filtro_asistencia_estado');
  if (buscar) buscar.value = '';
  if (estado) estado.value = '';
  renderizarTablaAsistencias(filtrarAsistencias());
}

function cargarAsistencias() {

  fetch(`${API_URL}/asistencia`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {

      if (!Array.isArray(data)) {
        mostrarAlerta(data.mensaje || 'No se pudo cargar la tabla de asistencias', 'warning');
        return;
      }

      asistenciasTabla = data;
      renderizarTablaAsistencias(filtrarAsistencias());
      cargarUltimosRegistros();

    })
    .catch(err => console.error(err));

}

// =====================================
// CARGAR MULTAS AUTOMATICAS
// =====================================

let multasTabla = [];

function normalizarTextoMulta(valor) {
  return String(valor || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function filtrarMultas() {
  const busqueda = normalizarTextoMulta(document.getElementById('buscar_multas')?.value);

  return multasTabla.filter(m => {
    const texto = normalizarTextoMulta(
      [m.nombres, m.apellido_paterno, m.apellido_materno, m.motivo].join(' ')
    );
    return !busqueda || texto.includes(busqueda);
  });
}

function renderizarTablaMultas(multas) {
  const tabla = document.getElementById('tabla_multas');
  tabla.innerHTML = '';

  if (!multas.length) {
    tabla.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No hay registros para los filtros seleccionados</td></tr>';
    return;
  }

  multas.forEach(multa => {
    tabla.innerHTML += `
      <tr>
        <td>${multa.nombres} ${multa.apellido_paterno} ${multa.apellido_materno || ''}</td>
        <td>${formatearMonto(multa.monto)}</td>
        <td>${multa.motivo}</td>
        <td>${formatearFecha(multa.fecha)}</td>
        <td></td>
        <td></td>
      </tr>
    `;
  });
}

function configurarFiltrosMultas() {
  const el = document.getElementById('buscar_multas');
  if (!el) return;
  el.addEventListener('input', () => renderizarTablaMultas(filtrarMultas()));
}

function limpiarFiltrosMultas() {
  const buscar = document.getElementById('buscar_multas');
  if (buscar) buscar.value = '';
  renderizarTablaMultas(filtrarMultas());
}

function cargarMultas() {

  fetch(`${API_URL}/multas`, { headers: getAuthHeaders() })
    .then(res => res.json())
    .then(data => {

      if (!Array.isArray(data)) {
        mostrarAlerta(data.mensaje || 'No se pudo cargar la tabla de multas', 'warning');
        return;
      }

      multasTabla = data;
      renderizarTablaMultas(filtrarMultas());

    })
    .catch(err => console.error(err));

}

function seleccionarEventoMobile(id, nombre) {
  const select = document.getElementById('evento_id');
  if (select) {
    select.value = String(id);
    select.dispatchEvent(new Event('change'));
  }
  const label = document.getElementById('label_evento_mobile');
  if (label) label.textContent = nombre;
  const modalEl = document.getElementById('modal_eventos_activos');
  if (modalEl) {
    const modal = bootstrap.Modal.getInstance(modalEl);
    if (modal) modal.hide();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  actualizarBotonesEscaneoQr();

  const eventoSelect = document.getElementById('evento_id');
  if (eventoSelect) {
    eventoSelect.addEventListener('change', () => {
      actualizarBotonesEscaneoQr();
      cargarUltimosRegistros();
      ocultarAvisoSinEvento();
      const opt = eventoSelect.options[eventoSelect.selectedIndex];
      if (opt && opt.value) {
        intentarMatchingSinEvento(opt.value, opt.dataset.fecha || '');
      }
    });
  }

  const modalEl = document.getElementById('modal_eventos_activos');
  if (modalEl) {
    modalEl.addEventListener('show.bs.modal', () => {
      const select = document.getElementById('evento_id');
      const lista  = document.getElementById('lista_eventos_modal');
      if (!select || !lista) return;
      lista.innerHTML = '';
      const opciones = Array.from(select.options).filter(o => o.value);
      if (opciones.length === 0) {
        lista.innerHTML = '<p class="text-muted text-center py-3">No hay actividades activas.</p>';
        return;
      }
      opciones.forEach(o => {
        const btn = document.createElement('button');
        btn.className = 'btn-evento-item w-100 mb-2';
        btn.textContent = o.textContent;
        btn.onclick = () => seleccionarEventoMobile(o.value, o.textContent.trim());
        lista.appendChild(btn);
      });
    });
  }
});

function cargarUltimosRegistros() {
  const eventoId = document.getElementById('evento_id')?.value;
  const wrapper = document.getElementById('ultimos_registros_wrapper');
  const tbody = document.getElementById('ultimos_registros_body');
  if (!wrapper || !tbody) return;

  if (!eventoId) {
    wrapper.classList.add('d-none');
    return;
  }

  const registros = asistenciasTabla
    .filter(a => String(a.evento_id) === String(eventoId))
    .slice(0, 5);

  if (registros.length === 0) {
    wrapper.classList.add('d-none');
    return;
  }

  tbody.innerHTML = registros.map(a => {
    const dt = a.fecha_registro ? new Date(String(a.fecha_registro).replace(' ', 'T')) : null;
    const hora = dt && !Number.isNaN(dt.getTime())
      ? dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
      : '';
    return `<tr><td>${a.nombres} ${a.apellido_paterno}</td><td>${obtenerBadgeAsistencia(a.estado)}</td><td>${hora}</td></tr>`;
  }).join('');
  wrapper.classList.remove('d-none');
}

// =====================================
// ASISTENCIAS SIN EVENTO — OFFLINE
// =====================================

function mostrarAvisoSinEvento() {
  document.getElementById('aviso_sin_evento')?.classList.remove('d-none');
}

function ocultarAvisoSinEvento() {
  document.getElementById('aviso_sin_evento')?.classList.add('d-none');
}

const MARGEN_AMBIGUEDAD_MATCHING_MS = 15 * 60 * 1000;

function eventoMasCercano(regTimestamp, eventosDelDia) {
  if (!eventosDelDia || eventosDelDia.length === 0) return null;
  if (eventosDelDia.length === 1) return eventosDelDia[0];

  const regTime = new Date(regTimestamp).getTime();
  const candidatos = eventosDelDia
    .map(ev => {
      const evTime = new Date(String(ev.fecha).replace(' ', 'T')).getTime();
      return { ev, diff: Number.isNaN(evTime) ? Infinity : Math.abs(regTime - evTime) };
    })
    .sort((a, b) => a.diff - b.diff);

  const [mejor, siguiente] = candidatos;
  return siguiente && (siguiente.diff - mejor.diff) >= MARGEN_AMBIGUEDAD_MATCHING_MS
    ? mejor.ev
    : null;
}

// Cuando se selecciona un evento, intenta asignar los registros sin_evento
// cuyo timestamp coincide con la fecha del evento seleccionado.
async function intentarMatchingSinEvento(eventoId, fechaEvento) {
  if (!eventoId || !fechaEvento) return;
  const sinEvento = await obtenerAsistenciasSinEvento();
  if (sinEvento.length === 0) return;

  const fechaDia = String(fechaEvento).substring(0, 10);
  const eventosDelDia = (eventosAsistencia || []).filter(ev =>
    String(ev.fecha || '').substring(0, 10) === fechaDia
  );
  let asignados = 0;

  for (const reg of sinEvento) {
    const dt = new Date(reg.timestamp);
    const fechaReg = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (fechaReg !== fechaDia) continue;

    const evento = eventoMasCercano(reg.timestamp, eventosDelDia);
    if (!evento || String(evento.id) !== String(eventoId)) continue;

    await actualizarRegistroOffline(reg.id, {
      evento_id:  Number(eventoId),
      estadoSync: 'pendiente'
    });
    asignados++;
  }

  if (asignados > 0) {
    mostrarAlerta(
      `${asignados} escaneo(s) sin actividad asignado(s) a esta actividad`,
      'info'
    );
    actualizarBadgeOffline();
    sincronizarManual();
    cargarPanelSinEvento();
  }
}

// =====================================
// PANEL "SIN ASIGNAR" — SUBTAB TABLAS
// =====================================

// Asigna automáticamente registros sin_evento cuando hay exactamente
// un evento ese día (sin ambigüedad).
async function autoMatchingSinEvento() {
  if (!Array.isArray(eventosCargados) || eventosCargados.length === 0) return 0;

  const sinEvento = await obtenerAsistenciasSinEvento();
  if (sinEvento.length === 0) return 0;

  const porFecha = {};
  for (const reg of sinEvento) {
    const dt = new Date(reg.timestamp);
    const fechaReg = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (!porFecha[fechaReg]) porFecha[fechaReg] = [];
    porFecha[fechaReg].push(reg);
  }

  let totalAsignados = 0;

  for (const [fecha, registros] of Object.entries(porFecha)) {
    const eventosDelDia = eventosCargados.filter(ev =>
      String(ev.fecha || '').substring(0, 10) === fecha
    );

    if (eventosDelDia.length === 0) continue;

    for (const reg of registros) {
      const evento = eventoMasCercano(reg.timestamp, eventosDelDia);
      if (!evento) continue;
      await actualizarRegistroOffline(reg.id, {
        evento_id:  Number(evento.id),
        estadoSync: 'pendiente'
      });
      totalAsignados++;
    }
  }

  return totalAsignados;
}

async function cargarPanelSinEvento() {
  const tbody  = document.getElementById('tabla_sin_evento');
  const badge  = document.getElementById('badge_sin_evento');
  if (!tbody) return;

  const autoAsignados = await autoMatchingSinEvento();
  if (autoAsignados > 0) {
    mostrarAlerta(`${autoAsignados} escaneo(s) asignado(s) automáticamente a su actividad`, 'info');
    actualizarBadgeOffline();
    sincronizarManual();
  }

  const registros = await obtenerAsistenciasSinEvento();

  if (badge) {
    badge.textContent = registros.length;
    badge.classList.toggle('d-none', registros.length === 0);
  }

  if (registros.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Sin registros pendientes</td></tr>';
    return;
  }

  const _hoyDt = new Date();
  const hoy = `${_hoyDt.getFullYear()}-${String(_hoyDt.getMonth() + 1).padStart(2, '0')}-${String(_hoyDt.getDate()).padStart(2, '0')}`;

  tbody.innerHTML = registros.map(reg => {
    const persona   = personasTabla.find(p => String(p.id) === String(reg.persona_id));
    const nombre    = persona
      ? `${persona.nombres} ${persona.apellido_paterno} ${persona.apellido_materno || ''}`.trim()
      : `Persona #${reg.persona_id}`;
    const rut       = persona ? (persona.rut || '—') : '—';
    const dt        = new Date(reg.timestamp);
    const fechaReg  = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const hora      = dt.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const fechaStr  = fechaReg === hoy ? `Hoy ${hora}` : `${fechaReg} ${hora}`;

    const eventosDelDia = (eventosCargados || []).filter(ev =>
      String(ev.fecha || '').substring(0, 10) === fechaReg
    );

    const opcionesEventos = eventosDelDia.length
      ? eventosDelDia.map(ev =>
          `<option value="${ev.id}" data-fecha="${ev.fecha}">${ev.nombre}</option>`
        ).join('')
      : `<option value="" disabled>Sin actividades ese día</option>`;

    return `
      <tr>
        <td>${nombre}</td>
        <td>${rut}</td>
        <td>${fechaStr}</td>
        <td>
          <select class="form-select form-select-sm" id="sel_sin_evento_${reg.id}">
            <option value="">Seleccionar...</option>
            ${opcionesEventos}
          </select>
        </td>
        <td>
          <button class="btn btn-sm btn-success"
            onclick="asignarRegistroSinEvento('${reg.id}')">
            <i class="bi bi-check-lg"></i> Asignar
          </button>
          <button class="btn btn-sm btn-outline-danger ms-1"
            onclick="descartarRegistroSinEvento('${reg.id}')">
            <i class="bi bi-trash"></i>
          </button>
        </td>
      </tr>`;
  }).join('');
}

async function asignarRegistroSinEvento(id) {
  const sel = document.getElementById(`sel_sin_evento_${id}`);
  if (!sel || !sel.value) {
    mostrarAlerta('Selecciona una actividad antes de asignar.', 'warning');
    return;
  }
  const eventoId = Number(sel.value);
  await actualizarRegistroOffline(id, { evento_id: eventoId, estadoSync: 'pendiente' });
  mostrarAlerta('Registro asignado. Se sincronizará cuando haya conexión.', 'success');
  actualizarBadgeOffline();
  sincronizarManual();
  cargarPanelSinEvento();
}

async function descartarRegistroSinEvento(id) {
  if (!confirm('¿Eliminar este registro sin asignar?')) return;
  await eliminarAsistenciaOffline(id);
  actualizarBadgeOffline();
  cargarPanelSinEvento();
}
