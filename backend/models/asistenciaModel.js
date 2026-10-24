// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db = require('../config/db');

// =====================================
// INSERTAR REGISTRO ASISTENCIA
// =====================================

exports.crearAsistencia = (data, callback) => {

  // Registra asistencia evento
  // incluyendo estado y atraso.
  // fecha_registro: hora del escaneo si vino de la cola offline, si no ahora.
  const query = `
    INSERT INTO asistencias (
      evento_id,
      persona_id,
      estado,
      minutos_atraso,
      fecha_registro
    )

    SELECT
      ?,
      p.id,
      ?,
      ?,
      COALESCE(?, NOW())

    FROM personas p

    WHERE
      p.id = ?
      AND
      p.activo = 1
      AND
      COALESCE(p.estado, 'activo') = 'activo'
  `;

  // Ejecuta inserción MySQL
  db.query(
    query,
    [
      data.evento_id,
      data.estado,
      // Minutos solo aplican
      // cuando estado es atrasado
      data.minutos,
      data.fecha_registro || null,
      data.persona_id
    ],
    callback
  );

};

// Escaneo offline que llega después de cerrar la actividad: al cerrar, el
// integrante quedó como ausente. Se reemplaza ese ausente por lo escaneado.
// Nunca pisa otro estado. Devuelve el id de la asistencia o null si no había un
// ausente que reemplazar (la multa la ajusta crearMultaSiCorresponde).
exports.reemplazarAusentePorEscaneo = (data, callback) => {
  db.query(`
    UPDATE asistencias
    SET estado = ?, minutos_atraso = ?, fecha_registro = COALESCE(?, fecha_registro)
    WHERE evento_id = ? AND persona_id = ? AND estado = 'ausente'
  `, [data.estado, data.minutos, data.fecha_registro || null, data.evento_id, data.persona_id], (err, result) => {
    if (err) return callback(err);
    if (!result.affectedRows) return callback(null, null);

    db.query(
      'SELECT id FROM asistencias WHERE evento_id = ? AND persona_id = ?',
      [data.evento_id, data.persona_id],
      (errSel, rows) => callback(errSel, rows && rows[0] ? rows[0].id : null)
    );
  });
};

function calcularMulta(data) {
  if (data.estado === 'ausente') {
    return {
      monto: 5000,
      motivo: 'Inasistencia'
    };
  }

  if (data.estado !== 'atrasado') {
    return null;
  }

  const minutos =
    Number(data.minutos || 0);

  if (minutos <= 10) {
    return {
      monto: 1000,
      motivo: 'Atraso leve'
    };
  }

  if (minutos <= 20) {
    return {
      monto: 2000,
      motivo: 'Atraso medio'
    };
  }

  return {
    monto: 3000,
    motivo: 'Atraso grave'
  };
}

exports.crearMultaSiCorresponde = (
  data,
  asistenciaId,
  callback
) => {
  const multa =
    calcularMulta(data);

  if (!multa) {
    db.query(
      'DELETE FROM multas WHERE asistencia_id = ?',
      [asistenciaId],
      err => {
        if (err) {
          callback(err);
          return;
        }

        callback(null, {
          multaGenerada: false
        });
      }
    );

    return;
  }

  db.query(
    'DELETE FROM multas WHERE asistencia_id = ?',
    [asistenciaId],
    err => {
      if (err) {
        callback(err);
        return;
      }

      const query = `
        INSERT INTO multas
        (persona_id, asistencia_id, monto, motivo)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        query,
        [
          data.persona_id,
          asistenciaId,
          multa.monto,
          multa.motivo
        ],
        (errInsert, result) => {
          if (errInsert) {
            callback(errInsert);
            return;
          }

          callback(null, {
            multaGenerada: result.affectedRows > 0,
            monto: multa.monto,
            motivo: multa.motivo
          });
        }
      );
    }
  );
};

// =====================================
// REGISTRAR AUSENTES AL CERRAR EVENTO
// =====================================

exports.registrarAusentesEvento = (evento_id, callback) => {

  const query = `
    INSERT INTO asistencias (evento_id, persona_id, estado, minutos_atraso)
    SELECT ?, p.id, 'ausente', 0
    FROM personas p
    WHERE
      p.activo = 1
      AND COALESCE(p.estado, 'activo') = 'activo'
      AND p.id NOT IN (
        SELECT persona_id FROM asistencias WHERE evento_id = ?
      )
  `;

  db.query(query, [evento_id, evento_id], callback);

};

// =====================================
// OBTENER HISTORIAL ASISTENCIAS
// =====================================

exports.obtenerAsistencias = (callback) => {

  // Consulta relacional:
  // asistencias + personas + eventos
  // Relaciona asistencia con persona
  // Relaciona asistencia con evento
  // Muestra asistencias recientes primero
  const query = `
    SELECT
      a.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      e.nombre AS evento,
      e.tipo AS tipo_evento,
      e.fecha AS fecha_evento,
      a.estado,
      a.minutos_atraso
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    JOIN eventos e ON a.evento_id = e.id
    ORDER BY a.id DESC
  `;

  db.query(query, callback);

};

exports.obtenerAusentesConContacto = (evento_id, callback) => {
  const query = `
    SELECT
      p.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.email
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    WHERE
      a.evento_id = ?
      AND a.estado = 'ausente'
      AND p.email IS NOT NULL
      AND p.email != ''
  `;
  db.query(query, [evento_id], callback);
};
