// Acceso MySQL de actas de reunion: CRUD simple, una acta por evento (tipo reunion).
const db = require('../config/db');

exports.obtenerActas = (callback) => {
  const query = `
    SELECT
      a.id,
      a.evento_id,
      a.titulo,
      a.contenido,
      a.archivo_path,
      a.responsable,
      a.created_at,
      e.nombre AS evento_nombre,
      e.fecha AS evento_fecha
    FROM actas_reunion a
    JOIN eventos e ON a.evento_id = e.id
    ORDER BY e.fecha DESC, a.id DESC
  `;
  db.query(query, callback);
};

exports.obtenerActaPorId = (id, callback) => {
  db.query(
    'SELECT * FROM actas_reunion WHERE id = ?',
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

// Eventos tipo 'reunion' que todavia no tienen acta (para el selector del formulario)
exports.obtenerEventosReunionSinActa = (callback) => {
  const query = `
    SELECT e.id, e.nombre, e.fecha
    FROM eventos e
    LEFT JOIN actas_reunion a ON a.evento_id = e.id
    WHERE e.tipo = 'reunion' AND a.id IS NULL
    ORDER BY e.fecha DESC
  `;
  db.query(query, callback);
};

// Valida en el backend (no solo confiar en el selector del formulario) que
// el evento exista y sea de tipo 'reunion' antes de insertar la acta.
exports.obtenerEventoReunionPorId = (id, callback) => {
  db.query(
    "SELECT id FROM eventos WHERE id = ? AND tipo = 'reunion'",
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

exports.crearActa = (data, callback) => {
  const query = `
    INSERT INTO actas_reunion
    (evento_id, titulo, contenido, archivo_path, responsable)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(
    query,
    [
      data.evento_id,
      data.titulo,
      data.contenido,
      data.archivo_path || null,
      data.responsable || null
    ],
    callback
  );
};

exports.eliminarActa = (id, callback) => {
  db.query('DELETE FROM actas_reunion WHERE id = ?', [id], callback);
};
