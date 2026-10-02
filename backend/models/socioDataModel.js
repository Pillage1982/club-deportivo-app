// Acceso MySQL de datos propios del socio (Portal del Socio): ficha, finanzas y
// asistencia de UN solo persona_id — nunca listas completas ni datos de otros
// integrantes. El puntaje reutiliza puntajeModel (ranking completo + historial)
// y filtra/deriva la posición propia en el controller, sin duplicar esa lógica aquí.
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
       nombre_apoderado, telefono_apoderado,
       COALESCE(estado, 'activo') AS estado
     FROM personas
     WHERE id = ? AND activo = 1
     LIMIT 1`,
    [personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

// =====================================
// ACTUALIZAR DATOS (paso obligatorio después de crear el PIN)
// =====================================
// Incluye los campos de solo lectura (RUT, nombre, escuadra...) para mostrarlos
// en el formulario, y datos_actualizados_en para saber si ya confirmó alguna vez.
exports.obtenerDatosEditables = (personaId, callback) => {
  db.query(
    `SELECT
       p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       p.bloque, COALESCE(p.estado, 'activo') AS estado, p.fecha_ingreso, p.es_honorario,
       p.telefono, p.email, p.direccion, p.fecha_nacimiento, p.sexo,
       p.nombre_apoderado, p.rut_apoderado, p.telefono_apoderado,
       p.bautizo, p.comunion, p.confirmacion,
       sa.datos_actualizados_en
     FROM personas p
     LEFT JOIN socios_auth sa ON sa.persona_id = p.id
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
  'bautizo', 'comunion', 'confirmacion',
  'nombre_apoderado', 'rut_apoderado', 'telefono_apoderado'
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
// FINANZAS: deuda actual, historial de cuotas y de pagos
// =====================================
// Deuda = total cuotas - total pagado, igual que vista_estado_financiero, pero sin su
// filtro "estado='activo'" (un socio en receso también puede ver y pagar su deuda).
exports.obtenerResumenDeuda = (personaId, callback) => {
  db.query(
    `SELECT
       (SELECT COALESCE(SUM(monto), 0) FROM cuotas WHERE persona_id = ?) AS total_cuotas,
       (SELECT COALESCE(SUM(monto_total), 0) FROM pagos WHERE persona_id = ?) AS total_pagado`,
    [personaId, personaId],
    (err, rows) => callback(err, rows ? rows[0] : null)
  );
};

exports.obtenerHistorialCuotas = (personaId, callback) => {
  db.query(
    `SELECT
       c.id, c.mes, c.anio, c.monto, c.estado, c.fecha_vencimiento,
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

// GROUP_CONCAT de las cuotas que cada pago cubrió (vía pago_detalle) — así el socio
// ve "a qué mes(es) corresponde" cada pago sin tener que cruzar dos tablas a mano.
exports.obtenerHistorialPagos = (personaId, callback) => {
  db.query(
    `SELECT
       pa.id, pa.monto_total, pa.metodo, pa.fecha,
       COALESCE(pa.fecha_precision, 'exacta') AS fecha_precision,
       pa.referencia_externa,
       GROUP_CONCAT(
         DISTINCT CONCAT(c.mes, '/', c.anio)
         ORDER BY c.anio, c.mes SEPARATOR ', '
       ) AS cuotas_cubiertas
     FROM pagos pa
     LEFT JOIN pago_detalle pd ON pd.pago_id = pa.id AND pd.tipo = 'cuota'
     LEFT JOIN cuotas c ON c.id = pd.referencia_id
     WHERE pa.persona_id = ?
     GROUP BY pa.id, pa.monto_total, pa.metodo, pa.fecha, pa.fecha_precision, pa.referencia_externa
     ORDER BY pa.fecha DESC`,
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
