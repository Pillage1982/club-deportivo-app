// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db =
  require('../config/db');

// =====================================
// OBTENER HISTORIAL PAGOS
// =====================================

exports.obtenerPagos = (
  callback
) => {

  // Consulta relacional:
  // pagos + personas
  // Relaciona pago con socio
  // Muestra pagos recientes primero
  const query = `

    SELECT

      pa.id,
      pa.persona_id,

      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,

      pa.monto_total,
      pa.metodo,
      pa.fecha,
      pa.tipo_pago,
      pa.detalle,
      pa.comprobante_path,
      EXISTS(SELECT 1 FROM pago_detalle d WHERE d.pago_id=pa.id) AS tiene_detalle

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

// =====================================
// REGISTRAR PAGO + VÍNCULOS A CUOTAS (TRANSACCIONAL)
// =====================================
// Inserta el pago y, si corresponde, sus filas de pago_detalle y el cambio de
// estado de cada cuota, todo dentro de una misma transacción. Si algún paso
// falla se revierte todo: evita que una cuota quede marcada "pagado" sin su
// pago_detalle (o viceversa) cuando un pago cubre varias cuotas y una falla
// a mitad de camino.
// detalles: [{ cuotaId, monto, marcarPagada }]
exports.crearPagoConDetalles = (data, detalles, callback) => {
  db.getConnection((err, conexion) => {
    if (err) return callback(err);

    const liberar = () => conexion.release();
    // Una conexión fatal (ECONNRESET, PROTOCOL_CONNECTION_LOST) no debe volver
    // al pool con release() como si estuviera sana — se destruye, igual que
    // hace config/db.js en su propio retry de conexiones fatales.
    const cerrar = errFinal => (errFinal && errFinal.fatal) ? conexion.destroy() : liberar();
    const fallar = errFinal => conexion.rollback(() => { cerrar(errFinal); callback(errFinal); });

    conexion.beginTransaction(errTx => {
      if (errTx) { cerrar(errTx); return callback(errTx); }

      conexion.query(
        'INSERT INTO pagos (persona_id, monto_total, metodo, tipo_pago, detalle, comprobante_path) VALUES (?, ?, ?, ?, ?, ?)',
        [data.persona_id, data.monto_total, data.metodo, data.tipo_pago || 'cuota', data.detalle || null, data.comprobante_path || null],
        (errPago, resultPago) => {
          if (errPago) return fallar(errPago);
          const pagoId = resultPago.insertId;

          const finalizar = () => conexion.commit(errCommit => {
            if (errCommit) return fallar(errCommit);
            liberar();
            callback(null, { pagoId });
          });

          const procesarDetalle = index => {
            if (index === detalles.length) return finalizar();
            const { cuotaId, monto, marcarPagada } = detalles[index];

            conexion.query(
              "INSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado) VALUES (?,'cuota',?,?)",
              [pagoId, cuotaId, monto],
              errDetalle => {
                if (errDetalle) return fallar(errDetalle);
                if (!marcarPagada) return procesarDetalle(index + 1);

                conexion.query(
                  "UPDATE cuotas SET estado='pagado' WHERE id=? AND estado IN ('pendiente','vencido')",
                  [cuotaId],
                  errMarcar => {
                    if (errMarcar) return fallar(errMarcar);
                    procesarDetalle(index + 1);
                  }
                );
              }
            );
          };

          procesarDetalle(0);
        }
      );
    });
  });
};

exports.obtenerPagoBasico = (id, callback) => {
  db.query('SELECT id, persona_id, comprobante_path FROM pagos WHERE id = ?', [id],
    (err, rows) => callback(err, rows && rows[0] ? rows[0] : null));
};

exports.obtenerComprobantePath = (id, callback) => {
  db.query('SELECT comprobante_path FROM pagos WHERE id = ?', [id],
    (err, rows) => callback(err, rows && rows[0] ? rows[0].comprobante_path : null));
};

exports.actualizarComprobante = (id, comprobantePath, callback) => {
  db.query('UPDATE pagos SET comprobante_path = ? WHERE id = ?', [comprobantePath, id], callback);
};

exports.tieneDetalles = (id, callback) => {
  db.query('SELECT EXISTS(SELECT 1 FROM pago_detalle WHERE pago_id=?) AS tiene', [id],
    (err, rows) => callback(err, rows ? Boolean(rows[0].tiene) : false));
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
      metodo = ?,
      tipo_pago = ?,
      detalle = ?,
      comprobante_path = COALESCE(?, comprobante_path)

    WHERE id = ?

  `;

  // Ejecuta actualización MySQL
  db.query(

    query,

    [

      data.persona_id,
      data.monto_total,
      data.metodo,
      data.tipo_pago || 'cuota',
      data.detalle || null,
      data.comprobante_path || null,

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
