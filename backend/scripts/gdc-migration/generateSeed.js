#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { parseMembers, parseFinances, parseAttendance, parsePositions, parsePositionAttendance } = require('./excel');
const { parsePeopleSnapshot } = require('./snapshot');
const { reconcileAttendanceRuts } = require('./core');
const { allocatePaymentsToQuotas, PERIODS } = require('./paymentAllocation');

function args(argv) {
  const result = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) result[match[1]] = path.resolve(match[2]);
  }
  return result;
}
function required(options, key) { if (!options[key]) throw new Error(`Falta --${key}=<ruta>`); return options[key]; }
function sql(value) {
  if (value == null || value === '') return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}
function tuple(values) { return `(${values.map(sql).join(', ')})`; }
function valuesInsert(table, columns, rows) {
  if (!rows.length) return `-- Sin filas para ${table}.`;
  return `INSERT INTO ${table} (${columns.join(', ')}) VALUES\n${rows.map(row => tuple(columns.map(column => row[column]))).join(',\n')};`;
}
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 3) return { nombres: parts.slice(0, -2).join(' '), apellido_paterno: parts.at(-2), apellido_materno: parts.at(-1) };
  if (parts.length === 2) return { nombres: parts[0], apellido_paterno: parts[1], apellido_materno: null };
  return { nombres: parts[0] || 'Sin nombre', apellido_paterno: 'Sin información', apellido_materno: null };
}
function financeName(row) {
  const surnames = String(row.apellidos_origen || '').trim().split(/\s+/).filter(Boolean);
  return { nombres: row.nombres_origen || splitName(row.nombre).nombres, apellido_paterno: surnames[0] || splitName(row.nombre).apellido_paterno,
    apellido_materno: surnames.slice(1).join(' ') || splitName(row.nombre).apellido_materno };
}
function normalizeState(value) { return /receso/i.test(String(value || '')) ? 'receso' : /inactiv/i.test(String(value || '')) ? 'inactivo' : 'activo'; }

