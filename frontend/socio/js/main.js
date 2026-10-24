// Portal del Socio: navegación entre las 4 pantallas y carga de datos propios
// (solo lectura) desde /socio-auth/mi-*. Cada pantalla se carga una sola vez
// (cache en memoria) y se refresca al volver a entrar a index.html.
//
// Sin módulo de puntaje en esta rama (específico de cliente/calamena). La deuda
// SÍ incluye multas aquí (a diferencia de calamena), por eso Finanzas muestra
// una tabla de multas además de cuotas y pagos.

const cachePantallas = {};

window.onload = () => {
  if (!requireSocioLogin()) return;

  verificarExpiracionSocio();

  const nombre = localStorage.getItem('socio_nombre');
  if (nombre) document.getElementById('txt_nombre_socio').textContent = nombre;

  mostrarPantalla('inicio');
};

function mostrarPantalla(nombre) {
  document.querySelectorAll('.socio-pantalla').forEach(el => el.classList.add('d-none'));
  document.getElementById(`pantalla_${nombre}`).classList.remove('d-none');

  document.querySelectorAll('.socio-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.pantalla === nombre);
  });

  if (!cachePantallas[nombre]) {
    cachePantallas[nombre] = true;
    cargarPantalla(nombre);
  }
}

function cargarPantalla(nombre) {
  if (nombre === 'inicio') return cargarInicio();
  if (nombre === 'ficha') return cargarFicha();
  if (nombre === 'finanzas') {
    cargarDepositosSocio();
    return cargarFinanzas();
  }
  if (nombre === 'asistencia') return cargarAsistencia();
}

function badgeEstado(estado) {
  const mapa = {
    activo: ['bg-success', 'Activo'],
    receso: ['bg-warning text-dark', 'En receso'],
    inactivo: ['bg-secondary', 'Inactivo']
  };
  const [clase, texto] = mapa[estado] || ['bg-secondary', estado || '—'];
  return `<span class="badge ${clase}">${texto}</span>`;
}

// =====================================
// INICIO
// =====================================
function cargarInicio() {
  Promise.all([
    fetch(`${API_URL}/socio-auth/mi-finanzas`, { headers: getAuthHeadersSocio() }).then(r => r.json()),
    fetch(`${API_URL}/socio-auth/mi-asistencia`, { headers: getAuthHeadersSocio() }).then(r => r.json()),
    fetch(`${API_URL}/socio-auth/mi-ficha`, { headers: getAuthHeadersSocio() }).then(r => r.json())
  ])
    .then(([finanzas, asistencias, ficha]) => {
      document.getElementById('badge_estado_socio').innerHTML = badgeEstado(ficha.estado);

      const deudaEl = document.getElementById('inicio_deuda');
      deudaEl.textContent = formatearMonto(finanzas.deuda_actual);
      deudaEl.style.color = finanzas.deuda_actual > 0 ? '#c0392b' : '#2e7d32';

      const listaEventos = document.getElementById('inicio_ultimos_eventos');
      const ultimos = asistencias.slice(0, 5);

      if (!ultimos.length) {
        listaEventos.innerHTML = '<p class="text-muted small mb-0">Todavía no tienes eventos registrados.</p>';
        return;
      }

      listaEventos.innerHTML = ultimos.map(a => `
        <div class="item">
          <span>${escaparHtml(a.evento)}</span>
          <span>${formatearFecha(a.fecha_evento)}</span>
        </div>
      `).join('');
    })
    .catch(err => console.error('Error cargando Inicio:', err));
}

// =====================================
// MI FICHA
// =====================================
function cargarFicha() {
  fetch(`${API_URL}/socio-auth/mi-ficha`, { headers: getAuthHeadersSocio() })
    .then(res => res.json())
    .then(ficha => {
      const nombreCompleto = `${ficha.nombres} ${ficha.apellido_paterno} ${ficha.apellido_materno || ''}`.trim();

      document.getElementById('ficha_datos').innerHTML = `
        <dl class="socio-desglose">
        ${filaFicha('Nombre completo', escaparHtml(nombreCompleto))}
        ${filaFicha('RUT', escaparHtml(ficha.rut))}
        ${filaFicha('Estado', badgeEstado(ficha.estado))}
        ${filaFicha('Bloque', escaparHtml(ficha.bloque || '—'))}
        ${filaFicha('Sexo', escaparHtml(ficha.sexo || '—'))}
        ${filaFicha('Fecha de nacimiento', formatearFecha(ficha.fecha_nacimiento) || '—')}
        ${filaFicha('Fecha de ingreso', formatearFecha(ficha.fecha_ingreso) || '—')}
        ${filaFicha('Teléfono', escaparHtml(ficha.telefono || '—'))}
        ${filaFicha('Dirección', escaparHtml(ficha.direccion || '—'))}
        </dl>
      `;
    })
    .catch(err => console.error('Error cargando ficha:', err));
}

