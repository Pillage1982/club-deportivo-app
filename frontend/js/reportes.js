// Exportaciones cliente: genera archivos Excel y PDF a partir de los datos ya cargados por cada módulo.
// =====================================
// REPORTES — EXPORTACIÓN PDF / EXCEL
// =====================================

function _nombreOrg() {
  return (window.APP_CONFIG && window.APP_CONFIG.nombreOrganizacion) || 'NexoComunidad';
}

// Formato pedido por el cliente para todo descargable: DD/MM/AAAA.
// (toLocaleDateString('es-CL') entrega DD-MM-AAAA, con guiones.)
function _fechaHoy() {
  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${hoy.getFullYear()}`;
}

// 'AAAA-MM-DD' (o 'AAAA-MM-DD HH:MM:SS', la BD usa dateStrings) -> 'DD/MM/AAAA'.
function _fechaDMA(fecha) {
  const partes = String(fecha || '').substring(0, 10).split('-');
  if (partes.length !== 3) return fecha ? String(fecha) : '';
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

// Para Excel se escribe una fecha real (no texto) para que ordenar y filtrar
// por la columna funcione; _descargarExcel le aplica el formato DD/MM/AAAA.
// Se construye en UTC porque ExcelJS convierte a número de serie en UTC.
function _fechaExcel(fecha) {
  const partes = String(fecha || '').substring(0, 10).split('-').map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return fecha ? String(fecha) : '';
  return new Date(Date.UTC(partes[0], partes[1] - 1, partes[2]));
}

// ── Excel helpers ─────────────────────────────────────────────────────────────
// ExcelJS (no SheetJS): la versión gratuita de SheetJS no escribe colores de
// celda, y la fila 1 necesita el naranja corporativo de la agrupación.

const COLOR_NARANJA_CORPORATIVO = 'FFF47A22';

function _excelDisponible() {
  if (!window.ExcelJS) {
    mostrarAlerta('Librería Excel no disponible. Verifica tu conexión e intenta de nuevo.', 'danger');
    return false;
  }
  return true;
}

function _descargarBlob(buffer, nombreArchivo) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function _estilizarEncabezado(fila) {
  fila.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_NARANJA_CORPORATIVO } };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
}

// Bordea todas las celdas con datos (encabezado + filas) y activa el filtro
// desplegable en la fila 1, equivalente a seleccionar la tabla y usar Ctrl+Shift+L.
function _aplicarBordesYFiltro(sheet, totalColumnas, totalFilas) {
  const bordeDelgado = { style: 'thin' };
  for (let fila = 1; fila <= totalFilas; fila++) {
    for (let columna = 1; columna <= totalColumnas; columna++) {
      sheet.getCell(fila, columna).border = {
        top: bordeDelgado, left: bordeDelgado, bottom: bordeDelgado, right: bordeDelgado
      };
    }
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: totalFilas, column: totalColumnas }
  };
}

async function _descargarExcel(rows, nombreHoja, nombreArchivo) {
  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet(nombreHoja);
  const headers  = Object.keys(rows[0] || {});
  sheet.addRow(headers);
  rows.forEach(row => {
    const fila = sheet.addRow(headers.map(h => row[h]));
    fila.eachCell(cell => {
      if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
    });
  });
  _estilizarEncabezado(sheet.getRow(1));
  _aplicarBordesYFiltro(sheet, headers.length, rows.length + 1);
  const buffer = await workbook.xlsx.writeBuffer();
  _descargarBlob(buffer, `${nombreArchivo}_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
}

// ── Integrantes agrupados por escuadra ────────────────────────────────────────
// Orden pedido por el cliente. El bloque es texto libre en la ficha, así que se
// compara sin tildes ni mayúsculas y con variantes (Ñawpas Hombre/Mujer,
// Pecados + Tentaciones, K'acha viuda, Figurines / ...). Lo que no calce con
// ninguna va a "Sin escuadra". Socios honorarios: por bloque o por la marca
// es_honorario de la ficha (se evalúa antes que el resto).

