'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const TABLES = [
  'personas', 'eventos', 'asistencias', 'cuotas', 'tipos_cuotas',
  'pagos', 'pago_detalle', 'puntajes', 'importacion_lotes', 'importacion_auditoria'
];

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    connectTimeout: 10000
  });
  const [identity] = await connection.query('SELECT DATABASE() AS db, @@hostname AS server');
  const [validationSchemas] = await connection.query("SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'gdc_seed_validation_codex'");
  const placeholders = TABLES.map(() => '?').join(',');
  const [found] = await connection.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders}) ORDER BY TABLE_NAME`,
    TABLES
  );
  const counts = {};
  const columns = {};
  for (const { TABLE_NAME: table } of found) {
    const [rows] = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
    counts[table] = Number(rows[0].total);
    const [definition] = await connection.query(
      'SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION',
      [table]
    );
    columns[table] = definition;
  }
  console.log(JSON.stringify({ connection: identity[0], validation_database_exists: validationSchemas.length > 0, tables: found.map(row => row.TABLE_NAME), counts, columns }, null, 2));
  await connection.end();
}

main().catch(error => {
  console.error(`${error.code || 'ERROR'}: ${error.message}`);
  process.exitCode = 1;
});
