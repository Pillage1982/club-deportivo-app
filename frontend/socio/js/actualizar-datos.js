// "Actualizar datos": paso obligatorio del primer ingreso, después de crear la contraseña
// (login -> cambiar-pin -> actualizar-datos -> index). Todos los campos son
// obligatorios salvo la fecha de ingreso (si se deja vacía se conserva la
// registrada); el servidor valida y normaliza igual (socioPerfilController) y no
// entrega la página personal hasta que esto se guarde (perfilSocioMiddleware).

let edadMayoria = 18;

window.onload = () => {
  if (!requireSocioLogin({ permitirDatosPendientes: true })) return;
  verificarExpiracionSocio();
  document.getElementById('fecha_nacimiento').addEventListener('change', actualizarSeccionApoderado);
  document.getElementById('form_datos').addEventListener('input', quitarMarcaAlCompletar);
  document.getElementById('form_datos').addEventListener('change', quitarMarcaAlCompletar);
  document.getElementById('form_datos').addEventListener('submit', e => {
    e.preventDefault();
    guardarDatosSocio();
  });
  cargarDatosSocio();
};

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

      ['telefono', 'email', 'direccion', 'sexo', 'nombre_apoderado', 'telefono_apoderado']
        .forEach(campo => { document.getElementById(campo).value = datos[campo] || ''; });
      document.getElementById('fecha_nacimiento').value = String(datos.fecha_nacimiento || '').substring(0, 10);
      document.getElementById('fecha_ingreso').value = String(datos.fecha_ingreso || '').substring(0, 10);

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
    ['Bloque', datos.bloque || '—'],
    ['Estado', datos.estado]
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

  if (esMenorDeEdad()) {
    datos.nombre_apoderado = valor('nombre_apoderado');
    datos.telefono_apoderado = valor('telefono_apoderado');
  }

  if (marcarCamposFaltantes(datos)) {
    respuesta.innerHTML = alertaHtml('warning', 'Completa los campos marcados en rojo antes de continuar');
    return;
  }

  // Opcional: se agrega después de marcar faltantes para que vacía no se marque
  // en rojo; si no se envía, el servidor conserva la fecha registrada.
  const fechaIngreso = valor('fecha_ingreso');
  if (fechaIngreso) datos.fecha_ingreso = fechaIngreso;

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

// Marca en rojo cada campo vacío, lleva el foco al primero y devuelve true si
// falta alguno. La marca se quita al completarlo.
function marcarCamposFaltantes(datos) {
  let primero = null;

  Object.entries(datos).forEach(([campo, valor]) => {
    const elemento = document.getElementById(campo);
    if (!elemento) return;
    elemento.classList.toggle('campo-faltante', !valor);
    if (!valor && !primero) primero = elemento;
  });

  if (primero) {
    primero.scrollIntoView({ behavior: 'smooth', block: 'center' });
    primero.focus({ preventScroll: true });
  }
  return !!primero;
}

function quitarMarcaAlCompletar(evento) {
  if (evento.target.value) {
    evento.target.classList.remove('campo-faltante');
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
