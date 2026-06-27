// =====================================
// REGISTRAR ASISTENCIA EVENTO
// =====================================

// Cache de personas para búsqueda QR
// Evita fetch repetido en cada escaneo
let personasTabla = [];
let qrAsistenciaStream = null;
let qrAsistenciaDetector = null;
let qrAsistenciaEscaneando = false;
let qrAsistenciaUltimaLectura = '';
let qrAsistenciaCanvas = null;

function registrarAsistencia() {

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

      mostrarAlerta(
        'Seleccione una actividad',
        'warning'
      );

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

      // Registra asistencia en backend
      fetch(`${API_URL}/asistencia`, {

        method: 'POST',

        headers: getAuthHeaders(),

        body: JSON.stringify(data)

      })

      .then(async res => {
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : { mensaje: await res.text() };

  if (!res.ok) {
    throw new Error(
      data.mensaje || 'No se pudo registrar la asistencia'
    );
  }

  return data;
})
.then(response => {

document.getElementById('respuesta').innerText =
  response.mensaje || 'Asistencia registrada';

mostrarAlerta(
  response.mensaje || 'Asistencia registrada',
  'success'
);

      // Refresca automáticamente:
      // asistencias
      // multas
      // finanzas
      // dashboard
      // gráficos
      cargarAsistencias();
      cargarMultas();
      cargarFinanzas();
      cargarDashboard();
      cargarGraficos();

    })

    .catch(err => {

    console.error(err);

    // Evita registros duplicados
    // misma persona + mismo evento
    mostrarAlerta(
  err.message,
  'danger'
);

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
          facingMode: 'environment'
        }
      });

    video.srcObject = qrAsistenciaStream;
    await video.play();

    wrapper.classList.remove('d-none');
    document.getElementById('btn_iniciar_qr').disabled = true;
    document.getElementById('btn_detener_qr').disabled = false;

    qrAsistenciaEscaneando = true;
    qrAsistenciaUltimaLectura = '';
    actualizarEstadoQrAsistencia(
      qrAsistenciaDetector
        ? 'Camara activa. Acerque la credencial o carnet al lector.'
        : 'Camara activa en modo compatible. Acerque bien el QR al lector.',
      'primary'
    );

    escanearFrameAsistencia();
  } catch (err) {
    console.error(err);
    actualizarEstadoQrAsistencia(
      'No se pudo iniciar la camara. Revise permisos o use lectura manual.',
      'danger'
    );
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

  const btnDetener =
    document.getElementById('btn_detener_qr');

  actualizarBotonesEscaneoQr();

  if (btnDetener) {
    btnDetener.disabled = true;
  }
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
    const lectura =
      qrAsistenciaDetector
        ? await detectarLecturaNativaAsistencia(video)
        : detectarLecturaCompatibleAsistencia(video);

    if (lectura && lectura !== qrAsistenciaUltimaLectura) {
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

async function detectarLecturaNativaAsistencia(video) {
  const codigos =
    await qrAsistenciaDetector.detect(video);

  if (codigos.length === 0) {
    return '';
  }

  return codigos[0].rawValue || '';
}

function detectarLecturaCompatibleAsistencia(video) {
  if (typeof jsQR !== 'function') {
    actualizarEstadoQrAsistencia(
      'No se pudo cargar el lector compatible. Recargue la pagina o use lectura manual.',
      'warning'
    );
    return '';
  }

  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth === 0 ||
    video.videoHeight === 0
  ) {
    return '';
  }

  if (!qrAsistenciaCanvas) {
    qrAsistenciaCanvas =
      document.createElement('canvas');
  }

  const contexto =
    qrAsistenciaCanvas.getContext('2d', {
      willReadFrequently: true
    });

  qrAsistenciaCanvas.width =
    video.videoWidth;

  qrAsistenciaCanvas.height =
    video.videoHeight;

  contexto.drawImage(
    video,
    0,
    0,
    qrAsistenciaCanvas.width,
    qrAsistenciaCanvas.height
  );

  const imagen =
    contexto.getImageData(
      0,
      0,
      qrAsistenciaCanvas.width,
      qrAsistenciaCanvas.height
    );

  const codigo =
    jsQR(
      imagen.data,
      imagen.width,
      imagen.height,
      {
        inversionAttempts: 'dontInvert'
      }
    );

  return codigo ? codigo.data : '';
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
    btnIniciar.disabled = !hayEvento || cerrado;
  }

  if (textoIniciar) {
    textoIniciar.textContent = !hayEvento
      ? 'Seleccione una actividad primero'
      : cerrado
      ? 'Actividad finalizada'
      : 'Escanear QR';
  }

  if (btnManual) {
    btnManual.disabled = !hayEvento || cerrado;
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

  console.log('[QR] lectura recibida:', lectura);
  console.log('[QR] datos extraídos:', datos);
  console.log('[QR] personas cargadas:', personas.length);
  if (datos.rut) {
    console.log('[QR] RUTs en BD:', personas.map(p => normalizarRutAsistencia(p.rut)));
  }

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

  // Si el caché ya tiene datos, lo devuelve directo
  // sin hacer otro fetch al servidor
  if (Array.isArray(personasTabla) && personasTabla.length > 0) {
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

  // Guarda en caché para próximos escaneos
  personasTabla = data;

  return data.filter(
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

  if (estado) {
    estado.value =
      minutosAtraso > 0
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

// =====================================
// CARGAR HISTORIAL ASISTENCIAS
// =====================================

function cargarAsistencias() {

  fetch(`${API_URL}/asistencia`, {

  headers: getAuthHeaders()

})
    .then(res => res.json())
    .then(data => {

      const tabla = document.getElementById('tabla_asistencias');

      tabla.innerHTML = '';

      if (!Array.isArray(data)) {
  mostrarAlerta(
    data.mensaje || 'No se pudo cargar la tabla de asistencias',
    'warning'
  );
  return;
}

      data.forEach(asistencia => {

        // Estado visual asistencia
        tabla.innerHTML += `
          <tr>
            <td>${asistencia.nombres} ${asistencia.apellido_paterno} ${asistencia.apellido_materno || ''}</td>
            <td>${asistencia.evento}</td>
            <td>${
              asistencia.estado === 'presente'
              ? '<span class="badge bg-success">Presente</span>'
              : asistencia.estado === 'atrasado'
              ? '<span class="badge bg-warning text-dark">Atrasado</span>'
              : '<span class="badge bg-danger">Ausente</span>'
            }</td>
            <td>${asistencia.minutos_atraso}</td>
          </tr>
        `;

      });

    })
    .catch(err => console.error(err));

}

document.addEventListener('DOMContentLoaded', () => {
  const eventoSelect = document.getElementById('evento_id');
  if (eventoSelect) {
    eventoSelect.addEventListener('change', actualizarBotonesEscaneoQr);
  }
});
