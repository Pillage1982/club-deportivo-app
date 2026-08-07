'use strict';

const fs = require('fs');
const { normalizeRut, validateRut } = require('./rut');

function splitSqlValues(text) {
  const values = []; let current = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "'" && text[i - 1] !== '\\') quoted = !quoted;
    if (char === ',' && !quoted) { values.push(current.trim()); current = ''; } else current += char;
  }
  values.push(current.trim());
  return values.map(item => item.toUpperCase() === 'NULL' ? null : item.replace(/^'|'$/g, '').replace(/\\'/g, "'"));
}

function parsePeopleSnapshot(file) {
  const sql = fs.readFileSync(file, 'utf8');
  const start = sql.indexOf('INSERT INTO personas');
  if (start < 0) throw new Error('El respaldo no contiene INSERT INTO personas');
  const valuesStart = sql.indexOf('VALUES', start); const end = sql.indexOf(';', valuesStart);
  const body = sql.slice(valuesStart + 6, end); const tuples = [];
  let quoted = false, depth = 0, current = '';
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i]; if (char === "'" && body[i - 1] !== '\\') quoted = !quoted;
    if (!quoted && char === '(') { depth += 1; if (depth === 1) { current = ''; continue; } }
    if (!quoted && char === ')') { depth -= 1; if (depth === 0) { tuples.push(current); continue; } }
    if (depth > 0) current += char;
  }
  return tuples.map((tuple, index) => {
    const v = splitSqlValues(tuple);
    return { id: index + 1, rut: normalizeRut(v[0]), rut_valido: validateRut(v[0]), nombres: v[1] || '', apellido_paterno: v[2] || '', apellido_materno: v[3] || '',
      nombre: `${v[1] || ''} ${v[2] || ''} ${v[3] || ''}`.replace(/\s+/g,' ').trim(), bloque: v[4], sexo: v[5],
      direccion: v[6], email: v[7], telefono: v[8], fecha_nacimiento: v[9], fecha_ingreso: v[10], estado: v[11] || 'activo', es_honorario: false };
  });
}

module.exports = { parsePeopleSnapshot };
