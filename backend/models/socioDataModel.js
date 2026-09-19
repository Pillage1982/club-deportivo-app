// Acceso MySQL de datos propios del socio (Portal del Socio): ficha, finanzas y
// asistencia de UN solo persona_id — nunca listas completas ni datos de otros
// integrantes.
//
// Nota de esquema (NexoComunidad genérico, distinto de calamena): esta rama no
// tiene `pago_detalle` (un pago no se vincula a cuotas específicas) ni columnas
// de apoderado en `personas`, y `deuda_actual` SÍ incluye multas — igual que
// vista_estado_financiero (ver migrations.js). Por eso las consultas de aquí son
// más simples que las de cliente/calamena, no es un recorte accidental.
const db = require('../config/db');

// =====================================
// FICHA (solo lectura)
// =====================================
exports.obtenerFicha = (personaId, callback) => {
  db.query(
    `SELECT
       rut, nombres, apellido_paterno, apellido_materno,
       bloque, sexo, direccion, email, telefono,
       fecha_nacimiento, fecha_ingreso,
       COALESCE(estado, 'activo') AS estado
     FROM personas
     WHERE id = ? AND activo = 1
     LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// =====================================
// FINANZAS: deuda actual, historial de cuotas, pagos y multas
// =====================================
// Misma fórmula que vista_estado_financiero (multas + cuotas - pagado), pero sin
// su filtro "estado='activo'": un socio en receso también puede ver/pagar su deuda.
exports.obtenerResumenDeuda = (personaId, callback) => {
  db.query(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM multas WHERE persona_id = ? AND estado = 'pendiente') AS total_multas,
       (SELECT COALESCE(SUM(monto), 0) FROM cuotas WHERE persona_id = ?) AS total_cuotas,
       (SELECT COALESCE(SUM(monto_total), 0) FROM pagos WHERE persona_id = ?) AS total_pagado`,
    [personaId, personaId, personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

exports.obtenerHistorialCuotas = (personaId, callback) => {
  db.query(
    `SELECT id, mes, anio, monto, estado, fecha_vencimiento
     FROM cuotas
     WHERE persona_id = ?
     ORDER BY anio DESC, mes DESC`,
    [personaId],
    callback
  );
};

exports.obtenerHistorialPagos = (personaId, callback) => {
  db.query(
    `SELECT id, monto_total, metodo, fecha
     FROM pagos
     WHERE persona_id = ?
     ORDER BY fecha DESC`,
    [personaId],
    callback
  );
};

exports.obtenerHistorialMultas = (personaId, callback) => {
  db.query(
    `SELECT id, monto, motivo, fecha, estado
     FROM multas
     WHERE persona_id = ?
     ORDER BY fecha DESC`,
    [personaId],
    callback
  );
};

// =====================================
// ASISTENCIA: historial de eventos propio
// =====================================
exports.obtenerHistorialAsistencia = (personaId, callback) => {
  db.query(
    `SELECT
       a.id, e.nombre AS evento, e.tipo AS tipo_evento, e.fecha AS fecha_evento,
       a.estado, a.minutos_atraso
     FROM asistencias a
     JOIN eventos e ON e.id = a.evento_id
     WHERE a.persona_id = ?
     ORDER BY e.fecha DESC
     LIMIT 200`,
    [personaId],
    callback
  );
};
