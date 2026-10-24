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
      AND COALESCE(es_honorario, 0) = 0

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

// Saldo de una cuota = monto − lo abonado (pago_detalle). Una cuota con abonos
// sigue pendiente/vencida hasta que el saldo llega a 0.
exports.obtenerCuotasPendientesPorPersona = (persona_id, callback) => {
  db.query(
    `SELECT c.id,c.mes,c.anio,c.monto,c.fecha_vencimiento,c.estado,
            COALESCE(SUM(d.monto_pagado),0) AS monto_pagado,
            GREATEST(c.monto-COALESCE(SUM(d.monto_pagado),0),0) AS saldo
     FROM cuotas c
     LEFT JOIN pago_detalle d ON d.tipo='cuota' AND d.referencia_id=c.id
     WHERE c.persona_id=? AND c.estado IN ('pendiente','vencido')
     GROUP BY c.id,c.mes,c.anio,c.monto,c.fecha_vencimiento,c.estado
     HAVING saldo>0
     ORDER BY c.anio ASC,c.mes ASC`,
    [persona_id],
    callback
  );
};

// Verifica en la BD el saldo real de las cuotas antes de registrar un pago, sin
// confiar en lo que envía el cliente.
exports.obtenerCuotasConSaldoPorIds = (ids, callback) => {
  if (!Array.isArray(ids) || ids.length === 0) return callback(null, []);
  db.query(
    `SELECT c.id,c.persona_id,c.mes,c.anio,c.monto,c.estado,
            COALESCE(SUM(d.monto_pagado),0) AS monto_pagado,
            GREATEST(c.monto-COALESCE(SUM(d.monto_pagado),0),0) AS saldo
     FROM cuotas c
     LEFT JOIN pago_detalle d ON d.tipo='cuota' AND d.referencia_id=c.id
     WHERE c.id IN (?)
     GROUP BY c.id,c.persona_id,c.mes,c.anio,c.monto,c.estado`,
    [ids],
    callback
  );
};

exports.obtenerCuotaConSaldo = (id, callback) => {
  exports.obtenerCuotasConSaldoPorIds([id], (err, rows) => callback(err, rows ? rows[0] : null));
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
      c.estado,
      COALESCE(SUM(d.monto_pagado),0) AS monto_pagado,
      GREATEST(c.monto-COALESCE(SUM(d.monto_pagado),0),0) AS saldo

    FROM cuotas c

    JOIN personas p
    ON c.persona_id = p.id

    LEFT JOIN pago_detalle d
    ON d.tipo='cuota' AND d.referencia_id=c.id

    GROUP BY c.id,c.persona_id,p.nombres,p.apellido_paterno,p.apellido_materno,
      c.monto,c.mes,c.anio,c.fecha_vencimiento,c.estado

    ORDER BY
      c.anio DESC,
      c.mes DESC,
      p.nombres ASC

  `;

  db.query(query, callback);

};
