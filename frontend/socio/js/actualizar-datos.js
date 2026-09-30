// "Actualizar datos": paso obligatorio del primer ingreso, después de crear la contraseña
// (login -> cambiar-pin -> actualizar-datos -> index). Todos los campos son
// obligatorios; el servidor valida y normaliza igual (socioPerfilController) y no
// entrega la página personal hasta que esto se guarde (perfilSocioMiddleware).

const SACRAMENTOS = [
  { campo: 'bautizo', etiqueta: 'Bautizo' },
  { campo: 'comunion', etiqueta: 'Primera comunión' },
  { campo: 'confirmacion', etiqueta: 'Confirmación' }
];

let edadMayoria = 18;

window.onload = () => {
  if (!requireSocioLogin({ permitirDatosPendientes: true })) return;
  verificarExpiracionSocio();
  renderizarSacramentos();
  document.getElementById('fecha_nacimiento').addEventListener('change', actualizarSeccionApoderado);
  document.getElementById('form_datos').addEventListener('input', quitarMarcaAlCompletar);
  document.getElementById('form_datos').addEventListener('change', quitarMarcaAlCompletar);
  document.getElementById('form_datos').addEventListener('submit', e => {
    e.preventDefault();
    guardarDatosSocio();
  });
  cargarDatosSocio();
};

function renderizarSacramentos() {
  // Celular: una fila por sacramento. PC: los tres lado a lado (col-md-4).
  document.getElementById('sacramentos').innerHTML = SACRAMENTOS.map(s => `
    <div class="col-12 col-md-4">
      <div class="sacramento d-flex flex-md-column align-items-center align-items-md-start justify-content-between gap-2" id="sacramento_${s.campo}">
        <span>${s.etiqueta}</span>
        <div class="btn-group" role="group" aria-label="${s.etiqueta}">
          <input type="radio" class="btn-check" name="${s.campo}" id="${s.campo}_si" value="1">
          <label class="btn btn-sm btn-outline-light" for="${s.campo}_si">Sí</label>
          <input type="radio" class="btn-check" name="${s.campo}" id="${s.campo}_no" value="0">
          <label class="btn btn-sm btn-outline-light" for="${s.campo}_no">No</label>
        </div>
      </div>
    </div>
  `).join('');
}

function cargarDatosSocio() {
  fetch(`${API_URL}/socio-auth/mis-datos`, { headers: getAuthHeadersSocio() })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron cargar tus datos');
      return data;
    })
    .then(datos => {
      edadMayoria = Number(datos.edad_mayoria) || 18;
      mostrarDatosFijos(datos);

      ['telefono', 'email', 'direccion', 'sexo', 'nombre_apoderado', 'rut_apoderado', 'telefono_apoderado']
        .forEach(campo => { document.getElementById(campo).value = datos[campo] || ''; });
      document.getElementById('fecha_nacimiento').value = String(datos.fecha_nacimiento || '').substring(0, 10);

      SACRAMENTOS.forEach(({ campo }) => {
        if (datos[campo] === null || datos[campo] === undefined) return;
        const opcion = document.getElementById(`${campo}_${Number(datos[campo]) === 1 ? 'si' : 'no'}`);
        if (opcion) opcion.checked = true;
      });

      actualizarSeccionApoderado();
      document.getElementById('cargando').classList.add('d-none');
      document.getElementById('form_datos').classList.remove('d-none');
    })
    .catch(err => {
      console.error(err);
      document.getElementById('cargando').classList.add('d-none');
      document.getElementById('respuesta_carga').innerHTML = alertaHtml('danger', err.message);
    });
}

function mostrarDatosFijos(datos) {
  const nombre = `${datos.nombres || ''} ${datos.apellido_paterno || ''} ${datos.apellido_materno || ''}`.trim();
  const filas = [
    ['Nombre', nombre],
    ['RUT', datos.rut],
    ['Escuadra', datos.bloque || '—'],
    ['Estado', datos.estado],
    ['Fecha de ingreso', formatearFecha(datos.fecha_ingreso) || '—']
  ];
  if (Number(datos.es_honorario) === 1) filas.push(['Socio honorario', 'Sí']);

  document.getElementById('datos_fijos').innerHTML = filas.map(([etiqueta, valor]) => `
    <dt class="col-5">${etiqueta}</dt><dd class="col-7">${escaparHtml(valor)}</dd>
  `).join('');
}

