// Portal del Integrante: navegación entre las 5 pantallas y carga de datos propios
// (solo lectura) desde /socio-auth/mi-*; Documentos vive en documentos.js.
// Cada pantalla se carga una sola vez (cache en memoria) y se refresca al
// volver a entrar a index.html.

const cachePantallas = {};

// El día del cumpleaños, el saludo tiene prioridad sobre el aviso de pagos vencidos.
let cumpleEnPantalla = false;

window.onload = () => {
  if (!requireSocioLogin()) return;

  verificarExpiracionSocio();

  const nombre = localStorage.getItem('socio_nombre');
  if (nombre) document.getElementById('txt_nombre_socio').textContent = nombre;

  mostrarPantalla('inicio');

  // Una vez por sesión del navegador (login o reabrir la app) y cada vez que vuelve la conexión
  if (!sessionStorage.getItem('socio_aviso_vencidos')) revisarCuotasVencidas();
  window.addEventListener('online', revisarCuotasVencidas);
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
  if (nombre === 'documentos') return cargarDocumentos();
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

      revisarCumpleanos(ficha);

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
        listaEventos.innerHTML = '<p class="text-muted small mb-0">Todavía no tienes eventos registrados en esta temporada.</p>';
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
// SALUDO DE CUMPLEAÑOS
// =====================================
// Se muestra una sola vez al día si la fecha de nacimiento del integrante coincide
// (día y mes) con la fecha local del dispositivo. La marca en localStorage con la
// fecha de hoy evita repetirlo al recargar el Portal durante el mismo día.
function revisarCumpleanos(ficha) {
  if (!ficha || !ficha.fecha_nacimiento) return;

  const nacimiento = String(ficha.fecha_nacimiento).split(/[T ]/)[0].split('-');
  if (nacimiento.length !== 3) return;
  const mesNacimiento = Number(nacimiento[1]);
  const diaNacimiento = Number(nacimiento[2]);

  const hoy = new Date();
  if (hoy.getMonth() + 1 !== mesNacimiento || hoy.getDate() !== diaNacimiento) return;

  const claveHoy = `${hoy.getFullYear()}-${hoy.getMonth() + 1}-${hoy.getDate()}`;
  if (localStorage.getItem('socio_cumple_saludado') === claveHoy) return;
  localStorage.setItem('socio_cumple_saludado', claveHoy);

  const primerNombre = String(ficha.nombres || '').trim().split(/\s+/)[0] || 'integrante';
  document.getElementById('titulo_cumpleanos').textContent = `¡Feliz cumpleaños, ${primerNombre}!`;
  document.getElementById('cumple_mensaje').innerHTML =
    'La <strong>Gran Diablada Calameña</strong> te desea un día maravilloso. ' +
    '¡Gracias por ser parte de esta promesa! 🎉🎈';

  // Tiene prioridad hoy: no mostramos el aviso de pagos vencidos sobre el saludo,
  // y si alcanzó a abrirse (carrera entre ambas consultas), lo cerramos.
  cumpleEnPantalla = true;
  bootstrap.Modal.getInstance(document.getElementById('modal_cuotas_vencidas'))?.hide();

  lanzarConfeti();
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_cumpleanos')).show();
}

function lanzarConfeti() {
  const contenedor = document.getElementById('cumple_confeti');
  if (!contenedor) return;
  const colores = ['#f47a22', '#ffd54a', '#ffffff', '#e74c3c', '#2ecc71'];
  contenedor.innerHTML = Array.from({ length: 36 }, () => {
    const izquierda = (Math.random() * 100).toFixed(1);
    const retraso = (Math.random() * 2.5).toFixed(2);
    const duracion = (2 + Math.random() * 1.8).toFixed(2);
    const color = colores[Math.floor(Math.random() * colores.length)];
    return `<i style="left:${izquierda}%;background:${color};animation-delay:${retraso}s;animation-duration:${duracion}s"></i>`;
  }).join('');
}

// =====================================
// AVISO DE PAGOS VENCIDOS
// =====================================
// Si falla la consulta (sin conexión) no se marca como mostrado: se reintenta al
// volver la conexión (evento 'online').
function revisarCuotasVencidas() {
  const modalEl = document.getElementById('modal_cuotas_vencidas');
  if (modalEl.classList.contains('show')) return;

  fetch(`${API_URL}/socio-auth/mis-cuotas-vencidas`, { headers: getAuthHeadersSocio() })
    .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
    .then(data => {
      sessionStorage.setItem('socio_aviso_vencidos', '1');
      if (!data.cuotas.length || cumpleEnPantalla) return;

      document.getElementById('cuotas_vencidas_total').textContent = formatearMonto(data.total);
      document.getElementById('tabla_cuotas_vencidas').innerHTML = data.cuotas.map(c => `
        <tr>
          <td>${nombreMes(c.mes)}/${c.anio}</td>
          <td>${formatearFecha(c.fecha_vencimiento) || '—'}</td>
          <td>${formatearMonto(c.saldo)}${Number(c.monto_pagado) > 0
            ? ` <span class="badge bg-info text-dark">Abono ${formatearMonto(c.monto_pagado)}</span>`
            : ''}</td>
        </tr>
      `).join('');

      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    })
    .catch(err => console.error('Error revisando cuotas vencidas:', err));
}

function irADepositarDesdeAviso() {
  bootstrap.Modal.getOrCreateInstance(document.getElementById('modal_cuotas_vencidas')).hide();

  if (datosDocumentos) {
    mostrarPantalla('documentos');
    abrirDatosCuenta();
    return;
  }
  // Documentos aún no se cargó: se carga aquí para abrir la cuenta cuando llegue
  cachePantallas.documentos = true;
  mostrarPantalla('documentos');
  cargarDocumentos().then(abrirDatosCuenta);
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

// Finanzas, asistencia y puntaje vienen solo de la temporada vigente (desde la
// actividad "Inicia temporada"): el backend manda su inicio en temporada_desde.
function mostrarTemporada(desde) {
  const anio = Number(String(desde || '').substring(0, 4));
  if (!anio || anio < 2000) return;
  document.querySelectorAll('.socio-temporada').forEach(el => {
    el.textContent = `Temporada ${anio}-${anio + 1}, desde el ${formatearFecha(desde)}`;
  });
}

// =====================================
// FINANZAS
// =====================================
function cargarFinanzas() {
  fetch(`${API_URL}/socio-auth/mi-finanzas`, { headers: getAuthHeadersSocio() })
    .then(res => res.json())
    .then(data => {
      mostrarTemporada(data.temporada_desde);

      const deudaEl = document.getElementById('finanzas_deuda');
      // Deuda negativa = pagó más que las cuotas generadas: se muestra como saldo a favor
      deudaEl.textContent = data.deuda_actual < 0
        ? `${formatearMonto(-data.deuda_actual)} a favor`
        : formatearMonto(data.deuda_actual);
      deudaEl.style.color = data.deuda_actual > 0 ? '#c0392b' : '#2e7d32';

      const tablaCuotas = document.getElementById('tabla_finanzas_cuotas');
      tablaCuotas.innerHTML = data.cuotas.length
        ? data.cuotas.map(c => `
            <tr>
              <td>${nombreMes(c.mes)}/${c.anio}</td>
              <td>${formatearMonto(c.monto)}</td>
              <td>${badgeEstadoCuota(c.estado)}${c.estado !== 'pagado' && Number(c.monto_pagado) > 0
                ? ` <span class="badge bg-info text-dark">Abono ${formatearMonto(c.monto_pagado)}</span>`
                : ''}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin cuotas registradas en esta temporada</td></tr>';

      const tablaPagos = document.getElementById('tabla_finanzas_pagos');
      tablaPagos.innerHTML = data.pagos.length
        ? data.pagos.map(p => `
            <tr>
              <td>${formatearFecha(p.fecha)}</td>
              <td>${formatearMonto(p.monto_total)}</td>
              <td>${escaparHtml(descripcionPagoSocio(p))}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="3" class="text-center text-muted">Sin pagos registrados en esta temporada</td></tr>';
    })
    .catch(err => console.error('Error cargando finanzas:', err));
}

// Pagos extra (integración, traje, chaqueta, otro) se muestran con su tipo; los de cuota,
// con los meses que cubrieron.
function descripcionPagoSocio(p) {
  const tipos = { integracion: 'Cuota de integración', traje: 'Traje', chaqueta: 'Chaqueta institucional', otro: 'Otro' };
  if (p.tipo_pago && p.tipo_pago !== 'cuota') {
    const tipo = tipos[p.tipo_pago] || 'Otro';
    return p.detalle ? `${tipo} — ${p.detalle}` : tipo;
  }
  return p.cuotas_cubiertas || '—';
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
      mostrarTemporada(puntaje.temporada_desde);

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
        : '<tr><td colspan="3" class="text-center text-muted">Sin asistencias registradas en esta temporada</td></tr>';
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
