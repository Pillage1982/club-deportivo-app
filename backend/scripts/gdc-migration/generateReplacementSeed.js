#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const source = path.resolve(process.argv[2] || 'database/seed_gdc_2025_2026.sql');
const output = path.resolve(process.argv[3] || 'database/seed_gdc_2025_2026_reemplazo_total.sql');
const seed = fs.readFileSync(source, 'utf8');
const marker = "INSERT INTO personas (rut,nombres,apellido_paterno,apellido_materno,bloque,sexo,direccion,email,telefono,fecha_nacimiento,fecha_ingreso,estado,activo,es_honorario)";
if (!seed.includes(marker)) throw new Error('No se encontró el punto seguro para insertar la limpieza.');

const cleanup = `

-- REEMPLAZO TOTAL DE DATOS OPERACIONALES GDC.
-- Antes de ejecutar: realizar respaldo completo de la base objetivo.
-- Se conservan usuarios, roles, catálogo de roles, tipos de cuota y configuración.
CREATE TABLE IF NOT EXISTS puntajes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  persona_id INT NOT NULL,
  asistencia_id INT NULL,
  evento_id INT NULL,
  cuota_id INT NULL,
  puntos INT NOT NULL,
  detalle VARCHAR(200) NOT NULL,
  fecha DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_asistencia (asistencia_id),
  UNIQUE KEY uk_cuota (cuota_id)
);

SET @gdc_foreign_key_checks_anterior = @@FOREIGN_KEY_CHECKS;
START TRANSACTION;
SET FOREIGN_KEY_CHECKS = 0;
DELETE FROM puntajes;
DELETE FROM pago_detalle;
DELETE FROM pagos;
DELETE FROM cuotas;
DELETE FROM multas;
DELETE FROM asistencias;
DELETE FROM evento_participantes;
DELETE FROM eventos;
DELETE FROM persona_rol;
DELETE FROM personas;
SET FOREIGN_KEY_CHECKS = @gdc_foreign_key_checks_anterior;
`;

const replacement = seed
  .replace('-- No borra datos. Ejecutar primero en una copia respaldada.', '-- REEMPLAZA los datos operacionales anteriores. Requiere respaldo completo antes de ejecutar.')
  .replace(marker, cleanup + '\n' + marker)
  .replace(
    ' FROM gdc_personas ON DUPLICATE KEY UPDATE bloque=COALESCE(VALUES(bloque),personas.bloque), estado=VALUES(estado), activo=VALUES(activo), es_honorario=VALUES(es_honorario);',
    ' FROM gdc_personas;'
  );
fs.writeFileSync(output, replacement, 'utf8');
console.log(JSON.stringify({ source, output, destructive: true }, null, 2));
