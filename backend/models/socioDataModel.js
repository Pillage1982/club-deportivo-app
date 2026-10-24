// Acceso MySQL de datos propios del socio (Portal del Socio): ficha, finanzas y
// asistencia de UN solo persona_id — nunca listas completas ni datos de otros
// integrantes.
//
// Nota de esquema (esta rama, la más simple de las 4): `personas` no tiene
// bloque/sexo/dirección/fecha_ingreso ni columnas de apoderado; no hay tabla
// `pago_detalle` (un pago no se vincula a cuotas específicas); y
// `deuda_actual` SÍ incluye multas — igual que vista_estado_financiero
// (ver migrations.js).
const db = require('../config/db');

// =====================================
// "ACTUALIZAR DATOS" (lo único que el socio puede editar)
// =====================================
exports.obtenerDatosEditables = (personaId, callback) => {
  db.query(
    `SELECT rut, nombres, apellido_paterno, apellido_materno,
            COALESCE(estado, 'activo') AS estado,
            telefono, email, fecha_nacimiento
     FROM personas
     WHERE id = ? AND activo = 1
     LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// Guarda solo las columnas que el socio puede editar (lista cerrada, nunca
// nombres de columna desde el request) y marca la actualización como hecha en
// la misma sentencia: o quedan los dos cambios o ninguno.
const COLUMNAS_EDITABLES_SOCIO = ['telefono', 'email', 'fecha_nacimiento'];

exports.guardarDatosSocio = (personaId, datos, callback) => {
  const columnas = COLUMNAS_EDITABLES_SOCIO.filter(col => datos[col] !== undefined);
  const asignaciones = columnas.map(col => `p.${col} = ?`);
  const valores = columnas.map(col => datos[col]);

  db.query(
    `UPDATE personas p
     INNER JOIN socios_auth sa ON sa.persona_id = p.id
     SET ${asignaciones.join(', ')},
         sa.datos_actualizados = 1,
         sa.datos_actualizados_en = NOW()
     WHERE p.id = ? AND p.activo = 1`,
    [...valores, personaId],
    callback
  );
};

// =====================================
// FICHA (solo lectura)
// =====================================
exports.obtenerFicha = (personaId, callback) => {
  db.query(
    `SELECT
       rut, nombres, apellido_paterno, apellido_materno,
       email, telefono, fecha_nacimiento,
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
