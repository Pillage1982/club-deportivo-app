// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db =
  require('../config/db');

// =====================================
// INSERTAR PAGO EN BASE DATOS
// =====================================

exports.crearPago = (
  data,
  callback
) => {

  // Registra pago asociado a socio
  const query = `

    INSERT INTO pagos
    (
      persona_id,
      monto_total,
      metodo
    )

    VALUES (?, ?, ?)

  `;

  // Ejecuta inserción MySQL
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

// =====================================
// OBTENER HISTORIAL PAGOS
// =====================================

exports.obtenerPagos = (
  callback
) => {

  // Consulta relacional:
  // pagos + personas
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
    // Relaciona pago con socio
    JOIN personas p
    ON pa.persona_id = p.id
    // Muestra pagos recientes primero
    ORDER BY pa.fecha DESC

  `;

  db.query(
    query,
    callback
  );

};

// =====================================
// ACTUALIZAR REGISTRO PAGO
// =====================================

exports.actualizarPago = (

  id,

  data,

  callback

) => {

  // Actualiza datos financieros pago
  const query = `

    UPDATE pagos

    SET

      persona_id = ?,
      monto_total = ?,
      metodo = ?

    WHERE id = ?

  `;

  // Ejecuta actualización MySQL
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

// =====================================
// ELIMINAR REGISTRO PAGO
// =====================================

exports.eliminarPago = (

  id,

  callback

) => {

  // Elimina pago desde sistema
  const query = `

    DELETE FROM pagos

    WHERE id = ?

  `;

  // Ejecuta eliminación MySQL
  db.query(

    query,

    [id],

    callback

  );

};