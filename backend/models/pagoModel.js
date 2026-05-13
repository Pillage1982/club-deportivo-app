const db =
  require('../config/db');

// =========================
// CREAR PAGO
// =========================

exports.crearPago = (
  data,
  callback
) => {

  const query = `

    INSERT INTO pagos
    (
      persona_id,
      monto_total,
      metodo
    )

    VALUES (?, ?, ?)

  `;

  db.query(

    query,

    [
      data.persona_id,
      data.monto_total,
      data.metodo
    ],

    callback

  );

};

// =========================
// OBTENER PAGOS
// =========================

exports.obtenerPagos = (
  callback
) => {

  const query = `

    SELECT

      pa.id,

      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,

      pa.monto_total,
      pa.metodo,
      pa.fecha

    FROM pagos pa

    JOIN personas p
    ON pa.persona_id = p.id

    ORDER BY pa.fecha DESC

  `;

  db.query(
    query,
    callback
  );

};