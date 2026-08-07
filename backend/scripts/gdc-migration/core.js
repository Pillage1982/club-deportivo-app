'use strict';

const crypto = require('crypto');
const { normalizeRut, validateRut } = require('./rut');

const BLOCK_EQUIVALENCES = new Map([
  ['chinas doble cara', 'Chinas Doble Cara'],
  ['doble cara', 'Chinas Doble Cara'],
  ['infantil', 'Infantil'],
  ['ninos', 'Infantil'],
  ['ninas', 'Infantil'],
  ['nawpas mujeres y hombres', 'Ñawpas'],
  ['nawpas', 'Ñawpas']
]);

function plain(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}

function normalizeBlock(value) {
  const key = plain(value);
  return BLOCK_EQUIVALENCES.get(key) || (value ? String(value).trim() : null);
}

function sourceMeta(file, sheet, row, original) {
  return { archivo_origen: file, hoja_origen: sheet, fila_origen: row, valor_original: original };
}

function hashMovement(parts) {
  return crypto.createHash('sha256').update(parts.map(v => String(v ?? '')).join('|')).digest('hex');
}

function indexByRut(rows) {
  const map = new Map();
  for (const row of rows) {
    const rut = normalizeRut(row.rut);
    if (!rut) continue;
    if (!map.has(rut)) map.set(rut, []);
    map.get(rut).push(row);
  }
  return map;
}

function levenshtein(left, right) {
  const matrix = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
      );
    }
  }
  return matrix[left.length][right.length];
}

function reconcileAttendanceRuts(rows, sourceRows) {
  const profiles = new Map();
  for (const entry of sourceRows) {
    const rut = normalizeRut(entry.rut);
    if (!rut || !validateRut(rut)) continue;
    if (!profiles.has(rut)) profiles.set(rut, { rut, names: new Set(), sources: new Set() });
    const profile = profiles.get(rut);
    if (entry.nombre) profile.names.add(plain(entry.nombre));
    if (entry.source) profile.sources.add(entry.source);
  }
  const corrected = [], unresolved = [];
  const reconciled = rows.map(row => {
    if (row.rut_valido) return row;
    const raw = String(row.valor_original == null ? '' : row.valor_original).replace(/[.\s\u00a0-]/g, '').toUpperCase();
    let candidates = [...profiles.values()].filter(profile => levenshtein(raw, profile.rut.replace('-', '')) <= 1);
    let reason = 'Coincidencia única de RUT por distancia de una edición';
    if (candidates.length !== 1 && row.nombre) {
      const normalizedName = plain(row.nombre);
      candidates = [...profiles.values()].filter(profile => profile.names.has(normalizedName));
      reason = 'Coincidencia única por nombre exacto disponible en hoja DATOS y documentos maestros';
    }
    if (candidates.length !== 1) { unresolved.push(row); return row; }
    const candidate = candidates[0];
    const fixed = { ...row, rut_original: row.valor_original, rut: candidate.rut, rut_valido: true, rut_corregido_por_cruce: true,
      motivo_correccion_rut: reason, fuentes_correccion_rut: [...candidate.sources].sort().join(', ') };
    corrected.push(fixed); return fixed;
  });
  return { rows: reconciled, corrected, unresolved };
}

function compareMembers(sources) {
  const indexes = Object.fromEntries(Object.entries(sources).map(([key, rows]) => [key, indexByRut(rows)]));
  const all = new Set(Object.values(indexes).flatMap(index => [...index.keys()]));
  const rows = [];
  for (const rut of [...all].sort()) {
    const db = indexes.db.get(rut) || [];
    const members = indexes.members.get(rut) || [];
    const finances = indexes.finances.get(rut) || [];
    const attendance = indexes.attendance.get(rut) || [];
    const positions = indexes.positions.get(rut) || [];
    // Una persona puede tener muchas asistencias; eso no es un duplicado de padrón.
    // Sólo las fuentes que deberían tener una fila por persona bloquean automatización.
    const duplicates = [db, members, finances, positions].filter(group => group.length > 1).length;
    const valid = validateRut(rut);
    let action = 'MANTENER';
    const observations = [];
    if (!valid) action = 'REVISAR_RUT';
    else if (duplicates) action = 'REVISAR_DUPLICADO';
    else if (!db.length && members.length) action = 'CREAR';
    else if (db.length && !members.length) action = 'SOLO_EN_BD';
    else if (!db.length && finances.length) action = 'SOLO_EN_FINANZAS';
    else if (!db.length && attendance.length) action = 'SOLO_EN_ASISTENCIA';
    else if (db.length && members.length) {
      if (plain(db[0].nombre) !== plain(members[0].nombre)) { action = 'ACTUALIZAR'; observations.push('Nombre difiere de nómina'); }
      if (normalizeBlock(db[0].bloque) !== normalizeBlock(members[0].bloque)) { action = 'REVISAR_BLOQUE'; observations.push('Bloque difiere'); }
    }
    rows.push({
      rut_normalizado: rut, rut_valido: valid, id_integrante_bd: db[0]?.id || '', nombre_bd: db[0]?.nombre || '',
      nombre_nomina: members[0]?.nombre || '', nombre_finanzas: finances[0]?.nombre || '',
      nombre_asistencia: attendance[0]?.nombre || '', nombre_posiciones: positions[0]?.nombre || '',
      existe_en_bd: !!db.length, existe_en_nomina: !!members.length, existe_en_finanzas: !!finances.length,
      existe_en_asistencia: !!attendance.length, existe_en_posiciones: !!positions.length,
      bloque_bd: db[0]?.bloque || '', bloque_nomina: members[0]?.bloque || '', tipo_socio_bd: db[0]?.es_honorario ? 'honorario' : 'socio',
      estado_socio_bd: db[0]?.estado || '', cantidad_duplicados: duplicates, accion_recomendada: action,
      observaciones: observations.join('; ')
    });
  }
  return rows;
}

module.exports = { plain, normalizeBlock, sourceMeta, hashMovement, indexByRut, compareMembers, levenshtein, reconcileAttendanceRuts };
