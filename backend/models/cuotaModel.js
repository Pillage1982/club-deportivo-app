const db = require('../config/db');

// =====================================
// OBTENER TIPO CUOTA MENSUALIDAD
// =====================================

exports.obtenerTipoMensualidad = (callback) => {

  const query = `

    SELECT
      id,
      monto_base

    FROM tipos_cuotas

    WHERE nombre = 'Mensualidad'

    LIMIT 1

  `;

  db.query(query, callback);

};

// =====================================
// OBTENER SOCIOS ACTIVOS
// =====================================

exports.obtenerSociosActivos = (callback) => {

  const query = `

    SELECT
      id,
      nombres,
      apellido_paterno

    FROM personas

    WHERE
      activo = 1
      AND COALESCE(estado, 'activo') = 'activo'

  `;

  db.query(query, callback);

};

// =====================================
// CREAR CUOTA MENSUAL
// =====================================

exports.crearCuotaMensual = (
  data,
  callback
) => {

  const query = `

    INSERT IGNORE INTO cuotas
    (
      persona_id,
      tipo_cuota_id,
      monto,
      mes,
      anio,
      fecha_vencimiento,
      estado,
      origen
    )

    VALUES (?, ?, ?, ?, ?, ?, 'pendiente', 'interno')

  `;

  db.query(

    query,

    [
      data.persona_id,
      data.tipo_cuota_id,
      data.monto,
      data.mes,
      data.anio,
      data.fecha_vencimiento
    ],

    callback

  );

};

// =====================================
// CUOTAS PENDIENTES POR PERSONA
// =====================================

exports.obtenerCuotasPendientesPorPersona = (persona_id, callback) => {
  db.query(
    `SELECT id, mes, anio, monto, fecha_vencimiento, estado
     FROM cuotas
     WHERE persona_id = ? AND estado IN ('pendiente', 'vencido')
     ORDER BY anio ASC, mes ASC`,
    [persona_id],
    callback
  );
};

// =====================================
// OBTENER CUOTA POR ID
// =====================================

exports.obtenerCuotaPorId = (id, callback) => {
  db.query(
    `SELECT id, persona_id, mes, anio, monto, estado FROM cuotas WHERE id = ?`,
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

// =====================================
// MARCAR CUOTA COMO PAGADA
// =====================================

exports.marcarCuotaPagada = (id, callback) => {
  db.query(
    `UPDATE cuotas SET estado = 'pagado' WHERE id = ? AND estado IN ('pendiente', 'vencido')`,
    [id],
    callback
  );
};

// =====================================
// OBTENER CUOTAS
// =====================================

exports.obtenerCuotas = (callback) => {

  const query = `

    SELECT
      c.id,
      c.persona_id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      c.monto,
      c.mes,
      c.anio,
      c.fecha_vencimiento,
      c.estado

    FROM cuotas c

    JOIN personas p
    ON c.persona_id = p.id

    ORDER BY
      c.anio DESC,
      c.mes DESC,
      p.nombres ASC

  `;

  db.query(query, callback);

};