function build(argv = process.argv.slice(2)) {
  const options = args(argv);
  const files = { snapshot: required(options, 'db-snapshot'), members: required(options, 'members-file'), payments: required(options, 'payments-file'),
    attendance: required(options, 'attendance-file'), positions: required(options, 'positions-file'), output: required(options, 'output') };
  const snapshot = parsePeopleSnapshot(files.snapshot);
  const members = parseMembers(files.members);
  const finance = parseFinances(files.payments);
  const positions = parsePositions(files.positions);
  const attendanceRaw = parseAttendance(files.attendance);
  const positionAttendanceRaw = parsePositionAttendance(files.positions);
  const attendanceSourceKeys = new Set(attendanceRaw.filter(row => row.rut_valido).map(row => `${row.rut}|${row.fecha}`));
  const rescuedPositionRuts = new Set(positionAttendanceRaw
    .filter(row => !attendanceSourceKeys.has(`${row.rut}|${row.fecha}`))
    .map(row => row.rut));
  const reconciled = reconcileAttendanceRuts(attendanceRaw, [
    ...snapshot.map(row => ({ ...row, source: 'BD' })), ...members.map(row => ({ ...row, source: 'NOMINA' })),
    ...finance.rows.map(row => ({ ...row, source: 'FINANZAS' })), ...positions.map(row => ({ ...row, source: 'POSICIONES' }))
  ]);

  const people = new Map();
  for (const row of snapshot.filter(row => row.rut)) people.set(row.rut, { ...row });
  for (const row of finance.rows.filter(row => row.rut_valido)) {
    const current = people.get(row.rut) || {};
    people.set(row.rut, { ...(current.rut ? current : financeName(row)), rut: row.rut, bloque: row.bloque || current.bloque,
      estado: normalizeState(row.estado), activo: /inactiv/i.test(String(row.estado || '')) ? 0 : 1, es_honorario: /honorario/i.test(String(row.estado || '')) ? 1 : 0 });
  }
  for (const row of members.filter(row => row.rut_valido && !people.has(row.rut))) people.set(row.rut, { ...splitName(row.nombre), rut: row.rut, bloque: row.bloque, estado: 'activo', activo: 1 });
  let historicalPeopleCreated = 0;
  for (const row of positions.filter(row => row.rut_valido && rescuedPositionRuts.has(row.rut) && !people.has(row.rut))) {
    people.set(row.rut, { ...splitName(row.nombre), rut: row.rut, bloque: row.bloque, estado: 'inactivo', activo: 0 });
    historicalPeopleCreated += 1;
  }
  const personRows = [...people.values()].map(row => ({ rut: row.rut, nombres: row.nombres || splitName(row.nombre).nombres,
    apellido_paterno: row.apellido_paterno || splitName(row.nombre).apellido_paterno, apellido_materno: row.apellido_materno || splitName(row.nombre).apellido_materno,
    bloque: row.bloque || null, sexo: row.sexo || null, direccion: row.direccion || null, email: row.email || null, telefono: row.telefono || null,
    fecha_nacimiento: row.fecha_nacimiento || null, fecha_ingreso: row.fecha_ingreso || null, estado: row.estado || 'activo', activo: row.activo == null ? 1 : row.activo,
    es_honorario: row.es_honorario ? 1 : 0 }));

  const seen = new Set();
  const seasonAttendance = reconciled.rows.filter(row => row.incluido && row.rut_valido && people.has(row.rut)).filter(row => {
    const key = `${row.evento_origen_id}|${row.rut}`; if (seen.has(key)) return false; seen.add(key); return true;
  });
  const rescuedPositionAttendance = positionAttendanceRaw.filter(row =>
    people.has(row.rut) && !attendanceSourceKeys.has(`${row.rut}|${row.fecha}`)
  );
  const attendance = [...seasonAttendance, ...rescuedPositionAttendance];
  const eventGroups = new Map();
  for (const row of attendance) if (!eventGroups.has(row.evento_origen_id)) eventGroups.set(row.evento_origen_id, row);
  const byDate = new Map();
  for (const row of eventGroups.values()) { if (!byDate.has(row.fecha)) byDate.set(row.fecha, []); byDate.get(row.fecha).push(row); }
  const events = [];
  for (const [date, rows] of byDate) rows.sort((a, b) => a.fila_inicio_evento - b.fila_inicio_evento).forEach((row, index) => events.push({
    source_id: row.evento_origen_id,
    nombre: row.evento_pendiente ? `Actividad ${date}${rows.length > 1 ? ` ${index + 1}` : ''}` : row.evento,
    fecha: row.fecha_hora,
    descripcion: row.evento_pendiente
      ? `Migración GDC; origen ${row.evento_origen_id}; nombre provisional por fecha`
      : `Migración GDC; origen ${row.evento_origen_id}; asistencia recuperada de Planilla Posiciones 2025`,
    tipo: row.tipo_evento || 'reunion'
  }));

  const eligible = new Set(finance.rows.filter(row => row.rut_valido && !/honorario|receso|inactiv/i.test(String(row.estado || ''))).map(row => row.rut).filter(rut => people.has(rut)));
  const payments = finance.payments.filter(row => row.rut_valido && eligible.has(row.rut) && Number(row.monto) > 0 && !row.no_aplica);
  const allocation = allocatePaymentsToQuotas(payments, finance.rows);
  const paymentRefs = new Map(payments.map(row => [row.referencia_externa, `GDC:${row.referencia_externa.slice(0, 40)}`]));
  const paymentRows = payments.map(row => ({ rut: row.rut, ref: row.referencia_externa, metodo: paymentRefs.get(row.referencia_externa), monto: Number(row.monto), anio: row.anio, mes: row.mes }));
  const allocationRows = allocation.allocations.filter(row => row.cuota_periodo !== 'EXCEDENTE' && paymentRefs.has(row.referencia_externa_pago)).map(row => {
    const [year, month] = row.cuota_periodo.split('-').map(Number);
    return { ref: row.referencia_externa_pago, rut: row.rut, anio: year, mes: month, monto: row.monto_asignado };
  });
  const quotaRows = [...eligible].flatMap(rut => PERIODS.map(period => ({ rut, anio: period.year, mes: period.month, monto: period.amount,
    vencimiento: `${period.year}-${String(period.month).padStart(2, '0')}-${period.month === 9 ? '01' : '28'}` })));

  const seed = `-- Semilla GDC 2025-2026. Generada desde fuentes oficiales.\n-- No borra datos. Ejecutar primero en una copia respaldada.\n-- Nombres de eventos provisionales: Actividad + fecha. Pagos sin día exacto: fecha NULL.\nSET NAMES utf8mb4;\nSET @gdc_lote = 'gdc-2025-2026-v1';\nSTART TRANSACTION;\n\nALTER TABLE personas ADD COLUMN IF NOT EXISTS bloque VARCHAR(100) NULL AFTER apellido_materno;\nALTER TABLE personas ADD COLUMN IF NOT EXISTS sexo ENUM('Masculino','Femenino') NULL AFTER bloque;\nALTER TABLE personas ADD COLUMN IF NOT EXISTS direccion VARCHAR(255) NULL AFTER sexo;\nALTER TABLE personas ADD COLUMN IF NOT EXISTS fecha_ingreso DATE NULL AFTER fecha_nacimiento;\nALTER TABLE personas ADD COLUMN IF NOT EXISTS estado ENUM('activo','receso','inactivo') DEFAULT 'activo' AFTER activo;\nALTER TABLE personas ADD COLUMN IF NOT EXISTS es_honorario TINYINT(1) NOT NULL DEFAULT 0;\nALTER TABLE eventos ADD COLUMN IF NOT EXISTS finalizado TINYINT(1) NOT NULL DEFAULT 0;\n\nCREATE TABLE IF NOT EXISTS importacion_lotes (id BIGINT AUTO_INCREMENT PRIMARY KEY, identificador VARCHAR(100) NOT NULL UNIQUE, organizacion VARCHAR(100) NOT NULL, estado ENUM('preparado','aplicado','revertido','fallido') NOT NULL DEFAULT 'preparado', proceso_usuario VARCHAR(150) NOT NULL, fecha_importacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB;\nINSERT IGNORE INTO importacion_lotes (identificador, organizacion, estado, proceso_usuario) VALUES (@gdc_lote, 'gdc', 'preparado', 'semilla-generada-codex');\n\nCREATE TEMPORARY TABLE gdc_personas (rut VARCHAR(20) PRIMARY KEY, nombres VARCHAR(100), apellido_paterno VARCHAR(100), apellido_materno VARCHAR(100), bloque VARCHAR(100), sexo VARCHAR(20), direccion VARCHAR(255), email VARCHAR(150), telefono VARCHAR(30), fecha_nacimiento DATE, fecha_ingreso DATE, estado VARCHAR(20), activo TINYINT, es_honorario TINYINT);\n${valuesInsert('gdc_personas', ['rut','nombres','apellido_paterno','apellido_materno','bloque','sexo','direccion','email','telefono','fecha_nacimiento','fecha_ingreso','estado','activo','es_honorario'], personRows)}\nINSERT INTO personas (rut,nombres,apellido_paterno,apellido_materno,bloque,sexo,direccion,email,telefono,fecha_nacimiento,fecha_ingreso,estado,activo,es_honorario) SELECT rut,nombres,apellido_paterno,apellido_materno,bloque,sexo,direccion,email,telefono,fecha_nacimiento,fecha_ingreso,estado,activo,es_honorario FROM gdc_personas ON DUPLICATE KEY UPDATE bloque=COALESCE(VALUES(bloque),bloque), estado=VALUES(estado), activo=VALUES(activo), es_honorario=VALUES(es_honorario);\n\nCREATE TEMPORARY TABLE gdc_eventos (source_id VARCHAR(60) PRIMARY KEY, nombre VARCHAR(100), tipo VARCHAR(30), fecha DATETIME, descripcion TEXT);\n${valuesInsert('gdc_eventos', ['source_id','nombre','tipo','fecha','descripcion'], events)}\nINSERT INTO eventos (nombre,tipo,fecha,descripcion,finalizado) SELECT s.nombre,s.tipo,s.fecha,s.descripcion,1 FROM gdc_eventos s WHERE NOT EXISTS (SELECT 1 FROM eventos e WHERE e.descripcion=s.descripcion);\n\nCREATE TEMPORARY TABLE gdc_asistencias (source_id VARCHAR(60), rut VARCHAR(20), fecha_registro DATETIME, PRIMARY KEY(source_id,rut));\n${valuesInsert('gdc_asistencias', ['source_id','rut','fecha_registro'], attendance.map(row => ({ source_id: row.evento_origen_id, rut: row.rut, fecha_registro: row.fecha_hora })))}\nINSERT IGNORE INTO asistencias (evento_id,persona_id,estado,minutos_atraso,fecha_registro) SELECT e.id,p.id,'presente',0,a.fecha_registro FROM gdc_asistencias a JOIN personas p ON p.rut=a.rut JOIN gdc_eventos s ON s.source_id=a.source_id JOIN eventos e ON e.descripcion=s.descripcion;\n\nINSERT INTO tipos_cuotas (nombre,monto_base,descripcion) SELECT 'Mensualidad',10000,'Cuota mensual GDC' WHERE NOT EXISTS (SELECT 1 FROM tipos_cuotas WHERE nombre='Mensualidad');\nSET @tipo_mensualidad = (SELECT id FROM tipos_cuotas WHERE nombre='Mensualidad' ORDER BY id LIMIT 1);\nUPDATE tipos_cuotas SET monto_base=10000 WHERE id=@tipo_mensualidad;\nCREATE TEMPORARY TABLE gdc_cuotas (rut VARCHAR(20), anio INT, mes INT, monto INT, vencimiento DATE, PRIMARY KEY(rut,anio,mes));\n${valuesInsert('gdc_cuotas', ['rut','anio','mes','monto','vencimiento'], quotaRows)}\nINSERT IGNORE INTO cuotas (persona_id,tipo_cuota_id,monto,mes,anio,fecha_vencimiento,estado,origen) SELECT p.id,@tipo_mensualidad,q.monto,q.mes,q.anio,q.vencimiento,'pendiente','externo' FROM gdc_cuotas q JOIN personas p ON p.rut=q.rut;\n\nCREATE TEMPORARY TABLE gdc_pagos (ref CHAR(64) PRIMARY KEY, rut VARCHAR(20), metodo VARCHAR(50), monto INT, anio INT, mes INT);\n${valuesInsert('gdc_pagos', ['ref','rut','metodo','monto','anio','mes'], paymentRows)}\nINSERT INTO pagos (persona_id,monto_total,metodo,fecha,tipo_pago) SELECT p.id,s.monto,s.metodo,NULL,'cuota' FROM gdc_pagos s JOIN personas p ON p.rut=s.rut WHERE NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.metodo=s.metodo);\nCREATE TEMPORARY TABLE gdc_asignaciones (ref CHAR(64), rut VARCHAR(20), anio INT, mes INT, monto INT, PRIMARY KEY(ref,anio,mes));\n${valuesInsert('gdc_asignaciones', ['ref','rut','anio','mes','monto'], allocationRows)}\nINSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado) SELECT pg.id,'cuota',c.id,a.monto FROM gdc_asignaciones a JOIN gdc_pagos s ON s.ref=a.ref JOIN pagos pg ON pg.metodo=s.metodo JOIN personas p ON p.rut=a.rut JOIN cuotas c ON c.persona_id=p.id AND c.tipo_cuota_id=@tipo_mensualidad AND c.anio=a.anio AND c.mes=a.mes WHERE NOT EXISTS (SELECT 1 FROM pago_detalle d WHERE d.pago_id=pg.id AND d.tipo='cuota' AND d.referencia_id=c.id);\nUPDATE cuotas c LEFT JOIN (SELECT referencia_id,SUM(monto_pagado) pagado FROM pago_detalle WHERE tipo='cuota' GROUP BY referencia_id) d ON d.referencia_id=c.id SET c.estado=CASE WHEN COALESCE(d.pagado,0)>=c.monto THEN 'pagado' WHEN c.fecha_vencimiento<CURDATE() THEN 'vencido' ELSE 'pendiente' END WHERE c.tipo_cuota_id=@tipo_mensualidad AND c.anio IN (2025,2026);\n\nUPDATE importacion_lotes SET estado='aplicado' WHERE identificador=@gdc_lote;\nCOMMIT;\n\nSELECT 'personas' entidad, COUNT(*) total FROM gdc_personas UNION ALL SELECT 'eventos',COUNT(*) FROM gdc_eventos UNION ALL SELECT 'asistencias',COUNT(*) FROM gdc_asistencias UNION ALL SELECT 'cuotas',COUNT(*) FROM gdc_cuotas UNION ALL SELECT 'pagos',COUNT(*) FROM gdc_pagos UNION ALL SELECT 'asignaciones',COUNT(*) FROM gdc_asignaciones;\n`;
  const compatibleSeed = seed
    .replace(
      'Pagos sin día exacto: fecha NULL.',
      'Regla excepcional 2025-2026: pagos fechados el día 1 del mes informado, con precisión mensual.'
    )
    .replace(
      'COALESCE(VALUES(bloque),bloque)',
      'COALESCE(VALUES(bloque),personas.bloque)'
    )
    .replace(
      'ALTER TABLE eventos ADD COLUMN IF NOT EXISTS finalizado TINYINT(1) NOT NULL DEFAULT 0;',
      `ALTER TABLE eventos ADD COLUMN IF NOT EXISTS finalizado TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS referencia_externa CHAR(64) NULL;
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_precision ENUM('exacta','mensual') NOT NULL DEFAULT 'exacta';`
    )
    .replace(
      "INSERT INTO tipos_cuotas (nombre,monto_base,descripcion) SELECT 'Mensualidad',10000,'Cuota mensual GDC' WHERE NOT EXISTS (SELECT 1 FROM tipos_cuotas WHERE nombre='Mensualidad');\nSET @tipo_mensualidad = (SELECT id FROM tipos_cuotas WHERE nombre='Mensualidad' ORDER BY id LIMIT 1);\nUPDATE tipos_cuotas SET monto_base=10000 WHERE id=@tipo_mensualidad;",
      `INSERT INTO tipos_cuotas (nombre,monto_base,descripcion)
SELECT 'Mensualidad',12000,'Cuota mensual GDC'
WHERE NOT EXISTS (SELECT 1 FROM tipos_cuotas WHERE nombre='Mensualidad');
SET @tipo_mensualidad = (SELECT MIN(id) FROM tipos_cuotas WHERE nombre='Mensualidad');
UPDATE cuotas c JOIN tipos_cuotas t ON t.id=c.tipo_cuota_id
SET c.tipo_cuota_id=@tipo_mensualidad WHERE t.nombre='Mensualidad' AND t.id<>@tipo_mensualidad;
DELETE FROM tipos_cuotas WHERE nombre='Mensualidad' AND id<>@tipo_mensualidad;
UPDATE tipos_cuotas SET monto_base=12000, descripcion='Cuota mensual GDC' WHERE id=@tipo_mensualidad;`
    )
    .replace(
      "INSERT INTO pagos (persona_id,monto_total,metodo,fecha,tipo_pago) SELECT p.id,s.monto,s.metodo,NULL,'cuota' FROM gdc_pagos s JOIN personas p ON p.rut=s.rut WHERE NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.metodo=s.metodo);",
      `INSERT INTO pagos (persona_id,monto_total,metodo,fecha,referencia_externa,fecha_precision)
SELECT p.id,s.monto,'migracion',STR_TO_DATE(CONCAT(s.anio,'-',LPAD(s.mes,2,'0'),'-01'),'%Y-%m-%d'),s.ref,'mensual'
FROM gdc_pagos s JOIN personas p ON p.rut=s.rut
WHERE NOT EXISTS (SELECT 1 FROM pagos pg WHERE pg.referencia_externa=s.ref);`
    )
    .replace(
      'JOIN pagos pg ON pg.metodo=s.metodo',
      'JOIN pagos pg ON pg.referencia_externa=s.ref'
    )
    .replace(
      "INSERT IGNORE INTO cuotas (persona_id,tipo_cuota_id,monto,mes,anio,fecha_vencimiento,estado,origen) SELECT p.id,@tipo_mensualidad,q.monto,q.mes,q.anio,q.vencimiento,'pendiente','externo' FROM gdc_cuotas q JOIN personas p ON p.rut=q.rut;",
      `INSERT IGNORE INTO cuotas (persona_id,tipo_cuota_id,monto,mes,anio,fecha_vencimiento,estado,origen)
SELECT p.id,@tipo_mensualidad,q.monto,q.mes,q.anio,q.vencimiento,'pendiente','externo'
FROM gdc_cuotas q JOIN personas p ON p.rut=q.rut;
UPDATE cuotas c JOIN personas p ON p.id=c.persona_id JOIN gdc_cuotas q
  ON q.rut=p.rut AND q.anio=c.anio AND q.mes=c.mes
SET c.monto=q.monto,c.fecha_vencimiento=q.vencimiento,c.tipo_cuota_id=@tipo_mensualidad;`
    )
    .replace(
      "INSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado) SELECT pg.id,'cuota',c.id,a.monto FROM gdc_asignaciones a",
      `DELETE FROM puntajes WHERE detalle='Bonificación pago anual en un solo pago (temporada 2025-2026)';
DELETE pt FROM puntajes pt JOIN cuotas c ON c.id=pt.cuota_id JOIN personas p ON p.id=c.persona_id
WHERE p.rut IN (SELECT rut FROM gdc_personas) AND c.anio IN (2025,2026);
DELETE d FROM pago_detalle d JOIN pagos pg ON pg.id=d.pago_id
WHERE pg.referencia_externa IN (SELECT ref FROM gdc_pagos)
   OR (pg.fecha_precision='mensual' AND DATE_FORMAT(pg.fecha,'%Y-%m')='2026-08');
DELETE FROM pagos WHERE fecha_precision='mensual' AND DATE_FORMAT(fecha,'%Y-%m')='2026-08' AND referencia_externa IS NOT NULL;
DELETE c FROM cuotas c JOIN personas p ON p.id=c.persona_id
WHERE p.rut IN (SELECT rut FROM gdc_personas) AND c.anio=2026 AND c.mes IN (8,9) AND c.origen='externo';

INSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado) SELECT pg.id,'cuota',c.id,a.monto FROM gdc_asignaciones a`
    )
    .replace(
      "UPDATE importacion_lotes SET estado='aplicado' WHERE identificador=@gdc_lote;",
      `INSERT INTO puntajes (persona_id,asistencia_id,evento_id,puntos,detalle,fecha)
SELECT a.persona_id,a.id,a.evento_id,
  CASE WHEN EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado') THEN 10 ELSE 5 END,
  CASE WHEN EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado') THEN 'Presente + cuota al día (migración mensual)' ELSE 'Presente sin cuota al día (migración mensual)' END,
  DATE(e.fecha)
FROM asistencias a JOIN eventos e ON e.id=a.evento_id
WHERE a.estado='presente'
  AND e.nombre NOT LIKE 'Actividad %'
ON DUPLICATE KEY UPDATE puntos=VALUES(puntos),detalle=VALUES(detalle),fecha=VALUES(fecha); -- Excluye eventos provisionales hasta su clasificación estatutaria.

INSERT IGNORE INTO puntajes (persona_id,cuota_id,puntos,detalle,fecha)
SELECT c.persona_id,c.id,
  CASE WHEN MAX(gp.anio*100+gp.mes)<c.anio*100+c.mes
         OR (c.anio=2025 AND c.mes=10 AND MAX(CASE WHEN gp.anio=2025 AND gp.mes=10 AND gp.monto>=120000 THEN 1 ELSE 0 END)=1)
       THEN 20 ELSE 10 END,
  CASE WHEN MAX(gp.anio*100+gp.mes)<c.anio*100+c.mes
         OR (c.anio=2025 AND c.mes=10 AND MAX(CASE WHEN gp.anio=2025 AND gp.mes=10 AND gp.monto>=120000 THEN 1 ELSE 0 END)=1)
       THEN 'Cuota pagada anticipadamente (migración mensual)' ELSE 'Cuota pagada oportunamente (migración mensual)' END,
  STR_TO_DATE(CONCAT(FLOOR(MAX(gp.anio*100+gp.mes)/100),'-',LPAD(MOD(MAX(gp.anio*100+gp.mes),100),2,'0'),'-01'),'%Y-%m-%d')
FROM cuotas c
JOIN personas p ON p.id=c.persona_id
JOIN gdc_asignaciones ga ON ga.rut=p.rut AND ga.anio=c.anio AND ga.mes=c.mes
JOIN gdc_pagos gp ON gp.ref=ga.ref
WHERE c.estado='pagado'
GROUP BY c.id,c.persona_id,c.anio,c.mes
HAVING MAX(gp.anio*100+gp.mes)<=c.anio*100+c.mes;

CREATE OR REPLACE VIEW vista_estado_financiero AS
SELECT p.id,p.nombres,p.apellido_paterno,p.apellido_materno,
  COALESCE(m.total_multas,0) total_multas,
  COALESCE(c.total_cuotas,0) total_cuotas,
  COALESCE(pg.total_pagado,0) total_pagado,
  COALESCE(c.total_cuotas,0)-COALESCE(pg.total_pagado,0) deuda_actual
FROM personas p
LEFT JOIN (SELECT persona_id,SUM(monto) total_multas FROM multas WHERE estado='pendiente' GROUP BY persona_id) m ON m.persona_id=p.id
LEFT JOIN (SELECT persona_id,SUM(monto) total_cuotas FROM cuotas GROUP BY persona_id) c ON c.persona_id=p.id
LEFT JOIN (SELECT persona_id,SUM(monto_total) total_pagado FROM pagos GROUP BY persona_id) pg ON pg.persona_id=p.id
WHERE p.activo=1 AND COALESCE(p.estado,'activo')='activo';

CREATE OR REPLACE VIEW vista_ranking_puntaje AS
SELECT p.id,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque,
  COALESCE(SUM(pt.puntos),0) puntaje_total,COUNT(pt.id) total_registros
FROM personas p LEFT JOIN puntajes pt ON pt.persona_id=p.id
WHERE p.activo=1 AND COALESCE(p.estado,'activo')='activo'
GROUP BY p.id,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque
ORDER BY puntaje_total DESC;

UPDATE importacion_lotes SET estado='aplicado' WHERE identificador=@gdc_lote;`
    );
  fs.mkdirSync(path.dirname(files.output), { recursive: true });
  fs.writeFileSync(files.output, compatibleSeed, 'utf8');
  const summary = { output: files.output, personas: personRows.length, eventos: events.length, asistencias: attendance.length,
    asistencias_temporada: seasonAttendance.length, asistencias_rescatadas_posiciones: rescuedPositionAttendance.length, cuotas: quotaRows.length,
    pagos: paymentRows.length, asignaciones: allocationRows.length, ruts_asistencia_sin_resolver: reconciled.unresolved.filter(row => row.incluido).length,
    integrantes_historicos_creados: historicalPeopleCreated,
    eventos_con_nombre_provisional: events.filter(event => /^Actividad \d{4}-\d{2}-\d{2}/.test(event.nombre)).length };
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

if (require.main === module) { try { build(); } catch (error) { console.error(error.stack || error.message); process.exitCode = 1; } }
module.exports = { build, splitName, sql };
