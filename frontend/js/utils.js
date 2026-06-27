// =====================================
// CONFIGURACION GLOBAL API BACKEND
// =====================================

const API_URL = window.API_URL || window.location.origin;


/// =====================================
// ALERTAS VISUALES BOOTSTRAP
// =====================================

function mostrarAlerta(mensaje,tipo = 'success') {

  const container =
  document.getElementById(
    'alert_container'
  );

if (!container) return;

const alerta =
  document.createElement('div');

  alerta.className =

    `alert alert-${tipo} alert-dismissible fade show shadow`;

  alerta.role = 'alert';

  alerta.innerHTML = `

    ${mensaje}

    <button
      type="button"
      class="btn-close"
      data-bs-dismiss="alert">
    </button>

  `;

  // Inserta alerta visual en pantalla
  container.appendChild(alerta);

  // Elimina automáticamente la alerta
  setTimeout(() => {

    alerta.remove();

  }, 4000);

}

function obtenerMensajeError(error, mensajeDefecto) {
  if (error && error.message) {
    return error.message;
  }

  return mensajeDefecto || 'No se pudo completar la operación';
}

async function leerRespuestaJson(res) {
  return res.json().catch(() => ({}));
}

// =====================================
// CONFIRMACION VISUAL BOOTSTRAP
// =====================================

function mostrarConfirmacion(mensaje, onConfirmar) {

  const idModal = 'modal_confirmacion_app';

  const modalAnterior =
    document.getElementById(idModal);

  if (modalAnterior) {
    modalAnterior.remove();
  }

  const modal =
    document.createElement('div');

  modal.className = 'modal fade';
  modal.id = idModal;
  modal.tabIndex = -1;

  modal.innerHTML = `

    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content">

        <div class="modal-header">
          <h5 class="modal-title">
            Confirmar acción
          </h5>

          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal">
          </button>
        </div>

        <div class="modal-body">
          <p class="mb-0">
            ${mensaje}
          </p>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal">
            Cancelar
          </button>

          <button
            type="button"
            class="btn btn-success"
            id="btn_confirmar_accion">
            Confirmar
          </button>
        </div>

      </div>
    </div>

  `;

  document.body.appendChild(modal);

  const modalBootstrap =
    new bootstrap.Modal(modal);

  modal.querySelector('#btn_confirmar_accion')
    .addEventListener('click', () => {

      modalBootstrap.hide();

      if (typeof onConfirmar === 'function') {
        onConfirmar();
      }

    });

  modal.addEventListener('hidden.bs.modal', () => {
    modal.remove();
  });

  modalBootstrap.show();

}

// =====================================
// HEADERS AUTENTICADOS JWT
// =====================================

function getAuthHeaders() {

  // Envia token JWT para autenticar peticiones
  return {

    'Content-Type': 'application/json',

    Authorization:
      `Bearer ${localStorage.getItem('token')}`

  };

}

// ==============================
// LOGOUT -- CERRAR SESION
// ==============================

function logout() {

  localStorage.removeItem('token');

  localStorage.removeItem('usuario');

  window.location.href = 'login.html';

}

function cerrarSesion() {
  logout();
}

// =====================================
// MOSTRAR USUARIO AUTENTICADO
// =====================================

function mostrarUsuario() {

  const usuario =
    JSON.parse(
      localStorage.getItem('usuario')
    );

  if (!usuario) {
    return;
  }

  const config =
    window.APP_CONFIG || {};

  const rolesVisuales =
    config.rolesVisuales || {
      admin: 'Administrador',
      tesorero: 'Tesorero',
      entrenador: 'Encargado'
    };

  const rolVisual =
    rolesVisuales[usuario.rol] || usuario.rol;

  const usuarioLogeado =
    document.getElementById('usuario_logeado');

  if (usuarioLogeado) {

    usuarioLogeado.innerText =
      `${usuario.usuario} (${rolVisual})`;

  }

}

/// =====================================
// CONTROL VISUAL DE MODULOS POR ROL
// =====================================

function ocultarPorTitulo(texto) {
  document.querySelectorAll('h2').forEach(titulo => {
    if (titulo.textContent.trim() === texto) {
      const contenedor = titulo.closest('.module-section') || titulo.parentElement;

      if (contenedor) {
        contenedor.style.display = 'none';
      }
    }
  });
}

function ocultarSelector(selector) {
  document
    .querySelectorAll(selector)
    .forEach(elemento => {
      elemento.style.display = 'none';
    });
}

function ocultarElemento(id) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.style.display = 'none';
  }
}

function aplicarRolesFrontend() {
  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  if (!usuario) return;

  const rol = usuario.rol;

  if (rol === 'admin') {
    return;
  }

  if (rol === 'tesorero') {
  ocultarSelector('.nav-asistencias');
  ocultarSelector('.nav-eventos');

  ocultarElemento('modulo_asistencia');
  ocultarElemento('modulo_personas');
  ocultarElemento('eventos');
  ocultarElemento('asistencias');

  document
    .querySelectorAll('#tabla_personas button')
    .forEach(btn => {
      btn.style.display = 'none';
    });
}

  if (rol === 'entrenador') {
    ocultarSelector('.nav-multas');
    ocultarSelector('.nav-finanzas');

    ['modulo_personas',
      'modulo_multas',
      'modulo_finanzas',
      'modulo_pagos',
      'tabla_pagos_wrapper',
      'card_dashboard_multas',
      'card_dashboard_pagado',
      'card_dashboard_deuda',
      'grafico_multas_wrapper',
      'grafico_deuda_wrapper',
      'titulo_multas',
      'titulo_finanzas',
      'titulo_pagos'
    ].forEach(ocultarElemento);

    document
      .querySelectorAll('#tabla_personas button')
      .forEach(btn => {
      btn.style.display = 'none';
    });
  }

  const btnGenerarCuotas =
    document.getElementById('btn_generar_cuotas');

  if (
    btnGenerarCuotas &&
    rol !== 'admin' &&
    rol !== 'tesorero'
  ) {
    btnGenerarCuotas.style.display = 'none';
  }

  if (rol === 'tesorero' || rol === 'entrenador') {
  document
    .querySelectorAll('#tabla_personas button')
    .forEach(btn => {
      btn.style.display = 'none';
    });
  }

}

