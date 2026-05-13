const db = require('../config/db');

exports.crearAsistencia = (data, callback) => {

  const query = `
    INSERT INTO asistencias
    (evento_id, persona_id, estado, minutos_atraso)
    VALUES (?, ?, ?, ?)
  `;

  db.query(
    query,
    [
      data.evento_id,
      data.persona_id,
      data.estado,
      data.minutos
    ],
    callback
  );

};

exports.obtenerAsistencias = (callback) => {

  const query = `
    SELECT
      a.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      e.nombre AS evento,
      a.estado,
      a.minutos_atraso
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    JOIN eventos e ON a.evento_id = e.id
    ORDER BY a.id DESC
  `;

  db.query(query, callback);

};