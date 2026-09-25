const db = require('../config/db');

exports.obtenerEventos = (callback) => {
  const query = `

  SELECT

    id,

    nombre,

    tipo,

    fecha,

    ubicacion,

    descripcion,

    finalizado

  FROM eventos

  ORDER BY fecha DESC

`;

  db.query(query, callback);
};

exports.crearEvento = (
  data,
  callback
) => {

  const query = `

    INSERT INTO eventos
    (
      nombre,
      tipo,
      fecha,
      ubicacion,
      descripcion
    )

    VALUES (?, ?, ?, ?, ?)

  `;

  db.query(

    query,

    [
      data.nombre,
      data.tipo,
      data.fecha,
      data.ubicacion,
      data.descripcion
    ],

    callback

  );

};

exports.actualizarEvento = (
  id,
  data,
  callback
) => {

  const query = `

    UPDATE eventos

    SET

      nombre = ?,
      tipo = ?,
      fecha = ?,
      ubicacion = ?,
      descripcion = ?

    WHERE id = ?

  `;

  db.query(

    query,

    [

      data.nombre,
      data.tipo,
      data.fecha,
      data.ubicacion,
      data.descripcion,

      id

    ],

    callback

  );

};

exports.eliminarEvento = (
  id,
  callback
) => {

  const query = `
    DELETE FROM eventos
    WHERE id = ?
  `;

  db.query(
    query,
    [id],
    callback
  );

};

exports.obtenerEventoPorId = (id, callback) => {
  db.query(
    'SELECT * FROM eventos WHERE id = ?',
    [id],
    (err, rows) => {
      if (err) return callback(err);
      callback(null, rows[0] || null);
    }
  );
};

// WHERE finalizado = 0: hace el cierre atómico. Si dos peticiones llegan casi
// simultáneas (doble clic), solo una obtiene affectedRows=1 y avanza a generar
// ausentes/multas/email; la otra ve 0 filas afectadas y sabe que perdió la carrera.
exports.cerrarEvento = (id, callback) => {
  db.query(
    'UPDATE eventos SET finalizado = 1 WHERE id = ? AND finalizado = 0',
    [id],
    callback
  );
};