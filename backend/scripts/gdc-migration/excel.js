'use strict';

const path = require('path');
const XLSX = require('xlsx');
const { normalizeRut, validateRut } = require('./rut');
const { normalizeBlock, sourceMeta, hashMovement } = require('./core');

const ATTENDANCE_CUTOFF = '2025-10-10';
const PENDING_INITIAL_EVENT = 'Evento pendiente de identificar (10-10-2025)';
const ATTENDANCE_DATE_CORRECTIONS = new Map([
  ['Asistencias:4748', { date: '2025-12-20', reason: 'Año confirmado por revisión manual; original 20-12-2024' }],
  ['Asistencias:4955', { date: '2026-04-10', reason: 'Fecha visible 10/04/2026 confirmada para el bloque delimitado por Demo' }],
  ['Asistencias:5172', { date: '2026-05-09', reason: 'Fecha visible 09/05/2026 confirmada para el bloque delimitado por Demo' }]
]);

function read(file) { return XLSX.readFile(file, { cellDates: true, cellFormula: true, cellNF: true }); }
function value(ws, row, col) { const cell = ws[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })]; return cell?.v ?? null; }
function sourceCell(ws, row, col) { return ws[XLSX.utils.encode_cell({ r: row - 1, c: col - 1 })] || null; }
function fileName(file) { return path.basename(file); }
function dateOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  // SheetJS representa las fechas Excel sin zona como medianoche UTC.
  // Usar getters locales en Chile resta un día y altera el documento original.
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}
function timeOnly(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}:${String(value.getUTCSeconds()).padStart(2, '0')}`;
}

function parseAttendanceDate(value) {
  const fromDate = dateOnly(value);
  if (fromDate && fromDate >= '2000-01-01') return fromDate;
  const match = String(value == null ? '' : value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
}

function parseAttendanceTime(value) {
  const fromDate = timeOnly(value);
  if (fromDate) return fromDate;
  const match = String(value == null ? '' : value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}` : null;
}

function assignRepresentativeEventTimes(rows) {
  const included = rows.filter(row => row.incluido);
  const eventsByDate = new Map();
  for (const row of included) {
    if (!eventsByDate.has(row.fecha)) eventsByDate.set(row.fecha, new Map());
    const events = eventsByDate.get(row.fecha);
    if (!events.has(row.evento_origen_id)) events.set(row.evento_origen_id, row.fila_inicio_evento);
  }
  const assigned = new Map();
  for (const [date, eventMap] of eventsByDate) {
    const events = [...eventMap].sort((left, right) => left[1] - right[1]);
    const saturday = new Date(`${date}T00:00:00Z`).getUTCDay() === 6;
    events.forEach(([eventId], index) => {
      const hour = events.length > 1 ? 15 + (index * 2) : saturday ? 15 : 18;
      assigned.set(eventId, `${String(hour).padStart(2, '0')}:00:00`);
    });
  }
  for (const row of included) {
    if (row.hora_disponible) continue;
    row.hora = assigned.get(row.evento_origen_id);
    row.hora_representativa = true;
    row.regla_hora = eventsByDate.get(row.fecha).size > 1
      ? 'Varios eventos el mismo día: 15:00 y luego intervalos de 2 horas según separadores Demo'
      : new Date(`${row.fecha}T00:00:00Z`).getUTCDay() === 6
        ? 'Evento único en sábado: 15:00'
        : 'Evento único en día no sábado: 18:00';
    row.fecha_hora = `${row.fecha} ${row.hora}`;
  }
  return rows;
}

function parseMembers(file) {
  const wb = read(file); const rows = [];
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet]; const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let row = 2; row <= range.e.r + 1; row += 1) {
      const name = value(ws, row, 1), originalRut = value(ws, row, 2);
      if (!name || !originalRut) continue;
      rows.push({ rut: normalizeRut(originalRut), rut_valido: validateRut(originalRut), nombre: String(name).trim(), bloque: normalizeBlock(sheet),
        ...sourceMeta(fileName(file), sheet, row, originalRut) });
    }
  }
  return rows;
}