const ESCUADRAS_EXPORT_GDC = [
  { nombre: 'Arcangeles',            patron: /^arcangel/ },
  { nombre: 'Infantil',              patron: /^infantil/ },
  { nombre: 'Ñawpas',                patron: /^nawpa/ },
  { nombre: 'Chinas Supay',          patron: /^(chinas )?supay/ },
  { nombre: 'Osos',                  patron: /^oso/ },
  { nombre: 'Doble Caras',           patron: /^(chinas )?doble cara/ },
  { nombre: 'Luciferes',             patron: /^lucifer/ },
  { nombre: 'Waris',                 patron: /^(wari|huari)/ },
  { nombre: 'Virtudes',              patron: /^virtud/ },
  { nombre: 'Pecados y Tentaciones', patron: /^(pecado|tentacion)/ },
  { nombre: 'Diablesas',             patron: /^diablesa/ },
  { nombre: 'Diablos',               patron: /^diablo/ },
  { nombre: 'Jukumaris',             patron: /^jukumari/ },
  { nombre: "K'achas Viudas",        patron: /^k ?acha/ },
  { nombre: 'Yana Conciencia',       patron: /^yana/ },
  { nombre: 'Figurines',             patron: /^figurin/ },
  { nombre: 'Socios',                patron: /^socio(?!s? honorario)/ },
  { nombre: 'Socios Honorarios',     patron: /^socios? honorario/ }
];
const ESCUADRA_SIN_ASIGNAR = 'Sin Escuadra';

