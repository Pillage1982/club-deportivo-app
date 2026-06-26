// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db = require('../config/db');

// =====================================
// INSERTAR REGISTRO ASISTENCIA
// =====================================

exports.crearAsistencia = (data, callback) => {

  // Registra asistencia evento
  // incluyendo estado y atraso
  const query = `
    INSERT INTO asistencias
    (evento_id, persona_id, estado, minutos_atraso)
    VALUES (?, ?, ?, ?)
  `;

  // Ejecuta inserción MySQL
  db.query(
    query,
    [
      data.evento_id,
      data.persona_id,
      data.estado,

      // Minutos solo aplican
      // cuando estado es atrasado
      data.minutos
    ],
    callback
  );

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
