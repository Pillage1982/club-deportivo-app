// Portal del Socio: navegación entre las 4 pantallas y carga de datos propios
// (solo lectura) desde /socio-auth/mi-*. Cada pantalla se carga una sola vez
// (cache en memoria) y se refresca al volver a entrar a index.html.

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
  if (nombre === 'finanzas') return cargarFinanzas();
  if (nombre === 'asistencia') return cargarAsistenciaYPuntaje();
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
    fetch(`${API_URL}/socio-auth/mi-puntaje`, { headers: getAuthHeadersSocio() }).then(r => r.json()),
    fetch(`${API_URL}/socio-auth/mi-asistencia`, { headers: getAuthHeadersSocio() }).then(r => r.json()),
    fetch(`${API_URL}/socio-auth/mi-ficha`, { headers: getAuthHeadersSocio() }).then(r => r.json())
  ])
    .then(([finanzas, puntaje, asistencias, ficha]) => {
      document.getElementById('badge_estado_socio').innerHTML = badgeEstado(ficha.estado);

      const deudaEl = document.getElementById('inicio_deuda');
      deudaEl.textContent = formatearMonto(finanzas.deuda_actual);
      deudaEl.style.color = finanzas.deuda_actual > 0 ? '#c0392b' : '#2e7d32';

      document.getElementById('inicio_puntaje').textContent = puntaje.puntaje_total;
      document.getElementById('inicio_posicion').textContent = puntaje.posicion
        ? `Posición ${puntaje.posicion} de ${puntaje.total_integrantes}`
        : 'Sin posición en el ranking';

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

      if (ficha.nombre_apoderado) {
        document.getElementById('ficha_apoderado_wrapper').classList.remove('d-none');
        document.getElementById('ficha_apoderado').innerHTML = `
          <dl class="socio-desglose">
          ${filaFicha('Nombre', escaparHtml(ficha.nombre_apoderado))}
          ${filaFicha('Teléfono', escaparHtml(ficha.telefono_apoderado || '—'))}
          </dl>
        `;
      }
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
              <td>${badgeEstadoCuota(c.estado)}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin cuotas registradas</td></tr>';

      const tablaPagos = document.getElementById('tabla_finanzas_pagos');
      tablaPagos.innerHTML = data.pagos.length
        ? data.pagos.map(p => `
            <tr>
              <td>${formatearFecha(p.fecha)}</td>
              <td>${formatearMonto(p.monto_total)}</td>
              <td>${p.cuotas_cubiertas ? escaparHtml(p.cuotas_cubiertas) : '—'}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin pagos registrados</td></tr>';
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

// =====================================
// ASISTENCIA Y PUNTAJE
// =====================================
function cargarAsistenciaYPuntaje() {
  Promise.all([
    fetch(`${API_URL}/socio-auth/mi-puntaje`, { headers: getAuthHeadersSocio() }).then(r => r.json()),
    fetch(`${API_URL}/socio-auth/mi-asistencia`, { headers: getAuthHeadersSocio() }).then(r => r.json())
  ])
    .then(([puntaje, asistencias]) => {
      document.getElementById('puntaje_desglose').innerHTML = `
        <dl class="socio-desglose">
        ${filaFicha('Antigüedad', puntaje.puntos_antiguedad)}
        ${filaFicha('Cuotas', puntaje.puntos_cuotas)}
        ${filaFicha('Asistencia', puntaje.puntos_asistencia)}
        ${filaFicha('Total', `<strong>${puntaje.puntaje_total}</strong>`)}
        </dl>
        <p class="text-muted small mt-2 mb-0">
          ${puntaje.posicion ? `Posición ${puntaje.posicion} de ${puntaje.total_integrantes} integrantes` : 'Sin posición en el ranking actual'}
        </p>
      `;

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
    .catch(err => console.error('Error cargando asistencia y puntaje:', err));
}

function badgeEstadoAsistencia(estado) {
  const mapa = {
    presente: 'bg-success',
    atrasado: 'bg-warning text-dark',
    ausente: 'bg-danger',
    justificado: 'bg-info text-dark',
    licencia_medica: 'bg-info text-dark',
    vestimenta_distinta: 'bg-secondary',
    retiro_sin_aviso: 'bg-danger'
  };
  const etiqueta = String(estado || '').replace(/_/g, ' ');
  return `<span class="badge ${mapa[estado] || 'bg-secondary'}">${escaparHtml(etiqueta)}</span>`;
}
