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

    WHERE activo = 1

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