// =====================================
// FORMATEAR FECHAS
// =====================================

function formatearFecha(fecha) {

  if (!fecha) {

    return '';

  }

  const fechaLimpia =
    fecha.split('T')[0];

  const partes =
    fechaLimpia.split('-');

  if (partes.length !== 3) {

    return fechaLimpia;

  }

  const anio =
    partes[0];

  const mes =
    partes[1];

  const dia =
    partes[2];

  return `${dia}-${mes}-${anio}`;

}

// =====================================
// APLICAR CONFIGURACION VISUAL
// =====================================

function aplicarConfiguracionVisual() {

  const config =
    window.APP_CONFIG || {};

  const producto =
    config.producto || {};

  const cliente =
    config.cliente || {};

  const nombreSistema =
    producto.nombre || 'NexoComunidad';

  const nombreCliente =
    cliente.nombre || nombreSistema;

  document.querySelectorAll('[data-config="producto.nombre"]')
    .forEach(elemento => {
      elemento.innerText = nombreSistema;
    });

  document.querySelectorAll('[data-config="cliente.nombre"]')
    .forEach(elemento => {
      elemento.innerText = nombreCliente;
    });

      document.querySelectorAll('[data-config-img="cliente.logo"]')
    .forEach(elemento => {
      if (cliente.logo) {
        elemento.src = cliente.logo;
        elemento.alt = nombreCliente;
      }
    });

      document.title =
    `${nombreCliente} | ${nombreSistema}`;

      const obtenerValorConfig = ruta => {

    return ruta
      .split('.')
      .reduce(
        (actual, clave) => actual && actual[clave],
        config
      );

  };

  document.querySelectorAll('[data-config-text]')
    .forEach(elemento => {

      const texto =
        obtenerValorConfig(
          elemento.dataset.configText
        );

      if (texto) {
        elemento.innerText = texto;
      }

    });

  document.querySelectorAll('[data-config-placeholder]')
    .forEach(elemento => {

      const texto =
        obtenerValorConfig(
          elemento.dataset.configPlaceholder
        );

      if (texto) {
        elemento.placeholder = texto;
      }

    });

}

function formatearMonto(valor) {
  const monto =
    Number(valor || 0);

  return new Intl.NumberFormat(
    'es-CL',
    {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0
    }
  ).format(monto);
}

function crearBadge(texto, clase) {
  return `<span class="badge ${clase}">${texto}</span>`;
}

function obtenerBadgeAsistencia(estado) {
  const badges = {
    presente: crearBadge('Presente', 'bg-success'),
    atrasado: crearBadge('Atrasado', 'bg-warning text-dark'),
    ausente: crearBadge('Ausente', 'bg-danger')
  };

  return badges[estado] || crearBadge('Sin estado', 'bg-secondary');
}

function obtenerBadgeCuota(estado) {
  const badges = {
    pagado: crearBadge('Pagado', 'bg-success'),
    vencido: crearBadge('Vencido', 'bg-danger'),
    pendiente: crearBadge('Pendiente', 'bg-warning text-dark')
  };

  return badges[estado] || crearBadge('Sin estado', 'bg-secondary');
}

function obtenerBadgeFinanciero(deudaActual) {
  const deuda =
    Number(deudaActual || 0);

  if (deuda === 0) {
    return crearBadge('AL DIA', 'bg-success');
  }

  if (deuda < 0) {
    return crearBadge(
      `${formatearMonto(Math.abs(deuda))} (A FAVOR)`,
      'bg-primary'
    );
  }

  return crearBadge(
    `Deuda: ${formatearMonto(deuda)}`,
    'bg-danger'
  );
}

function bloquearBoton(id, textoCarga = 'Guardando...') {
  const boton =
    document.getElementById(id);

  if (!boton || boton.disabled) {
    return null;
  }

  const textoOriginal =
    boton.innerText;

  boton.disabled = true;
  boton.innerText = textoCarga;

  return {
    boton,
    textoOriginal
  };
}

function restaurarBoton(estadoBoton, textoFinal) {
  if (!estadoBoton) {
    return;
  }

  estadoBoton.boton.disabled = false;
  estadoBoton.boton.innerText =
    textoFinal || estadoBoton.textoOriginal;
}

function obtenerRolActual() {
  const usuario = JSON.parse(
    localStorage.getItem('usuario')
  );

  return usuario?.rol || 'admin';
}

function formatearFechaHora(fecha) {

  if (!fecha) {
    return '';
  }

  const fechaObjeto =
    new Date(String(fecha).replace(' ', 'T'));

  if (Number.isNaN(fechaObjeto.getTime())) {
    return formatearFecha(fecha);
  }

  const dia =
    String(fechaObjeto.getDate()).padStart(2, '0');

  const mes =
    String(fechaObjeto.getMonth() + 1).padStart(2, '0');

  const anio =
    fechaObjeto.getFullYear();

  const hora =
    String(fechaObjeto.getHours()).padStart(2, '0');

  const minutos =
    String(fechaObjeto.getMinutes()).padStart(2, '0');

  return `${dia}-${mes}-${anio} ${hora}:${minutos}`;

}
