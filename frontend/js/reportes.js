// Exportaciones cliente: genera archivos Excel y PDF a partir de los datos ya cargados por cada módulo.
// =====================================
// REPORTES — EXPORTACIÓN PDF / EXCEL
// =====================================

function _nombreOrg() {
  return (window.APP_CONFIG && window.APP_CONFIG.nombreOrganizacion) || 'NexoComunidad';
}

function _fechaHoy() {
  return new Date().toLocaleDateString('es-CL');
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

function _xlsxDisponible() {
  if (!window.XLSX) {
    mostrarAlerta('Librería Excel no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _descargarExcel(rows, nombreHoja, nombreArchivo) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, nombreHoja);
  XLSX.writeFile(wb, `${nombreArchivo}_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
}

// ── Excel: Integrantes ────────────────────────────────────────────────────────

function exportarIntegrantesExcel() {
  if (!_xlsxDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const rows = personasTabla.map(p => ({
    'RUT':              p.rut || '',
    'Apellido paterno': p.apellido_paterno || '',
    'Apellido materno': p.apellido_materno || '',
    'Nombres':          p.nombres || '',
    'Bloque':           p.bloque || '',
    'Sexo':             p.sexo || '',
    'Email':            p.email || '',
    'Teléfono':         p.telefono || '',
    'Dirección':        p.direccion || '',
    'F. Nacimiento':    p.fecha_nacimiento ? String(p.fecha_nacimiento).substring(0, 10) : '',
    'F. Ingreso':       p.fecha_ingreso    ? String(p.fecha_ingreso).substring(0, 10)    : '',
    'Estado':           p.estado || 'activo',
    'Honorario':        p.es_honorario ? 'Sí' : 'No',
    'Apoderado':        p.nombre_apoderado   || '',
    'Tel. Apoderado':   p.telefono_apoderado || ''
  }));
  _descargarExcel(rows, 'Integrantes', 'integrantes');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Asistencia (matriz por actividad) ────────────────────────────────────

async function _obtenerDatosMatrizAsistencia() {
  const [resPersonas, resEventos, resAsistencia] = await Promise.all([
    fetch(`${API_URL}/personas`,  { headers: getAuthHeaders() }),
    fetch(`${API_URL}/eventos`,   { headers: getAuthHeaders() }),
    fetch(`${API_URL}/asistencia`, { headers: getAuthHeaders() })
  ]);
  const [personas, eventos, asistencias] = await Promise.all([
    resPersonas.json().catch(() => ({})),
    resEventos.json().catch(() => ({})),
    resAsistencia.json().catch(() => ({}))
  ]);
  if (!resPersonas.ok  || !Array.isArray(personas))    throw new Error(personas.mensaje    || 'No se pudieron cargar los integrantes');
  if (!resEventos.ok   || !Array.isArray(eventos))     throw new Error(eventos.mensaje     || 'No se pudieron cargar las actividades');
  if (!resAsistencia.ok || !Array.isArray(asistencias)) throw new Error(asistencias.mensaje || 'No se pudieron cargar las asistencias');
  return { personas, eventos, asistencias };
}

// Una columna por fecha de actividad; si hay varias actividades el mismo día se
// numeran (Actividad AAAA-MM-DD 1, 2...), igual que la planilla de referencia del cliente.
function _columnasEventosAsistencia(eventos) {
  const ordenados = [...eventos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const totalPorFecha = new Map();
  ordenados.forEach(ev => {
    const fecha = String(ev.fecha || '').substring(0, 10);
    totalPorFecha.set(fecha, (totalPorFecha.get(fecha) || 0) + 1);
  });
  const contadorPorFecha = new Map();
  return ordenados.map(ev => {
    const fecha = String(ev.fecha || '').substring(0, 10);
    const indice = (contadorPorFecha.get(fecha) || 0) + 1;
    contadorPorFecha.set(fecha, indice);
    const sufijo = totalPorFecha.get(fecha) > 1 ? ` ${indice}` : '';
    return { id: ev.id, columna: `Actividad ${fecha}${sufijo}` };
  });
}

async function exportarAsistenciasExcel() {
  if (!_xlsxDisponible()) return;
  let datos;
  try { datos = await _obtenerDatosMatrizAsistencia(); }
  catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  const { personas, eventos, asistencias } = datos;
  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const columnas = _columnasEventosAsistencia(eventos);
  const puntosPorPersonaEvento = new Map();
  asistencias.forEach(a => {
    if (a.puntos === null || a.puntos === undefined || a.puntos === '') return;
    puntosPorPersonaEvento.set(`${a.persona_id}_${a.evento_id}`, Number(a.puntos));
  });

  const rows = personas.map(p => {
    const fila = {
      'RUT':              p.rut || '',
      'Apellido paterno': p.apellido_paterno || '',
      'Apellido materno': p.apellido_materno || '',
      'Nombres':          p.nombres || '',
      'Bloque':           p.bloque || '',
      'Estado':           p.estado || 'activo'
    };
    let totalPuntajes = 0;
    columnas.forEach(col => {
      const puntos = puntosPorPersonaEvento.get(`${p.id}_${col.id}`);
      fila[col.columna] = puntos === undefined ? '' : puntos;
      if (puntos) totalPuntajes += puntos;
    });
    fila['Total Puntajes'] = totalPuntajes;
    fila['Ponderación Puntaje Pago'] = '';
    fila['Ponderación Puntaje Pago/Asistencia TOTAL'] = totalPuntajes;
    fila['PAGO SI O NO'] = '';
    return fila;
  });

  _descargarExcel(rows, 'Asistencia', 'asistencia');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Deudores ───────────────────────────────────────────────────────────

const PERIODOS_FINANCIEROS_GDC = [
  { anio: 2025, mes: 10, nombre: 'Octubre 2025' },
  { anio: 2025, mes: 11, nombre: 'Noviembre 2025' },
  { anio: 2025, mes: 12, nombre: 'Diciembre 2025' },
  { anio: 2026, mes: 1, nombre: 'Enero 2026' },
  { anio: 2026, mes: 2, nombre: 'Febrero 2026' },
  { anio: 2026, mes: 3, nombre: 'Marzo 2026' },
  { anio: 2026, mes: 4, nombre: 'Abril 2026' },
  { anio: 2026, mes: 5, nombre: 'Mayo 2026' },
  { anio: 2026, mes: 6, nombre: 'Junio 2026' },
  { anio: 2026, mes: 7, nombre: 'Julio 2026' }
];

async function _obtenerCuotasParaReporteDeudores() {
  const respuesta = await fetch(`${API_URL}/cuotas`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !Array.isArray(data)) throw new Error(data.mensaje || 'No se pudieron cargar los pagos mensuales');
  return data;
}

function _detalleMensualDeudor(deudor, cuotas) {
  return PERIODOS_FINANCIEROS_GDC.map(periodo => {
    const cuota = cuotas.find(item => Number(item.persona_id) === Number(deudor.id) &&
      Number(item.anio) === periodo.anio && Number(item.mes) === periodo.mes);
    return { periodo: periodo.nombre, cuota: Number(cuota?.monto || 0),
      pagado: Number(cuota?.monto_pagado || 0), saldo: Number(cuota?.saldo ?? cuota?.monto ?? 0),
      estado: cuota?.estado || 'sin_registro' };
  });
}

async function _obtenerPersonasParaReporte() {
  const respuesta = await fetch(`${API_URL}/personas`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !Array.isArray(data)) throw new Error(data.mensaje || 'No se pudieron cargar los integrantes');
  return data;
}

const NOMBRES_MESES_GDC = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Una columna por cada mes con cuotas generadas (orden cronológico), en vez de una
// lista fija: evita que la planilla quede desactualizada si cambia la cantidad de meses.
function _columnasMesesPago(cuotas) {
  const periodos = new Map();
  cuotas.forEach(c => periodos.set(`${c.anio}_${c.mes}`, { anio: Number(c.anio), mes: Number(c.mes) }));
  return Array.from(periodos.values())
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map(p => ({ ...p, columna: NOMBRES_MESES_GDC[p.mes] }));
}

async function exportarDeudoresExcel() {
  if (!_xlsxDisponible()) return;
  let personas, cuotas;
  try {
    [personas, cuotas] = await Promise.all([_obtenerPersonasParaReporte(), _obtenerCuotasParaReporteDeudores()]);
  } catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const columnas = _columnasMesesPago(cuotas);
  const cuotaPorClave = new Map();
  cuotas.forEach(c => cuotaPorClave.set(`${c.persona_id}_${c.anio}_${c.mes}`, c));

  const rows = personas.map(p => {
    const fila = {
      'RUT':              p.rut || '',
      'Apellido paterno': p.apellido_paterno || '',
      'Apellido materno': p.apellido_materno || '',
      'Nombres':          p.nombres || '',
      'Bloque':           p.bloque || '',
      'Estado':           p.estado || 'activo'
    };
    let real = 0;
    let totalCuotas = 0;
    columnas.forEach(col => {
      const cuota  = cuotaPorClave.get(`${p.id}_${col.anio}_${col.mes}`);
      const pagado = Number(cuota?.monto_pagado || 0);
      fila[col.columna] = pagado > 0 ? pagado : '';
      real += pagado;
      totalCuotas += Number(cuota?.monto || 0);
    });
    fila['$ REAL'] = real;
    fila['SALDO'] = Math.max(0, totalCuotas - real);
    return fila;
  });

  _descargarExcel(rows, 'Pago Cuotas', 'pago_cuotas');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Puntaje ────────────────────────────────────────────────────────────

function exportarPuntajeExcel() {
  if (!_xlsxDisponible()) return;
  if (!rankingCargado || rankingCargado.length === 0) {
    mostrarAlerta('No hay datos de puntaje para exportar.', 'warning');
    return;
  }
  const rows = rankingCargado.map((r, i) => ({
    '#':                i + 1,
    'RUT':              r.rut || '',
    'Apellido paterno': r.apellido_paterno || '',
    'Apellido materno': r.apellido_materno || '',
    'Nombres':          r.nombres || '',
    'Bloque':           r.bloque || '',
    'Puntaje':          Number(r.puntaje_total),
    'Registros':        Number(r.total_registros)
  }));
  _descargarExcel(rows, 'Puntaje', 'ranking_puntaje');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Formaciones ────────────────────────────────────────────────────────

async function _obtenerFormacionesParaExportar() {
  if (Array.isArray(window.formacionesCargadas) && window.formacionesCargadas.length) {
    return window.formacionesCargadas;
  }
  const respuesta = await fetch(`${API_URL}/formaciones/actual`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.mensaje || 'No se pudieron cargar las formaciones');
  window.formacionesCargadas = Array.isArray(data) ? data : [];
  return window.formacionesCargadas;
}

async function exportarFormacionesExcel() {
  if (!_xlsxDisponible()) return;
  let formaciones;
  try {
    formaciones = await _obtenerFormacionesParaExportar();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
    return;
  }
  const bloquesConPosiciones = formaciones.filter(formacion => (formacion.posiciones || []).length);
  if (bloquesConPosiciones.length === 0) {
    mostrarAlerta('No hay formaciones para exportar.', 'warning');
    return;
  }

  const wb = XLSX.utils.book_new();
  const nombresUsados = new Set();
  let totalPosiciones = 0;
  bloquesConPosiciones.forEach((formacion, indice) => {
    const rows = formacion.posiciones.map(posicion => {
      const orden = Number(posicion.orden_general || 0);
      return {
        'Posición': orden,
        'Fila': orden <= 8 ? 'Frente' : `Fila ${Math.ceil(orden / 8) - 1}`,
        'Integrante': `${posicion.nombres} ${posicion.apellido_paterno} ${posicion.apellido_materno || ''}`.trim(),
        'Puntaje': Number(posicion.puntaje_utilizado || 0)
      };
    });
    totalPosiciones += rows.length;
    const base = String(formacion.bloque || `Bloque ${indice + 1}`)
      .replace(/[\\/?*\[\]:]/g, ' ')
      .trim()
      .substring(0, 31) || `Bloque ${indice + 1}`;
    let nombreHoja = base;
    let correlativo = 2;
    while (nombresUsados.has(nombreHoja.toLowerCase())) {
      const sufijo = ` ${correlativo++}`;
      nombreHoja = `${base.substring(0, 31 - sufijo.length)}${sufijo}`;
    }
    nombresUsados.add(nombreHoja.toLowerCase());
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), nombreHoja);
  });
  XLSX.writeFile(wb, `formaciones_vigentes_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
  mostrarAlerta(`Excel generado: ${bloquesConPosiciones.length} bloque(s), ${totalPosiciones} posición(es).`, 'success');
}

// ── Excel: Gastos ─────────────────────────────────────────────────────────────

function exportarGastosExcel() {
  if (!_xlsxDisponible()) return;
  if (!gastosCargados || gastosCargados.length === 0) {
    mostrarAlerta('No hay gastos para exportar.', 'warning');
    return;
  }
  const rows = gastosCargados.map(g => ({
    'Fecha':       g.fecha ? String(g.fecha).substring(0, 10) : '',
    'Categoría':   g.categoria || '',
    'Descripción': g.descripcion || '',
    'Monto':       Number(g.monto || 0),
    'Responsable': g.responsable || '',
    'Comprobante': g.comprobante_path ? 'Sí' : 'No'
  }));
  _descargarExcel(rows, 'Gastos', 'gastos');
  mostrarAlerta(`Excel generado: ${rows.length} gasto(s).`, 'success');
}

// ── PDF helpers ───────────────────────────────────────────────────────────────

function _pdfDisponible() {
  if (!window.jspdf) {
    mostrarAlerta('Librería PDF no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _crearDocPDF(titulo, landscape = false) {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF(landscape ? { orientation: 'landscape' } : undefined);
  const fecha = _fechaHoy();
  const org   = _nombreOrg();
  doc.setFontSize(16);
  doc.setTextColor(30, 30, 30);
  doc.text(titulo, 14, 18);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`${org}  ·  ${fecha}`, 14, 25);
  doc._fechaArchivo = fecha;
  return doc;
}

// Cumplimiento por bloque: combina asistencia (registros distintos de ausente/retiro
// sin aviso) y pago de cuotas (estado pagado) sobre el total de oportunidades de cada uno.
function _calcularCumplimientoPorBloque(personas, asistencias, cuotas) {
  const bloquePorPersona = new Map(personas.map(p => [String(p.id), p.bloque || 'Sin bloque']));
  const stats = new Map();

  function sumar(bloque, campo) {
    if (!stats.has(bloque)) stats.set(bloque, { asistOk: 0, asistTotal: 0, pagoOk: 0, pagoTotal: 0 });
    stats.get(bloque)[campo]++;
  }

  asistencias.forEach(a => {
    const bloque = a.bloque || bloquePorPersona.get(String(a.persona_id)) || 'Sin bloque';
    sumar(bloque, 'asistTotal');
    if (a.estado !== 'ausente' && a.estado !== 'retiro_sin_aviso') sumar(bloque, 'asistOk');
  });

  cuotas.forEach(c => {
    const bloque = bloquePorPersona.get(String(c.persona_id)) || 'Sin bloque';
    sumar(bloque, 'pagoTotal');
    if (c.estado === 'pagado') sumar(bloque, 'pagoOk');
  });

  return Array.from(stats.entries())
    .map(([bloque, s]) => {
      const totalOportunidades = s.asistTotal + s.pagoTotal;
      const totalCumplidas     = s.asistOk + s.pagoOk;
      return {
        bloque,
        asistenciaPct:   s.asistTotal ? (s.asistOk / s.asistTotal) * 100 : null,
        pagoPct:         s.pagoTotal  ? (s.pagoOk  / s.pagoTotal)  * 100 : null,
        cumplimientoPct: totalOportunidades ? (totalCumplidas / totalOportunidades) * 100 : null
      };
    })
    .sort((a, b) => (b.cumplimientoPct ?? -1) - (a.cumplimientoPct ?? -1));
}

// ── PDF: Integrantes ──────────────────────────────────────────────────────────

function exportarIntegrantesPDF() {
  if (!_pdfDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Listado de Integrantes');
  doc.autoTable({
    startY: 30,
    head: [['RUT', 'Apellido paterno', 'Apellido materno', 'Nombres', 'Bloque', 'Sexo', 'Email', 'Estado']],
    body: personasTabla.map(p => [
      p.rut || '',
      p.apellido_paterno || '',
      p.apellido_materno || '',
      p.nombres || '',
      p.bloque || '',
      p.sexo || '',
      p.email || '',
      p.estado || 'activo'
    ]),
    foot: [['', '', '', '', '', '', `Total: ${personasTabla.length} integrante(s)`, '']],
    styles:             { fontSize: 7, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });
  doc.save(`integrantes_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${personasTabla.length} integrante(s).`, 'success');
}

// ── PDF: Asistencia (resumen por bloque + matriz por actividad) ────────────────

async function exportarAsistenciasPDF() {
  if (!_pdfDisponible()) return;
  let datos, cuotas;
  try {
    [datos, cuotas] = await Promise.all([_obtenerDatosMatrizAsistencia(), _obtenerCuotasParaReporteDeudores()]);
  } catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  const { personas, eventos, asistencias } = datos;
  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const doc = _crearDocPDF('Resumen de Cumplimiento por Bloque', true);
  const resumenBloques = _calcularCumplimientoPorBloque(personas, asistencias, cuotas);
  doc.autoTable({
    startY: 30,
    head: [['Bloque', 'Asistencia', 'Pago de cuotas', 'Cumplimiento']],
    body: resumenBloques.map(b => [
      b.bloque,
      b.asistenciaPct   === null ? '—' : `${b.asistenciaPct.toFixed(1)}%`,
      b.pagoPct         === null ? '—' : `${b.pagoPct.toFixed(1)}%`,
      b.cumplimientoPct === null ? '—' : `${b.cumplimientoPct.toFixed(1)}%`
    ]),
    styles:             { fontSize: 9, cellPadding: 3 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' } }
  });

  const columnas = _columnasEventosAsistencia(eventos);
  const puntosPorPersonaEvento = new Map();
  asistencias.forEach(a => {
    if (a.puntos === null || a.puntos === undefined || a.puntos === '') return;
    puntosPorPersonaEvento.set(`${a.persona_id}_${a.evento_id}`, Number(a.puntos));
  });

  doc.addPage();
  doc.setFontSize(13);
  doc.setTextColor(30, 30, 30);
  doc.text('Detalle de Asistencia por Actividad', 14, 18);
  doc.autoTable({
    startY: 24,
    head: [[
      'RUT', 'Ap. paterno', 'Ap. materno', 'Nombres', 'Bloque', 'Estado',
      ...columnas.map(c => c.columna.replace('Actividad ', '')),
      'Total'
    ]],
    body: personas.map(p => {
      let total = 0;
      const celdas = columnas.map(col => {
        const puntos = puntosPorPersonaEvento.get(`${p.id}_${col.id}`);
        if (puntos) total += puntos;
        return puntos === undefined ? '' : puntos;
      });
      return [
        p.rut || '', p.apellido_paterno || '', p.apellido_materno || '', p.nombres || '',
        p.bloque || '', p.estado || 'activo', ...celdas, total
      ];
    }),
    styles:             { fontSize: 5.5, cellPadding: 1 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold', fontSize: 5.5 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles:       { [6 + columnas.length]: { fontStyle: 'bold', halign: 'center' } }
  });

  doc.save(`asistencia_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${personas.length} integrante(s).`, 'success');
}

// ── PDF: Puntaje ──────────────────────────────────────────────────────────────

function exportarPuntajePDF() {
  if (!_pdfDisponible()) return;
  if (!rankingCargado || rankingCargado.length === 0) {
    mostrarAlerta('No hay datos de puntaje para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Ranking de Puntaje');
  const totalPuntos = rankingCargado.reduce((s, r) => s + Number(r.puntaje_total), 0);
  doc.autoTable({
    startY: 30,
    head: [['#', 'RUT', 'Apellido paterno', 'Apellido materno', 'Nombres', 'Bloque', 'Puntaje', 'Registros']],
    body: rankingCargado.map((r, i) => [
      i + 1,
      r.rut || '',
      r.apellido_paterno || '',
      r.apellido_materno || '',
      r.nombres || '',
      r.bloque || '',
      r.puntaje_total,
      r.total_registros
    ]),
    foot: [['', '', '', '', `${rankingCargado.length} integrante(s)`, '', totalPuntos, '']],
    styles:             { fontSize: 7, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      6: { halign: 'center', fontStyle: 'bold' },
      7: { halign: 'center' }
    }
  });
  doc.save(`puntaje_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${rankingCargado.length} integrante(s).`, 'success');
}

// ── PDF: Formaciones ──────────────────────────────────────────────────────────

async function exportarFormacionesPDF() {
  if (!_pdfDisponible()) return;
  let formaciones;
  try {
    formaciones = await _obtenerFormacionesParaExportar();
  } catch (error) {
    mostrarAlerta(error.message, 'danger');
    return;
  }
  const totalPosiciones = formaciones.reduce(
    (total, formacion) => total + (formacion.posiciones || []).length,
    0
  );
  if (totalPosiciones === 0) {
    mostrarAlerta('No hay formaciones para exportar.', 'warning');
    return;
  }

  const doc = _crearDocPDF('Formación Vigente por Puntaje');
  let primerBloque = true;
  formaciones.forEach(formacion => {
    const posiciones = formacion.posiciones || [];
    if (!posiciones.length) return;
    if (!primerBloque) doc.addPage();
    const inicioY = primerBloque ? 30 : 18;
    primerBloque = false;
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(`${formacion.bloque || 'Sin bloque'} (${posiciones.length})`, 14, inicioY);
    doc.autoTable({
      startY: inicioY + 3,
      head: [['Posición', 'Fila', 'Integrante', 'Puntaje']],
      body: posiciones.map(posicion => {
        const orden = Number(posicion.orden_general || 0);
        return [
          orden,
          orden <= 8 ? 'Frente' : `Fila ${Math.ceil(orden / 8) - 1}`,
          `${posicion.nombres} ${posicion.apellido_paterno} ${posicion.apellido_materno || ''}`.trim(),
          Number(posicion.puntaje_utilizado || 0)
        ];
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center', fontStyle: 'bold' }
      }
    });
  });

  doc.save(`formaciones_vigentes_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${totalPosiciones} posición(es).`, 'success');
}

// ── PDF: Gastos (respaldo para asamblea) ──────────────────────────────────────

function exportarGastosPDF() {
  if (!_pdfDisponible()) return;
  if (!gastosCargados || gastosCargados.length === 0) {
    mostrarAlerta('No hay gastos para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Reporte de Gastos');
  const totalGastos = gastosCargados.reduce((s, g) => s + Number(g.monto || 0), 0);
  doc.autoTable({
    startY: 30,
    head: [['Fecha', 'Categoría', 'Descripción', 'Monto', 'Responsable', 'Comprobante']],
    body: gastosCargados.map(g => [
      g.fecha ? String(g.fecha).substring(0, 10) : '',
      g.categoria || '',
      g.descripcion || '',
      formatearMonto(g.monto),
      g.responsable || '',
      g.comprobante_path ? 'Sí' : 'No'
    ]),
    foot: [['', '', `Total: ${gastosCargados.length} gasto(s)`, formatearMonto(totalGastos), '', '']],
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles:       { 3: { halign: 'right' } }
  });
  doc.save(`gastos_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${gastosCargados.length} gasto(s).`, 'success');
}

// ── PDF: Pago Cuotas (matriz por mes) ───────────────────────────────────────────

async function exportarDeudoresPDF() {
  if (!_pdfDisponible()) return;
  let personas, cuotas;
  try {
    [personas, cuotas] = await Promise.all([_obtenerPersonasParaReporte(), _obtenerCuotasParaReporteDeudores()]);
  } catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const columnas = _columnasMesesPago(cuotas);
  const cuotaPorClave = new Map();
  cuotas.forEach(c => cuotaPorClave.set(`${c.persona_id}_${c.anio}_${c.mes}`, c));

  const doc = _crearDocPDF('Pago de Cuotas', true);
  doc.autoTable({
    startY: 30,
    head: [[
      'RUT', 'Ap. paterno', 'Ap. materno', 'Nombres', 'Bloque', 'Estado',
      ...columnas.map(c => c.columna), '$ REAL', 'SALDO'
    ]],
    body: personas.map(p => {
      let real = 0;
      let totalCuotas = 0;
      const celdas = columnas.map(col => {
        const cuota  = cuotaPorClave.get(`${p.id}_${col.anio}_${col.mes}`);
        const pagado = Number(cuota?.monto_pagado || 0);
        real += pagado;
        totalCuotas += Number(cuota?.monto || 0);
        return pagado > 0 ? formatearMonto(pagado) : '';
      });
      return [
        p.rut || '', p.apellido_paterno || '', p.apellido_materno || '', p.nombres || '',
        p.bloque || '', p.estado || 'activo', ...celdas,
        formatearMonto(real), formatearMonto(Math.max(0, totalCuotas - real))
      ];
    }),
    styles:             { fontSize: 6, cellPadding: 1.5 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  doc.save(`pago_cuotas_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${personas.length} integrante(s).`, 'success');
}