function parseFinances(file) {
  const wb = read(file), sheet = wb.SheetNames[0], ws = wb.Sheets[sheet]; const rows = [], payments = [], months = [];
  for (let col = 14; col <= 24; col += 1) months.push({ col, name: String(value(ws, 2, col) || '').trim(), month: ((col - 14 + 9) % 12) + 1, year: col <= 16 ? 2025 : 2026 });
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let row = 3; row <= range.e.r + 1; row += 1) {
    const originalRut = value(ws, row, 1), first = value(ws, row, 2), last = value(ws, row, 3);
    if (!originalRut && !first && !last) continue;
    const member = { rut: normalizeRut(originalRut), rut_valido: validateRut(originalRut), nombres_origen: String(first || '').trim(), apellidos_origen: String(last || '').trim(), nombre: `${first || ''} ${last || ''}`.trim(), bloque: normalizeBlock(value(ws, row, 4)),
      estado: value(ws, row, 11), fecha_receso: dateOnly(value(ws, row, 13)), total_excel: value(ws, row, 25), saldo_excel: value(ws, row, 26),
      ...sourceMeta(fileName(file), sheet, row, originalRut) };
    rows.push(member);
    for (const month of months) {
      const original = value(ws, row, month.col);
      if (original == null || original === '') continue;
      const amount = typeof original === 'number' && Number.isFinite(original) ? original : null;
      payments.push({ rut: member.rut, rut_valido: member.rut_valido, nombre: member.nombre, mes: month.month, anio: month.year,
        monto: amount, no_aplica: /^no\s*aplica$/i.test(String(original).trim()),
        referencia_externa: hashMovement([fileName(file), sheet, row, month.col, original]),
        ...sourceMeta(fileName(file), sheet, row, original) });
    }
  }
  return { rows, payments };
}