function _textoPlano(valor) {
  return String(valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function _escuadraDe(persona) {
  if (Number(persona.es_honorario) === 1) return 'Socios Honorarios';
  const bloque = _textoPlano(persona.bloque);
  const escuadra = ESCUADRAS_EXPORT_GDC.find(e => e.patron.test(bloque));
  return escuadra ? escuadra.nombre : ESCUADRA_SIN_ASIGNAR;
}

function _compararPorNombre(a, b) {
  return [a.apellido_paterno, a.apellido_materno, a.nombres].join(' ')
    .localeCompare([b.apellido_paterno, b.apellido_materno, b.nombres].join(' '), 'es', { sensitivity: 'base' });
}

// Devuelve solo las escuadras con integrantes, en el orden del cliente.
function _agruparIntegrantesPorEscuadra(personas) {
  const orden = [...ESCUADRAS_EXPORT_GDC.map(e => e.nombre), ESCUADRA_SIN_ASIGNAR];
  const grupos = new Map(orden.map(nombre => [nombre, []]));
  personas.forEach(p => grupos.get(_escuadraDe(p)).push(p));
  return orden
    .map(nombre => ({ nombre, integrantes: grupos.get(nombre).sort(_compararPorNombre) }))
    .filter(g => g.integrantes.length > 0);
}

// ── Excel: Integrantes ────────────────────────────────────────────────────────

function _filaIntegranteExcel(p) {
  return {
    'RUT':              p.rut || '',
    'Apellido paterno': p.apellido_paterno || '',
    'Apellido materno': p.apellido_materno || '',
    'Nombres':          p.nombres || '',
    'Bloque':           p.bloque || '',
    'Sexo':             p.sexo || '',
    'Email':            p.email || '',
    'Teléfono':         p.telefono || '',
    'Dirección':        p.direccion || '',
    'F. Nacimiento':    _fechaExcel(p.fecha_nacimiento),
    'F. Ingreso':       _fechaExcel(p.fecha_ingreso),
    'Estado':           p.estado || 'activo',
    'Honorario':        p.es_honorario ? 'Sí' : 'No',
    'Apoderado':        p.nombre_apoderado   || '',
    'RUT Apoderado':    p.rut_apoderado      || '',
    'Tel. Apoderado':   p.telefono_apoderado || '',
    'Bautizo':          p.bautizo      ? 'Sí' : 'No',
    'Comunión':         p.comunion     ? 'Sí' : 'No',
    'Confirmación':     p.confirmacion ? 'Sí' : 'No',
    'Observación':      p.observacion  || ''
  };
}

// Una sola hoja: antes de cada escuadra va una fila de título combinada
// ("INFANTIL (63)") y debajo sus integrantes en orden alfabético.
async function exportarIntegrantesExcel() {
  if (!_excelDisponible()) return;
  if (!personasTabla || personasTabla.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }
  const grupos   = _agruparIntegrantesPorEscuadra(personasTabla);
  const headers  = Object.keys(_filaIntegranteExcel({}));
  const workbook = new ExcelJS.Workbook();
  const sheet    = workbook.addWorksheet('Integrantes');
  sheet.addRow(headers);
  _estilizarEncabezado(sheet.getRow(1));

  grupos.forEach(grupo => {
    const titulo = sheet.addRow([`${grupo.nombre.toUpperCase()} (${grupo.integrantes.length})`]);
    sheet.mergeCells(titulo.number, 1, titulo.number, headers.length);
    titulo.getCell(1).font = { bold: true };
    titulo.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4D6' } };
    grupo.integrantes.forEach(p => {
      const datos = _filaIntegranteExcel(p);
      const fila  = sheet.addRow(headers.map(h => datos[h]));
      fila.eachCell(cell => {
        if (cell.value instanceof Date) cell.numFmt = 'dd/mm/yyyy';
      });
    });
  });

  _aplicarBordesYFiltro(sheet, headers.length, sheet.rowCount);
  const buffer = await workbook.xlsx.writeBuffer();
  _descargarBlob(buffer, `integrantes_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
  mostrarAlerta(`Excel generado: ${personasTabla.length} integrante(s) en ${grupos.length} escuadra(s).`, 'success');
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
// numeran (Actividad DD/MM/AAAA 1, 2...), igual que la planilla de referencia del cliente.
// Se agrupa por la fecha ISO y solo la etiqueta de la columna va en DD/MM/AAAA.
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
    return { id: ev.id, columna: `Actividad ${_fechaDMA(fecha)}${sufijo}` };
  });
}

async function exportarAsistenciasExcel() {
  if (!_excelDisponible()) return;
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

  await _descargarExcel(rows, 'Asistencia', 'asistencia');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Deudores ───────────────────────────────────────────────────────────

async function _obtenerCuotasParaReporteDeudores() {
  const respuesta = await fetch(`${API_URL}/cuotas`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !Array.isArray(data)) throw new Error(data.mensaje || 'No se pudieron cargar los pagos mensuales');
  return data;
}

async function _obtenerPersonasParaReporte() {
  const respuesta = await fetch(`${API_URL}/personas`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !Array.isArray(data)) throw new Error(data.mensaje || 'No se pudieron cargar los integrantes');
  return data;
}

const NOMBRES_MESES_GDC = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

// Una columna por cada mes con cuotas generadas o con pagos reales (orden
// cronológico), en vez de una lista fija: evita que la planilla quede
// desactualizada si cambia la cantidad de meses, y no pierde pagos hechos
// fuera de los periodos de cuotas (ej. pago anticipado de toda la temporada).
function _columnasMesesPago(cuotas, pagosPorMes) {
  const periodos = new Map();
  cuotas.forEach(c => periodos.set(`${c.anio}_${c.mes}`, { anio: Number(c.anio), mes: Number(c.mes) }));
  (pagosPorMes || []).forEach(pg => periodos.set(`${pg.anio}_${pg.mes}`, { anio: Number(pg.anio), mes: Number(pg.mes) }));
  const ordenados = Array.from(periodos.values()).sort((a, b) => a.anio - b.anio || a.mes - b.mes);
  // Con más de una temporada un mes se repite (octubre 2025 y octubre 2026): se
  // agrega el año para que las columnas no choquen en el Excel.
  const meses = ordenados.map(p => p.mes);
  const hayRepetidos = new Set(meses).size < meses.length;
  return ordenados.map(p => ({
    ...p,
    columna: hayRepetidos ? `${NOMBRES_MESES_GDC[p.mes]} ${String(p.anio).slice(2)}` : NOMBRES_MESES_GDC[p.mes]
  }));
}

async function _obtenerReporteCuotasReal() {
  const respuesta = await fetch(`${API_URL}/pagos/reporte-cuotas`, { headers: getAuthHeaders() });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(data.mensaje || 'No se pudo cargar el reporte de pagos');
  return {
    pagosPorMes:  Array.isArray(data.pagosPorMes)  ? data.pagosPorMes  : [],
    puntosCuotas: Array.isArray(data.puntosCuotas) ? data.puntosCuotas : []
  };
}

// Clave persona+mes real de pago -> monto pagado de cuotas ese mes (mes en que
// se hizo la transacción, no el mes de la cuota cubierta).
function _pagoRealPorClave(pagosPorMes) {
  const mapa = new Map();
  pagosPorMes.forEach(pg => mapa.set(`${pg.persona_id}_${pg.anio}_${pg.mes}`, Number(pg.monto || 0)));
  return mapa;
}

function _puntosCuotasPorPersona(puntosCuotas) {
  const mapa = new Map();
  puntosCuotas.forEach(pt => mapa.set(Number(pt.persona_id), Number(pt.puntos_cuotas || 0)));
  return mapa;
}

async function exportarDeudoresExcel() {
  if (!_excelDisponible()) return;
  let personas, cuotas, reporte;
  try {
    [personas, cuotas, reporte] = await Promise.all([
      _obtenerPersonasParaReporte(),
      _obtenerCuotasParaReporteDeudores(),
      _obtenerReporteCuotasReal()
    ]);
  } catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const columnas = _columnasMesesPago(cuotas, reporte.pagosPorMes);
  const cuotaPorClave = new Map();
  cuotas.forEach(c => cuotaPorClave.set(`${c.persona_id}_${c.anio}_${c.mes}`, c));
  const pagoRealPorClave       = _pagoRealPorClave(reporte.pagosPorMes);
  const puntosCuotasPorPersona = _puntosCuotasPorPersona(reporte.puntosCuotas);

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
      const pagado = pagoRealPorClave.get(`${p.id}_${col.anio}_${col.mes}`) || 0;
      fila[col.columna] = pagado > 0 ? pagado : '';
      real += pagado;
      const cuota = cuotaPorClave.get(`${p.id}_${col.anio}_${col.mes}`);
      totalCuotas += Number(cuota?.monto || 0);
    });
    fila['$ REAL'] = real;
    fila['SALDO'] = Math.max(0, totalCuotas - real);
    fila['TOTAL PUNTOS CUOTAS'] = puntosCuotasPorPersona.get(p.id) || 0;
    return fila;
  });

  await _descargarExcel(rows, 'Pago Cuotas', 'pago_cuotas');
  mostrarAlerta(`Excel generado: ${rows.length} integrante(s).`, 'success');
}

// ── Excel: Puntaje ────────────────────────────────────────────────────────────

async function exportarPuntajeExcel() {
  if (!_excelDisponible()) return;
  if (!rankingCargado || rankingCargado.length === 0) {
    mostrarAlerta('No hay datos de puntaje para exportar.', 'warning');
    return;
  }
  const rows = rankingCargado.map((r, i) => ({
    '#':                  i + 1,
    'RUT':                r.rut || '',
    'Apellido paterno':   r.apellido_paterno || '',
    'Apellido materno':   r.apellido_materno || '',
    'Nombres':            r.nombres || '',
    'Bloque':             r.bloque || '',
    'Puntos cuotas':      Number(r.puntos_cuotas || 0),
    'Puntos asistencia':  Number(r.puntos_asistencia || 0),
    'Puntos antiguedad':  Number(r.puntos_antiguedad || 0),
    'Puntaje':            Number(r.puntaje_total),
    'Registros':          Number(r.total_registros)
  }));
  await _descargarExcel(rows, 'Puntaje', 'ranking_puntaje');
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

// Agrupa en filas de hasta 12 integrantes, en el mismo orden e igual etiqueta
// (Frente / Fila N) que usa frontend/js/formaciones.js para pintar la formación
// en pantalla — así el export queda igual a lo que se ve en la app.
function _agruparFormacionPorFilas(posiciones) {
  const grupos = [];
  for (let inicio = 0; inicio < posiciones.length; inicio += 12) {
    grupos.push({
      etiqueta: inicio === 0 ? 'Frente' : `Fila ${Math.ceil(inicio / 12)}`,
      integrantes: posiciones.slice(inicio, inicio + 12)
    });
  }
  return grupos;
}

async function exportarFormacionesExcel() {
  if (!_excelDisponible()) return;
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

  const workbook = new ExcelJS.Workbook();
  const nombresUsados = new Set();
  let totalPosiciones = 0;
  const bordeDelgado = { style: 'thin' };

  bloquesConPosiciones.forEach((formacion, indice) => {
    totalPosiciones += formacion.posiciones.length;
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

    const sheet = workbook.addWorksheet(nombreHoja);
    let fila = 1;
    _agruparFormacionPorFilas(formacion.posiciones).forEach(grupo => {
      const columnas = grupo.integrantes.length;
      const filaEtiqueta = sheet.getRow(fila);
      filaEtiqueta.getCell(1).value = grupo.etiqueta;
      filaEtiqueta.getCell(1).font = { bold: true };
      if (columnas > 1) sheet.mergeCells(fila, 1, fila, columnas);
      fila++;

      const filaPos = fila, filaNom = fila + 1, filaPts = fila + 2;
      grupo.integrantes.forEach((p, i) => {
        const col = i + 1;
        sheet.getCell(filaPos, col).value = `Pos. ${p.posicion_ranking || p.orden_general}`;
        sheet.getCell(filaNom, col).value = `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim();
        sheet.getCell(filaPts, col).value = Number(p.puntaje_utilizado || 0);
        [filaPos, filaNom, filaPts].forEach(f => {
          sheet.getCell(f, col).border = { top: bordeDelgado, left: bordeDelgado, bottom: bordeDelgado, right: bordeDelgado };
        });
      });
      _estilizarEncabezado(sheet.getRow(filaPos));
      fila = filaPts + 2;
    });
    sheet.columns.forEach(col => { col.width = 18; });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  _descargarBlob(buffer, `formaciones_vigentes_${_fechaHoy().replace(/\//g, '-')}.xlsx`);
  mostrarAlerta(`Excel generado: ${bloquesConPosiciones.length} bloque(s), ${totalPosiciones} posición(es).`, 'success');
}

