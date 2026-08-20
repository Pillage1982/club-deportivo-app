// Acceso MySQL de cuotas: consultas de mensualidades, generación masiva, estados y vínculos con pagos.
// Acceso MySQL de cuotas: consultas de mensualidades, generación masiva, estados y vínculos con pagos.
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

// Un solo INSERT SELECT reemplaza N inserts individuales (uno por socio).
// Art. 2.1.B Estatutos GDC 2016: bailarines de 0 a 11 años, 11 meses y 29 días
// cancelan el 50% del valor de la cuota de adulto. La edad se calcula a la
// fecha de vencimiento de cada cuota (no a la fecha en que se genera), para
// que el cambio de tramo ocurra el mes del cumpleaños número 12.
exports.generarMensualidadMasiva = (data, callback) => {
  const query = `
    INSERT IGNORE INTO cuotas
      (persona_id, tipo_cuota_id, monto, mes, anio, fecha_vencimiento, estado, origen)
    SELECT id, ?,
      CASE
        WHEN fecha_nacimiento IS NOT NULL AND TIMESTAMPDIFF(YEAR, fecha_nacimiento, ?) < 12
        THEN ROUND(? / 2)
        ELSE ?
      END,
      ?, ?, ?, 'pendiente', 'interno'
    FROM personas
    WHERE activo = 1
      AND COALESCE(estado, 'activo') = 'activo'
      AND COALESCE(es_honorario, 0) = 0
  `;
  db.query(query, [
    data.tipo_cuota_id,
    data.fecha_vencimiento,
    data.monto,
    data.monto,
    data.mes,
    data.anio,
    data.fecha_vencimiento
  ], callback);
};

// =====================================
// OBTENER CUOTAS PENDIENTES POR PERSONA
// =====================================

exports.obtenerCuotasPendientesPorPersona = (persona_id, callback) => {
  db.query(
    `SELECT c.id,c.mes,c.anio,c.monto,c.fecha_vencimiento,c.estado,
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

// Usado por el pago anual: verifica saldo real de varias cuotas a la vez antes de
// marcarlas pagadas, para no confiar en lo que envía el cliente.
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
  db.query(
    `SELECT c.id,c.persona_id,c.mes,c.anio,c.monto,c.estado,
            COALESCE(SUM(d.monto_pagado),0) AS monto_pagado,
            GREATEST(c.monto-COALESCE(SUM(d.monto_pagado),0),0) AS saldo
     FROM cuotas c
     LEFT JOIN pago_detalle d ON d.tipo='cuota' AND d.referencia_id=c.id
     WHERE c.id=?
     GROUP BY c.id,c.persona_id,c.mes,c.anio,c.monto,c.estado`,
    [id],
    (err, rows) => callback(err, rows ? rows[0] : null)
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