function parseAttendance(file) {
  const wb = read(file), sheet = 'Asistencias', ws = wb.Sheets[sheet]; const rows = [];
  const namesByRut = new Map(); const dataSheet = wb.Sheets.DATOS;
  if (dataSheet) {
    const dataRange = XLSX.utils.decode_range(dataSheet['!ref'] || 'A1');
    for (let row = 1; row <= dataRange.e.r + 1; row += 1) {
      const rut = normalizeRut(value(dataSheet, row, 1));
      if (rut) namesByRut.set(rut, String(value(dataSheet, row, 4) || '').trim());
    }
  }
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  let eventStartRow = null;
  let separatorRow = null;
  for (let row = 2; row <= range.e.r + 1; row += 1) {
    const cells = [];
    for (let column = 1; column <= Math.min(8, range.e.c + 1); column += 1) {
      const originalCell = sourceCell(ws, row, column);
      const original = originalCell?.v;
      if (original != null && original !== '') cells.push({ column, address: XLSX.utils.encode_cell({ r: row - 1, c: column - 1 }), value: original, display: originalCell?.w ?? '' });
    }
    if (!cells.length) continue;
    if (cells.some(cell => /Demo - please subscribe/i.test(String(cell.value)))) {
      eventStartRow = null;
      separatorRow = row;
      continue;
    }
    const rutCandidates = cells.filter(cell => normalizeRut(cell.value));
    const cellDate = cell => parseAttendanceDate(cell.display) || parseAttendanceDate(cell.value);
    const cellTime = cell => parseAttendanceTime(cell.display) || parseAttendanceTime(cell.value);
    const dateCandidates = cells.filter(cell => cellDate(cell));
    const timeCandidates = cells.filter(cell => !cellDate(cell) && cellTime(cell));
    const used = new Set([...rutCandidates, ...dateCandidates, ...timeCandidates]);
    const textCandidates = cells.filter(cell => !used.has(cell) && String(cell.value).trim() !== '-');
    if (!rutCandidates.length || !dateCandidates.length) continue;
    if (eventStartRow == null) eventStartRow = row;
    const rutCell = rutCandidates[0], dateCell = dateCandidates[0], timeCell = timeCandidates[0] || null, nameCell = textCandidates[0] || null;
    const originalRut = rutCell.value;
    const dateFromDisplay = parseAttendanceDate(dateCell.display);
    const dateFromValue = parseAttendanceDate(dateCell.value);
    const originalDate = dateFromValue || dateFromDisplay;
    const time = timeCell ? cellTime(timeCell) : null;
    const normalizedRut = normalizeRut(originalRut);
    const explicitName = nameCell?.value;
    const name = String(explicitName || namesByRut.get(normalizedRut) || '').trim();
    const eventId = `${sheet}:${eventStartRow}`;
    const dateCorrection = ATTENDANCE_DATE_CORRECTIONS.get(eventId);
    const date = dateCorrection?.date || originalDate;
    const eventName = date === ATTENDANCE_CUTOFF && eventStartRow === 4146
      ? PENDING_INITIAL_EVENT
      : `Evento pendiente ${date} (desde fila ${eventStartRow})`;
    rows.push({ rut: normalizedRut, rut_valido: validateRut(originalRut), nombre: name, fecha: date, hora: time || '',
      hora_disponible: !!time, fecha_hora: time ? `${date} ${time}` : date, evento: eventName, evento_pendiente: true,
      estado: 'presente', origen_estado: 'Regla confirmada: toda marcación del documento representa presencia',
      celda_rut: rutCell.address, celda_fecha: dateCell.address, celda_hora: timeCell?.address || '', celda_nombre: nameCell?.address || '',
      estructura_origen: cells.map(cell => cell.address).join(','),
      requiere_revision_estructura: rutCandidates.length !== 1 || dateCandidates.length !== 1 || timeCandidates.length > 1 || textCandidates.length > 1,
      evento_origen_id: eventId, fila_inicio_evento: eventStartRow, fila_separador_anterior: separatorRow || '',
      fecha_original: originalDate, fecha_corregida_manualmente: !!dateCorrection,
      fecha_mostrada_celda: dateFromDisplay || '', fecha_interpretada_valor_excel: dateFromValue || '',
      fecha_resuelta_desde_visual: !!dateCorrection && !!dateFromDisplay && dateCorrection.date === dateFromDisplay,
      motivo_correccion_fecha: dateCorrection?.reason || '',
      contexto_evento: eventId === 'Asistencias:4748'
        ? 'Celebración de nacimiento en diciembre; razón contextual aportada por revisión manual, no corresponde al nombre oficial del evento'
        : '',
      incluido: false,
      referencia_externa: hashMovement([fileName(file), sheet, row, originalRut, date, time]), ...sourceMeta(fileName(file), sheet, row, originalRut) });
  }
  const lastJuneDate = rows.map(row => row.fecha).filter(date => /^2026-06-/.test(date)).sort().at(-1) || null;
  for (const row of rows) row.incluido = !!lastJuneDate && row.fecha >= ATTENDANCE_CUTOFF && row.fecha <= lastJuneDate;
  return assignRepresentativeEventTimes(rows);
}

function parsePositions(file) {
  const wb = read(file), ws = wb.Sheets['Puntaje 2025']; if (!ws) return [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1'), rows = [];
  for (let row = 2; row <= range.e.r + 1; row += 1) {
    const originalRut = value(ws, row, 1); if (!originalRut) continue;
    rows.push({ rut: normalizeRut(originalRut), rut_valido: validateRut(originalRut), nombre: `${value(ws,row,2)||''} ${value(ws,row,3)||''}`.trim(),
      bloque: normalizeBlock(value(ws,row,4)), estado: value(ws,row,5), puntaje_planilla: Number(value(ws,row,36) || value(ws,row,34) || 0),
      ...sourceMeta(fileName(file), 'Puntaje 2025', row, originalRut) });
  }
  const ranked = [...rows].sort((a,b) => b.puntaje_planilla - a.puntaje_planilla);
  ranked.forEach((row,index) => { row.posicion_planilla = index + 1; });
  return rows;
}

module.exports = { parseMembers, parseFinances, parseAttendance, parsePositions, dateOnly, parseAttendanceDate, parseAttendanceTime, assignRepresentativeEventTimes, ATTENDANCE_CUTOFF, PENDING_INITIAL_EVENT, ATTENDANCE_DATE_CORRECTIONS };