// ── Excel: Gastos ─────────────────────────────────────────────────────────────

async function exportarGastosExcel() {
  if (!_excelDisponible()) return;
  if (!gastosCargados || gastosCargados.length === 0) {
    mostrarAlerta('No hay gastos para exportar.', 'warning');
    return;
  }
  const rows = gastosCargados.map(g => ({
    'Fecha':       _fechaExcel(g.fecha),
    'Categoría':   g.categoria || '',
    'Descripción': g.descripcion || '',
    'Monto':       Number(g.monto || 0),
    'Responsable': g.responsable || '',
    'Comprobante': g.comprobante_path ? 'Sí' : 'No'
  }));
  await _descargarExcel(rows, 'Gastos', 'gastos');
  mostrarAlerta(`Excel generado: ${rows.length} gasto(s).`, 'success');
}

// ── Excel: Ingresos de terceros ───────────────────────────────────────────────

async function exportarIngresosExcel() {
  if (!_excelDisponible()) return;
  if (!ingresosCargados || ingresosCargados.length === 0) {
    mostrarAlerta('No hay ingresos para exportar.', 'warning');
    return;
  }
  const rows = ingresosCargados.map(i => ({
    'Fecha':       _fechaExcel(i.fecha),
    'Categoría':   i.categoria || '',
    'Origen':      i.origen || '',
    'Descripción': i.descripcion || '',
    'Monto':       Number(i.monto || 0),
    'Responsable': i.responsable || '',
    'Comprobante': i.comprobante_path ? 'Sí' : 'No'
  }));
  await _descargarExcel(rows, 'Ingresos', 'ingresos_terceros');
  mostrarAlerta(`Excel generado: ${rows.length} ingreso(s).`, 'success');
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
  const body = [];
  _agruparIntegrantesPorEscuadra(personasTabla).forEach(grupo => {
    body.push([{
      content: `${grupo.nombre.toUpperCase()} (${grupo.integrantes.length})`,
      colSpan: 8,
      styles:  { fillColor: [252, 228, 214], fontStyle: 'bold', textColor: 30 }
    }]);
    grupo.integrantes.forEach(p => body.push([
      p.rut || '',
      p.apellido_paterno || '',
      p.apellido_materno || '',
      p.nombres || '',
      p.bloque || '',
      p.sexo || '',
      p.email || '',
      p.estado || 'activo'
    ]));
  });
  doc.autoTable({
    startY: 30,
    head: [['RUT', 'Apellido paterno', 'Apellido materno', 'Nombres', 'Bloque', 'Sexo', 'Email', 'Estado']],
    body,
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
    head: [['#', 'RUT', 'Apellido paterno', 'Apellido materno', 'Nombres', 'Bloque', 'Puntos cuotas', 'Puntos asistencia', 'Puntos antiguedad', 'Puntaje', 'Registros']],
    body: rankingCargado.map((r, i) => [
      i + 1,
      r.rut || '',
      r.apellido_paterno || '',
      r.apellido_materno || '',
      r.nombres || '',
      r.bloque || '',
      Number(r.puntos_cuotas || 0),
      Number(r.puntos_asistencia || 0),
      Number(r.puntos_antiguedad || 0),
      r.puntaje_total,
      r.total_registros
    ]),
    foot: [['', '', '', '', `${rankingCargado.length} integrante(s)`, '', '', '', '', totalPuntos, '']],
    styles:             { fontSize: 7, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      6: { halign: 'center' },
      7: { halign: 'center' },
      8: { halign: 'center' },
      9: { halign: 'center', fontStyle: 'bold' },
      10: { halign: 'center' }
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

  const doc = _crearDocPDF('Formación Vigente por Puntaje', true);
  let primerBloque = true;
  formaciones.forEach(formacion => {
    const posiciones = formacion.posiciones || [];
    if (!posiciones.length) return;
    if (!primerBloque) doc.addPage();
    let y = primerBloque ? 30 : 18;
    primerBloque = false;
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`${formacion.bloque || 'Sin bloque'} (${posiciones.length})`, 14, y);
    y += 6;

    _agruparFormacionPorFilas(posiciones).forEach(grupo => {
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(grupo.etiqueta, 14, y);
      doc.autoTable({
        startY: y + 2,
        head: [grupo.integrantes.map(p => `Pos. ${p.posicion_ranking || p.orden_general}`)],
        body: [
          grupo.integrantes.map(p => `${p.nombres} ${p.apellido_paterno} ${p.apellido_materno || ''}`.trim()),
          grupo.integrantes.map(p => `${Number(p.puntaje_utilizado || 0)} pts`)
        ],
        styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
        headStyles: { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 14, right: 14 }
      });
      y = doc.lastAutoTable.finalY + 8;
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
      _fechaDMA(g.fecha),
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

// ── PDF: Ingresos de terceros (respaldo para asamblea) ────────────────────────

function exportarIngresosPDF() {
  if (!_pdfDisponible()) return;
  if (!ingresosCargados || ingresosCargados.length === 0) {
    mostrarAlerta('No hay ingresos para exportar.', 'warning');
    return;
  }
  const doc = _crearDocPDF('Reporte de Ingresos de Terceros');
  const totalIngresos = ingresosCargados.reduce((s, i) => s + Number(i.monto || 0), 0);
  doc.autoTable({
    startY: 30,
    head: [['Fecha', 'Categoría', 'Origen', 'Descripción', 'Monto', 'Responsable', 'Comprobante']],
    body: ingresosCargados.map(i => [
      _fechaDMA(i.fecha),
      i.categoria || '',
      i.origen || '',
      i.descripcion || '',
      formatearMonto(i.monto),
      i.responsable || '',
      i.comprobante_path ? 'Sí' : 'No'
    ]),
    foot: [['', '', '', `Total: ${ingresosCargados.length} ingreso(s)`, formatearMonto(totalIngresos), '', '']],
    styles:             { fontSize: 8, cellPadding: 2 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold' },
    footStyles:         { fillColor: [30, 30, 30],   textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles:       { 4: { halign: 'right' } }
  });
  doc.save(`ingresos_terceros_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${ingresosCargados.length} ingreso(s).`, 'success');
}

// ── PDF: Pago Cuotas (matriz por mes) ───────────────────────────────────────────

async function exportarDeudoresPDF() {
  if (!_pdfDisponible()) return;
  let personas, cuotas, reporte;
  try {
    [personas, cuotas, reporte] = await Promise.all([
      _obtenerPersonasParaReporte(),
      _obtenerCuotasParaReporteDeudores(),
      _obtenerReporteCuotasReal()
    ]);
  } catch (error) { mostrarAlerta(error.message, 'danger'); return; }

  if (personas.length === 0) {
    mostrarAlerta('No hay integrantes para exportar.', 'warning');
    return;
  }

  const columnas = _columnasMesesPago(cuotas, reporte.pagosPorMes);
  const cuotaPorClave = new Map();
  cuotas.forEach(c => cuotaPorClave.set(`${c.persona_id}_${c.anio}_${c.mes}`, c));
  const pagoRealPorClave       = _pagoRealPorClave(reporte.pagosPorMes);
  const puntosCuotasPorPersona = _puntosCuotasPorPersona(reporte.puntosCuotas);

  const doc = _crearDocPDF('Pago de Cuotas', true);
  doc.autoTable({
    startY: 30,
    head: [[
      'RUT', 'Ap. paterno', 'Ap. materno', 'Nombres', 'Bloque', 'Estado',
      ...columnas.map(c => c.columna), '$ REAL', 'SALDO', 'PUNTOS CUOTAS'
    ]],
    body: personas.map(p => {
      let real = 0;
      let totalCuotas = 0;
      const celdas = columnas.map(col => {
        const pagado = pagoRealPorClave.get(`${p.id}_${col.anio}_${col.mes}`) || 0;
        real += pagado;
        const cuota = cuotaPorClave.get(`${p.id}_${col.anio}_${col.mes}`);
        totalCuotas += Number(cuota?.monto || 0);
        return pagado > 0 ? formatearMonto(pagado) : '';
      });
      return [
        p.rut || '', p.apellido_paterno || '', p.apellido_materno || '', p.nombres || '',
        p.bloque || '', p.estado || 'activo', ...celdas,
        formatearMonto(real), formatearMonto(Math.max(0, totalCuotas - real)),
        puntosCuotasPorPersona.get(p.id) || 0
      ];
    }),
    styles:             { fontSize: 6, cellPadding: 1.5 },
    headStyles:         { fillColor: [244, 122, 34], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [250, 250, 250] }
  });

  doc.save(`pago_cuotas_${doc._fechaArchivo.replace(/\//g, '-')}.pdf`);
  mostrarAlerta(`PDF generado: ${personas.length} integrante(s).`, 'success');
}
