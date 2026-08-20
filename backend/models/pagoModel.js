// Acceso MySQL de pagos: registra, lista y elimina movimientos financieros de integrantes.
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
  // Relaciona pago con socio
  // Muestra pagos recientes primero
  const query = `

    SELECT

      pa.id,

      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,

      pa.monto_total,
      pa.metodo,
      pa.fecha,
      COALESCE(pa.fecha_precision, 'exacta') AS fecha_precision,
      pa.referencia_externa,
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

exports.crearDetalleCuota = (pagoId, cuotaId, monto, callback) => {
  db.query(
    "INSERT INTO pago_detalle (pago_id,tipo,referencia_id,monto_pagado) VALUES (?,'cuota',?,?)",
    [pagoId, cuotaId, monto],
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
    const fallar = errFinal => conexion.rollback(() => { liberar(); callback(errFinal); });

    conexion.beginTransaction(errTx => {
      if (errTx) { liberar(); return callback(errTx); }

      conexion.query(
        'INSERT INTO pagos (persona_id, monto_total, metodo) VALUES (?, ?, ?)',
        [data.persona_id, data.monto_total, data.metodo],
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

// Suma pagada a cuotas agrupada por el mes REAL en que se hizo el pago (pa.fecha),
// no por el mes de la cuota que cubre. Un pago anticipado que cubre varias cuotas
// queda concentrado en un solo mes, en vez de repartido entre los meses cubiertos.
exports.obtenerPagosCuotaPorMesReal = callback => {
  const query = `
    SELECT
      pg.persona_id,
      YEAR(pg.fecha)  AS anio,
      MONTH(pg.fecha) AS mes,
      SUM(pd.monto_pagado) AS monto
    FROM pago_detalle pd
    JOIN pagos pg ON pg.id = pd.pago_id
    WHERE pd.tipo = 'cuota'
    GROUP BY pg.persona_id, YEAR(pg.fecha), MONTH(pg.fecha)
  `;
  db.query(query, callback);
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