function filaFicha(etiqueta, valor) {
  return `<dt>${etiqueta}</dt><dd>${valor}</dd>`;
}

// =====================================
// FINANZAS
// =====================================
function cargarFinanzas() {
  fetch(`${API_URL}/socio-auth/mi-finanzas`, { headers: getAuthHeadersSocio() })
    .then(res => res.json())
    .then(data => {
      const deudaEl = document.getElementById('finanzas_deuda');
      deudaEl.textContent = formatearMonto(data.deuda_actual);
      deudaEl.style.color = data.deuda_actual > 0 ? '#c0392b' : '#2e7d32';

      const tablaCuotas = document.getElementById('tabla_finanzas_cuotas');
      tablaCuotas.innerHTML = data.cuotas.length
        ? data.cuotas.map(c => `
            <tr>
              <td>${nombreMes(c.mes)}/${c.anio}</td>
              <td>${formatearMonto(c.monto)}</td>
              <td>${badgeEstadoCuota(c.estado)}
                ${c.estado !== 'pagado' && Number(c.monto_pagado) > 0
                  ? `<span class="badge bg-info text-dark ms-1">Abono ${formatearMonto(c.monto_pagado)}</span>`
                  : ''}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin cuotas registradas</td></tr>';

      const tablaPagos = document.getElementById('tabla_finanzas_pagos');
      tablaPagos.innerHTML = data.pagos.length
        ? data.pagos.map(p => `
            <tr>
              <td>${formatearFecha(p.fecha)}</td>
              <td>${formatearMonto(p.monto_total)}
                ${p.tipo_pago && p.tipo_pago !== 'cuota'
                  ? `<div class="small text-muted">${escaparHtml(p.tipo_pago === 'inscripcion' ? 'Inscripción' : (p.detalle || 'Otro'))}</div>`
                  : ''}</td>
              <td>${escaparHtml(p.metodo || '—')}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin pagos registrados</td></tr>';

      const tablaMultas = document.getElementById('tabla_finanzas_multas');
      tablaMultas.innerHTML = data.multas.length
        ? data.multas.map(m => `
            <tr>
              <td>${formatearFecha(m.fecha)}</td>
              <td>${escaparHtml(m.motivo || '—')}</td>
              <td>${formatearMonto(m.monto)}</td>
              <td>${badgeEstadoMulta(m.estado)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4" class="text-center text-muted">Sin multas registradas</td></tr>';
    })
    .catch(err => console.error('Error cargando finanzas:', err));
}

function badgeEstadoCuota(estado) {
  const mapa = {
    pagado: 'bg-success',
    pendiente: 'bg-warning text-dark',
    vencido: 'bg-danger'
  };
  return `<span class="badge ${mapa[estado] || 'bg-secondary'}">${escaparHtml(estado)}</span>`;
}

function badgeEstadoMulta(estado) {
  const mapa = { pendiente: 'bg-warning text-dark', pagado: 'bg-success' };
  return `<span class="badge ${mapa[estado] || 'bg-secondary'}">${escaparHtml(estado || '—')}</span>`;
}

// =====================================
// ASISTENCIA
// =====================================
function cargarAsistencia() {
  fetch(`${API_URL}/socio-auth/mi-asistencia`, { headers: getAuthHeadersSocio() })
    .then(res => res.json())
    .then(asistencias => {
      const tabla = document.getElementById('tabla_asistencia');
      tabla.innerHTML = asistencias.length
        ? asistencias.map(a => `
            <tr>
              <td>${formatearFecha(a.fecha_evento)}</td>
              <td>${escaparHtml(a.evento)}</td>
              <td>${badgeEstadoAsistencia(a.estado)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin asistencias registradas</td></tr>';
    })
    .catch(err => console.error('Error cargando asistencia:', err));
}

// =====================================
// DEPÓSITOS (pestaña Finanzas): datos de la cuenta y comprobantes a tesorería
// =====================================
function cargarDepositosSocio() {
  fetch(`${API_URL}/socio-auth/depositos`, { headers: getAuthHeadersSocio() })
    .then(res => res.json())
    .then(data => {
      renderizarCuentaDeposito(data.cuenta_deposito || {});
      const tabla = document.getElementById('tabla_depositos_socio');
      const comprobantes = Array.isArray(data.comprobantes) ? data.comprobantes : [];
      tabla.innerHTML = comprobantes.length
        ? comprobantes.map(c => `
            <tr>
              <td>${Number(c.id)}</td>
              <td>${formatearFecha(c.fecha_deposito)}</td>
              <td>${formatearMonto(c.monto)}</td>
              <td>${c.pago_id
                ? '<span class="badge bg-success">Registrado</span>'
                : '<span class="badge bg-warning text-dark">En revisión</span>'}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4" class="text-center text-muted">Aún no envías comprobantes</td></tr>';
    })
    .catch(err => console.error('Error cargando depósitos:', err));
}

function renderizarCuentaDeposito(cuenta) {
  const contenedor = document.getElementById('deposito_cuenta');
  if (!cuenta.numero) {
    contenedor.innerHTML = '<span class="text-muted">La directiva aún no registra los datos de la cuenta. Pídeselos a tesorería.</span>';
    return;
  }
  const filas = [
    ['Titular', cuenta.titular],
    ['RUT', cuenta.rut],
    ['Banco', cuenta.banco],
    ['Tipo de cuenta', cuenta.tipo_cuenta],
    ['Número', cuenta.numero],
    ['Email', cuenta.email]
  ].filter(([, valor]) => valor);
  contenedor.innerHTML = `<dl class="mb-0">${filas.map(([etiqueta, valor]) => filaFicha(etiqueta, escaparHtml(valor))).join('')}</dl>`
    + (cuenta.nota ? `<p class="small text-muted mt-2 mb-0">${escaparHtml(cuenta.nota)}</p>` : '');
}

function enviarComprobanteDeposito(evento) {
  evento.preventDefault();
  const respuesta = document.getElementById('deposito_respuesta');
  const monto = document.getElementById('deposito_monto').value;
  const fecha = document.getElementById('deposito_fecha').value;
  const archivo = document.getElementById('deposito_archivo').files[0];

  if (!monto || Number(monto) < 100 || !fecha || !archivo) {
    respuesta.innerHTML = '<div class="alert alert-warning py-2 small mb-0">Completa monto, fecha y el archivo del comprobante.</div>';
    return;
  }

  const datos = new FormData();
  datos.append('monto', monto);
  datos.append('fecha_deposito', fecha);
  datos.append('concepto', document.getElementById('deposito_concepto').value.trim());
  datos.append('comprobante', archivo);

  const boton = document.getElementById('btn_enviar_deposito');
  boton.disabled = true;

  // Sin Content-Type: el navegador lo fija con el boundary del FormData.
  fetch(`${API_URL}/socio-auth/depositos`, {
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
      respuesta.innerHTML = `<div class="alert alert-success py-2 small mb-0">${escaparHtml(data.mensaje)}</div>`;
      document.getElementById('form_deposito').reset();
      cargarDepositosSocio();
    })
    .catch(err => {
      respuesta.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${escaparHtml(err.message)}</div>`;
    })
    .finally(() => { boton.disabled = false; });
}

document.getElementById('form_deposito')?.addEventListener('submit', enviarComprobanteDeposito);

function badgeEstadoAsistencia(estado) {
  const mapa = { presente: 'bg-success', atrasado: 'bg-warning text-dark', ausente: 'bg-danger' };
  const etiqueta = String(estado || '').replace(/_/g, ' ');
  return `<span class="badge ${mapa[estado] || 'bg-secondary'}">${escaparHtml(etiqueta)}</span>`;
}
