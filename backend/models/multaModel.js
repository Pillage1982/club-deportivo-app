const db = require('../config/db');

exports.crearMultaAsistencia = (data, callback) => {
  db.query(
    `INSERT INTO multas (persona_id, asistencia_id, monto, motivo, estado)
     VALUES (?, ?, ?, ?, 'pendiente')`,
    [data.persona_id, data.asistencia_id, data.monto, data.motivo],
    callback
  );
};

exports.crearMultasAusentes = (evento_id, callback) => {
  const query = `
    INSERT INTO multas (persona_id, asistencia_id, monto, motivo, estado)
    SELECT a.persona_id, a.id, 5000, 'Inasistencia a actividad', 'pendiente'
    FROM asistencias a
    WHERE
      a.evento_id = ?
      AND a.estado = 'ausente'
      AND a.id NOT IN (
        SELECT asistencia_id FROM multas WHERE asistencia_id IS NOT NULL
      )
  `;

  db.query(query, [evento_id], callback);
};

exports.obtenerMultas = (callback) => {

  const query = `
    SELECT
      m.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      m.monto,
      m.motivo,
      m.fecha
    FROM multas m
    JOIN personas p ON m.persona_id = p.id
    ORDER BY m.fecha DESC
  `;

  db.query(query, callback);

};