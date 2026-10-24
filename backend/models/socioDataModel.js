// Acceso MySQL de datos propios del socio (Portal del Socio): ficha, finanzas y
// asistencia de UN solo persona_id — nunca listas completas ni datos de otros
// integrantes.
//
// Nota de esquema (NexoComunidad genérico, distinto de calamena): esta rama no
// tiene `pago_detalle` (un pago no se vincula a cuotas específicas), y
// `deuda_actual` SÍ incluye multas — igual que vista_estado_financiero (ver
// migrations.js). Por eso las consultas de aquí son más simples que las de
// cliente/calamena, no es un recorte accidental.
const db = require('../config/db');

// =====================================
// "ACTUALIZAR DATOS" (lo único que el socio puede editar)
// =====================================
exports.obtenerDatosEditables = (personaId, callback) => {
  db.query(
    `SELECT
       p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       p.bloque, COALESCE(p.estado, 'activo') AS estado, p.fecha_ingreso, p.es_honorario,
       p.telefono, p.email, p.direccion, p.fecha_nacimiento, p.sexo,
       p.nombre_apoderado, p.telefono_apoderado
     FROM personas p
     WHERE p.id = ? AND p.activo = 1
     LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// Guarda solo las columnas que el socio puede editar (lista cerrada, nunca
// nombres de columna desde el request) y marca la actualización como hecha en
// la misma sentencia: o quedan los dos cambios o ninguno.
const COLUMNAS_EDITABLES_SOCIO = [
  'telefono', 'email', 'direccion', 'fecha_nacimiento', 'fecha_ingreso', 'sexo',
  'nombre_apoderado', 'telefono_apoderado'
];

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
// Misma fórmula que vista_estado_financiero (multas + cuotas − pagos de cuota), pero
// sin su filtro "estado='activo'": un socio en receso también puede ver/pagar su deuda.
exports.obtenerResumenDeuda = (personaId, callback) => {
  db.query(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM multas WHERE persona_id = ? AND estado = 'pendiente') AS total_multas,
       (SELECT COALESCE(SUM(monto), 0) FROM cuotas WHERE persona_id = ?) AS total_cuotas,
       (SELECT COALESCE(SUM(monto_total), 0) FROM pagos WHERE persona_id = ? AND tipo_pago = 'cuota') AS total_pagado`,
    [personaId, personaId, personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// monto_pagado: lo abonado a cada cuota (pago_detalle).
exports.obtenerHistorialCuotas = (personaId, callback) => {
  db.query(
    `SELECT c.id, c.mes, c.anio, c.monto, c.estado, c.fecha_vencimiento,
            COALESCE(SUM(d.monto_pagado), 0) AS monto_pagado
     FROM cuotas c
     LEFT JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
     WHERE c.persona_id = ?
     GROUP BY c.id, c.mes, c.anio, c.monto, c.estado, c.fecha_vencimiento
     ORDER BY c.anio DESC, c.mes DESC`,
    [personaId],
    callback
  );
};

exports.obtenerHistorialPagos = (personaId, callback) => {
  db.query(
    `SELECT id, monto_total, metodo, fecha, tipo_pago, detalle
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
