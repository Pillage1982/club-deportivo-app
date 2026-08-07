'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  try {
    const query = async sql => (await connection.query(sql))[0];
    const tables = await query('SELECT TABLE_NAME, TABLE_TYPE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_TYPE, TABLE_NAME');
    const columns = await query('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
    const has = (table, column) => columns.some(row => row.TABLE_NAME === table && row.COLUMN_NAME === column);
    const counts = {};
    for (const table of tables.filter(row => row.TABLE_TYPE === 'BASE TABLE')) {
      counts[table.TABLE_NAME] = Number((await query(`SELECT COUNT(*) total FROM \`${table.TABLE_NAME}\``))[0].total);
    }
    const checks = {
    duplicate_rut: await query("SELECT UPPER(REPLACE(REPLACE(REPLACE(rut,'.',''),'-',''),' ','')) rut_norm, COUNT(*) cantidad FROM personas WHERE rut IS NOT NULL GROUP BY rut_norm HAVING COUNT(*)>1"),
    personas_incompletas: await query("SELECT COUNT(*) total FROM personas WHERE rut IS NULL OR rut='' OR nombres='' OR apellido_paterno=''"),
    personas_por_estado: await query(`SELECT activo, ${has('personas','estado') ? "COALESCE(estado,'sin_estado')" : "'columna_ausente'"} estado, ${has('personas','es_honorario') ? 'COALESCE(es_honorario,0)' : '0'} es_honorario, COUNT(*) cantidad FROM personas GROUP BY activo${has('personas','estado') ? ', estado' : ''}${has('personas','es_honorario') ? ', es_honorario' : ''}`),
    cuotas_por_estado: await query('SELECT estado, COUNT(*) cantidad, COALESCE(SUM(monto),0) monto FROM cuotas GROUP BY estado'),
    cuotas_por_periodo: await query('SELECT anio, mes, COUNT(*) cantidad, COALESCE(SUM(monto),0) monto FROM cuotas GROUP BY anio, mes ORDER BY anio, mes'),
    pagos: await query('SELECT COUNT(*) cantidad, COALESCE(SUM(monto_total),0) monto, SUM(fecha IS NULL) sin_fecha FROM pagos'),
    detalle: await query('SELECT COUNT(*) cantidad, COALESCE(SUM(monto_pagado),0) monto FROM pago_detalle'),
    pagos_descuadrados: await query('SELECT COUNT(*) total FROM (SELECT pg.id FROM pagos pg LEFT JOIN pago_detalle d ON d.pago_id=pg.id GROUP BY pg.id,pg.monto_total HAVING COALESCE(SUM(d.monto_pagado),0)<>pg.monto_total) x'),
    asistencia_estados: await query('SELECT estado, COUNT(*) cantidad FROM asistencias GROUP BY estado'),
    eventos: await query(`SELECT COUNT(*) cantidad, MIN(fecha) primera, MAX(fecha) ultima, ${has('eventos','finalizado') ? 'SUM(COALESCE(finalizado,0)=1)' : 'NULL'} finalizados FROM eventos`),
    huerfanas_asistencia: await query('SELECT COUNT(*) total FROM asistencias a LEFT JOIN personas p ON p.id=a.persona_id LEFT JOIN eventos e ON e.id=a.evento_id WHERE p.id IS NULL OR e.id IS NULL'),
    huerfanas_cuotas: await query('SELECT COUNT(*) total FROM cuotas c LEFT JOIN personas p ON p.id=c.persona_id LEFT JOIN tipos_cuotas t ON t.id=c.tipo_cuota_id WHERE p.id IS NULL OR t.id IS NULL'),
    huerfanos_pagos: await query('SELECT COUNT(*) total FROM pagos pg LEFT JOIN personas p ON p.id=pg.persona_id WHERE p.id IS NULL'),
    huerfanos_detalle: await query("SELECT COUNT(*) total FROM pago_detalle d LEFT JOIN pagos p ON p.id=d.pago_id LEFT JOIN cuotas c ON d.tipo='cuota' AND c.id=d.referencia_id WHERE p.id IS NULL OR (d.tipo='cuota' AND c.id IS NULL)"),
    lotes: counts.importacion_lotes != null ? await query('SELECT identificador, estado, fecha_importacion FROM importacion_lotes ORDER BY id') : []
    };
    for (const view of tables.filter(row => row.TABLE_TYPE === 'VIEW')) {
      try { checks[`vista_${view.TABLE_NAME}`] = (await query(`SELECT COUNT(*) total FROM \`${view.TABLE_NAME}\``))[0]; }
      catch (error) { checks[`vista_${view.TABLE_NAME}`] = { error: error.code, message: error.message }; }
    }
    console.log(JSON.stringify({ database: process.env.DB_NAME, tables, counts, missing_app_columns: [
      ['personas','estado'],['personas','bloque'],['personas','sexo'],['personas','direccion'],['personas','fecha_ingreso'],['personas','nombre_apoderado'],['personas','telefono_apoderado'],['personas','es_honorario'],['eventos','finalizado']
    ].filter(([table,column]) => !has(table,column)).map(([table,column]) => `${table}.${column}`), checks }, null, 2));
  } finally {
    await connection.end();
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
