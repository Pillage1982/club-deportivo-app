// Acceso MySQL de los comprobantes de depósito que los socios envían a tesorería
// desde el Portal del Integrante (pestaña Documentos).
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

exports.crear = data =>
  ejecutar(`
    INSERT INTO comprobantes_deposito (persona_id, monto, fecha_deposito, concepto, adjunto_path)
    VALUES (?, ?, ?, ?, ?)
  `, [data.persona_id, data.monto, data.fecha_deposito, data.concepto, data.adjunto_path])
    .then(result => result.insertId);

// Busca un comprobante ya registrado por hash del archivo O por banco + nº de
// transacción (cubre capturas distintas o imágenes recomprimidas por WhatsApp).
// Las filas históricas tienen hash/numero NULL, así que nunca igualan a un valor real.
exports.buscarDuplicado = (hash, banco, numero) =>
  ejecutar(`
    SELECT cd.id, cd.persona_id, cd.monto_total, cd.fecha_deposito, cd.creado_en,
           p.nombres, p.apellido_paterno, p.apellido_materno,
           COALESCE((SELECT SUM(a.monto_asignado) FROM comprobante_asignaciones a
                     WHERE a.comprobante_id = cd.id), 0) AS asignado
    FROM comprobantes_deposito cd
    JOIN personas p ON p.id = cd.persona_id
    WHERE cd.hash_archivo = ?
       OR (cd.banco = ? AND cd.numero_transaccion = ?)
    ORDER BY cd.id
    LIMIT 1
  `, [hash, banco, numero]).then(rows => rows[0] || null);

// Crea el comprobante y todas sus asignaciones en una sola transacción.
// asignaciones: [{ integrante_id, monto_asignado, estado }].
// Si choca un UNIQUE (duplicado por carrera o mismo integrante repetido) revierte
// todo y rechaza con ese error (code 'ER_DUP_ENTRY'). El legacy 'monto' se guarda
// igual al total para no romper nada que lo siga leyendo.
exports.crearConReparto = (comprobante, asignaciones) =>
  new Promise((resolve, reject) => {
    db.getConnection((err, conexion) => {
      if (err) return reject(err);
      const liberar = () => conexion.release();
      const cerrar = e => (e && e.fatal) ? conexion.destroy() : liberar();
      const fallar = e => conexion.rollback(() => { cerrar(e); reject(e); });

      conexion.beginTransaction(errTx => {
        if (errTx) { cerrar(errTx); return reject(errTx); }

        conexion.query(
          `INSERT INTO comprobantes_deposito
             (persona_id, banco, numero_transaccion, monto, monto_total,
              fecha_deposito, concepto, adjunto_path, hash_archivo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [comprobante.persona_id, comprobante.banco, comprobante.numero_transaccion,
           comprobante.monto_total, comprobante.monto_total, comprobante.fecha_deposito,
           comprobante.concepto, comprobante.adjunto_path, comprobante.hash_archivo],
          (errC, resC) => {
            if (errC) return fallar(errC);
            const comprobanteId = resC.insertId;

            const insertar = i => {
              if (i === asignaciones.length) {
                return conexion.commit(errCommit => {
                  if (errCommit) return fallar(errCommit);
                  liberar();
                  resolve({ comprobanteId });
                });
              }
              const a = asignaciones[i];
              conexion.query(
                `INSERT INTO comprobante_asignaciones
                   (comprobante_id, integrante_id, monto_asignado, estado)
                 VALUES (?, ?, ?, ?)`,
                [comprobanteId, a.integrante_id, a.monto_asignado, a.estado],
                errA => {
                  if (errA) return fallar(errA);
                  insertar(i + 1);
                }
              );
            };
            insertar(0);
          }
        );
      });
    });
  });

exports.obtenerFechaCreacion = id =>
  ejecutar('SELECT creado_en FROM comprobantes_deposito WHERE id = ?', [id])
    .then(rows => (rows[0] ? rows[0].creado_en : null));

exports.marcarEmail = id =>
  ejecutar('UPDATE comprobantes_deposito SET email_enviado = 1 WHERE id = ?', [id]);

// `desde` ('YYYY-MM-DD'): el portal lista solo la temporada vigente.
exports.listarSocio = (personaId, desde) =>
  ejecutar(`
    SELECT id, monto, fecha_deposito, concepto, email_enviado, creado_en, pago_id
    FROM comprobantes_deposito
    WHERE persona_id = ? AND (fecha_deposito >= ? OR creado_en >= ?)
    ORDER BY creado_en DESC
    LIMIT 50
  `, [personaId, desde, desde]);

// =====================================
// PANEL (tesorería): usar el comprobante como respaldo de un pago
// =====================================

// Todos los comprobantes enviados; pendientes (sin pago) primero.
exports.listarPanel = () =>
  ejecutar(`
    SELECT cd.id, cd.persona_id, cd.monto, cd.fecha_deposito, cd.concepto,
           cd.creado_en, cd.pago_id,
           p.nombres, p.apellido_paterno, p.apellido_materno,
           (SELECT COUNT(*) FROM comprobante_asignaciones a
              WHERE a.comprobante_id = cd.id) AS total_asignaciones,
           (SELECT COUNT(*) FROM comprobante_asignaciones a
              WHERE a.comprobante_id = cd.id AND a.estado = 'pendiente_revision') AS en_revision,
           (SELECT COUNT(*) FROM comprobante_asignaciones a
              WHERE a.comprobante_id = cd.id AND a.pago_id IS NULL
                AND a.estado IN ('automatica','aprobada')) AS por_confirmar
    FROM comprobantes_deposito cd
    JOIN personas p ON p.id = cd.persona_id
    ORDER BY (cd.pago_id IS NULL) DESC, cd.creado_en DESC
  `);

exports.listarPendientesPersona = personaId =>
  ejecutar(`
    SELECT id, monto, fecha_deposito, concepto, creado_en
    FROM comprobantes_deposito
    WHERE persona_id = ? AND pago_id IS NULL
    ORDER BY creado_en DESC
  `, [personaId]);

exports.obtenerPorId = id =>
  ejecutar('SELECT id, persona_id, adjunto_path, pago_id, concepto, monto_total FROM comprobantes_deposito WHERE id = ?', [id])
    .then(rows => rows[0] || null);

// Solo vincula si sigue pendiente: evita que dos pagos usen el mismo comprobante.
exports.vincularPago = (id, pagoId) =>
  ejecutar('UPDATE comprobantes_deposito SET pago_id = ? WHERE id = ? AND pago_id IS NULL', [pagoId, id])
    .then(result => result.affectedRows > 0);

// Al eliminar el pago o cambiarle el comprobante, el depósito vuelve a pendiente.
exports.desvincularPago = pagoId =>
  ejecutar('UPDATE comprobantes_deposito SET pago_id = NULL WHERE pago_id = ?', [pagoId]);
