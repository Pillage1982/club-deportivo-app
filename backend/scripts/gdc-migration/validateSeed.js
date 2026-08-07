'use strict';

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mysql = require('mysql2/promise');

const VALIDATION_DB = 'gdc_seed_validation_codex';
const TABLES = ['personas', 'eventos', 'asistencias', 'tipos_cuotas', 'cuotas', 'pagos', 'pago_detalle'];

async function main() {
  const seedFile = path.resolve(process.argv[2] || 'database/seed_gdc_2025_2026.sql');
  const sourceDb = process.env.DB_NAME;
  const admin = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, multipleStatements: true });
  const [existing] = await admin.query('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?', [VALIDATION_DB]);
  if (existing.length) throw new Error(`La base temporal ${VALIDATION_DB} ya existe; no se eliminó automáticamente.`);
  try {
    await admin.query(`CREATE DATABASE \`${VALIDATION_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    for (const table of TABLES) await admin.query(`CREATE TABLE \`${VALIDATION_DB}\`.\`${table}\` LIKE \`${sourceDb}\`.\`${table}\``);
    await admin.query(`USE \`${VALIDATION_DB}\``);
    await admin.query(fs.readFileSync(seedFile, 'utf8'));
    const counts = {};
    for (const table of TABLES) { const [rows] = await admin.query(`SELECT COUNT(*) total FROM \`${table}\``); counts[table] = Number(rows[0].total); }
    const [lot] = await admin.query("SELECT identificador, estado FROM importacion_lotes WHERE identificador='gdc-2025-2026-v1'");
    console.log(JSON.stringify({ valid: true, database: VALIDATION_DB, counts, lot: lot[0] }, null, 2));
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${VALIDATION_DB}\``);
    await admin.end();
  }
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
