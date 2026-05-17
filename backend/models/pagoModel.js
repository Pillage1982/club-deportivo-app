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

// =========================
// ACTUALIZAR PAGO
// =========================

exports.actualizarPago = (

  id,

  data,

  callback

) => {

  const query = `

    UPDATE pagos

    SET

      persona_id = ?,
      monto_total = ?,
      metodo = ?

    WHERE id = ?

  `;

  db.query(

    query,

    [

      data.persona_id,
      data.monto_total,
      data.metodo,

      id

    ],

    callback

  );

};

// =========================
// ELIMINAR PAGO
// =========================

exports.eliminarPago = (

  id,

  callback

) => {

  const query = `

    DELETE FROM pagos

    WHERE id = ?

  `;

  db.query(

    query,

    [id],

    callback

  );

};