function calcularEdad(fechaISO) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) return null;
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - anio;
  if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
  return edad;
}

function esMenorDeEdad() {
  const edad = calcularEdad(document.getElementById('fecha_nacimiento').value);
  return edad !== null && edad < edadMayoria;
}

function actualizarSeccionApoderado() {
  document.getElementById('seccion_apoderado').classList.toggle('d-none', !esMenorDeEdad());
}

function valorSacramento(campo) {
  const marcado = document.querySelector(`input[name="${campo}"]:checked`);
  return marcado ? Number(marcado.value) : null;
}

function guardarDatosSocio() {
  const respuesta = document.getElementById('respuesta');
  const valor = id => document.getElementById(id).value.trim();

  const datos = {
    telefono: valor('telefono'),
    email: valor('email'),
    direccion: valor('direccion'),
    fecha_nacimiento: valor('fecha_nacimiento'),
    sexo: valor('sexo')
  };
  SACRAMENTOS.forEach(({ campo }) => { datos[campo] = valorSacramento(campo); });

  const menor = esMenorDeEdad();
  if (menor) {
    datos.nombre_apoderado = valor('nombre_apoderado');
    datos.rut_apoderado = valor('rut_apoderado');
    datos.telefono_apoderado = valor('telefono_apoderado');
  }

  if (marcarCamposFaltantes(datos)) {
    respuesta.innerHTML = alertaHtml('warning', 'Completa los campos marcados en rojo antes de continuar');
    return;
  }

  const boton = document.getElementById('btn_guardar_datos');
  boton.disabled = true;
  boton.innerHTML = `<span class="spinner-border spinner-border-sm" role="status"></span> Guardando...`;

  fetch(`${API_URL}/socio-auth/mis-datos`, {
    method: 'PUT',
    headers: getAuthHeadersSocio(),
    body: JSON.stringify(datos)
  })
    .then(async res => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.mensaje || 'No se pudieron guardar tus datos');
      return data;
    })
    .then(() => {
      localStorage.setItem('socio_datos_actualizados', '1');
      window.location.href = 'index.html';
    })
    .catch(err => {
      boton.disabled = false;
      boton.innerHTML = 'Guardar y continuar';
      console.error(err);
      respuesta.innerHTML = alertaHtml('danger', err.message);
    });
}

// Marca en rojo cada campo vacío (y sacramento sin responder), lleva el foco al
// primero y devuelve true si falta alguno. La marca se quita al completarlo.
function marcarCamposFaltantes(datos) {
  let primero = null;

  Object.entries(datos).forEach(([campo, valor]) => {
    const esSacramento = SACRAMENTOS.some(s => s.campo === campo);
    const falta = esSacramento ? valor === null : !valor;
    const elemento = document.getElementById(esSacramento ? `sacramento_${campo}` : campo);
    if (!elemento) return;
    elemento.classList.toggle('campo-faltante', falta);
    if (falta && !primero) primero = esSacramento ? document.getElementById(`${campo}_si`) : elemento;
  });

  if (primero) {
    primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primero.focus({ preventScroll: true });
  }
  return !!primero;
}

function quitarMarcaAlCompletar(evento) {
  const objetivo = evento.target;
  if (objetivo.classList.contains('btn-check')) {
    document.getElementById(`sacramento_${objetivo.name}`)?.classList.remove('campo-faltante');
  } else if (objetivo.value) {
    objetivo.classList.remove('campo-faltante');
  }
}

function alertaHtml(tipo, mensaje) {
  const icono = tipo === 'danger' ? 'exclamation-triangle-fill' : 'exclamation-circle-fill';
  return `
    <div class="alert alert-${tipo} mt-3">
      <i class="bi bi-${icono}"></i>
      ${escaparHtml(mensaje)}
    </div>
  `;
}
