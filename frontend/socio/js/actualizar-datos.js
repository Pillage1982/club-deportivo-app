// "Actualizar datos": paso obligatorio del primer ingreso, después de crear la contraseña
// (login -> cambiar-pin -> actualizar-datos -> index). Celular, email y fecha de
// nacimiento son obligatorios; el servidor valida y normaliza igual
// (socioPerfilController) y no entrega la página personal hasta que esto se guarde
// (perfilSocioMiddleware).

window.onload = () => {
  if (!requireSocioLogin({ permitirDatosPendientes: true })) return;
  verificarExpiracionSocio();
  document.getElementById('form_datos').addEventListener('input', quitarMarcaAlCompletar);
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
      mostrarDatosFijos(datos);
      document.getElementById('telefono').value = datos.telefono || '';
      document.getElementById('email').value = datos.email || '';
      document.getElementById('fecha_nacimiento').value = String(datos.fecha_nacimiento || '').substring(0, 10);

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
    ['Estado', datos.estado]
  ];

  document.getElementById('datos_fijos').innerHTML = filas.map(([etiqueta, valor]) => `
    <dt class="col-5">${etiqueta}</dt><dd class="col-7">${escaparHtml(valor)}</dd>
  `).join('');
}

function guardarDatosSocio() {
  const respuesta = document.getElementById('respuesta');
  const valor = id => document.getElementById(id).value.trim();

  const datos = {
    telefono: valor('telefono'),
    email: valor('email'),
    fecha_nacimiento: valor('fecha_nacimiento')
  };

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
