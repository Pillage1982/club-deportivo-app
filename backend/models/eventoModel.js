// Acceso MySQL de actividades: CRUD, consulta individual y cierre administrativo.
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

    finalizado,

    inicia_temporada

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
      descripcion,
      inicia_temporada
    )

    VALUES (?, ?, ?, ?, ?, ?)

  `;

  db.query(

    query,

    [
      data.nombre,
      data.tipo,
      data.fecha,
      data.ubicacion,
      data.descripcion,
      data.inicia_temporada ? 1 : 0
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
      descripcion = ?,
      inicia_temporada = ?

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
      data.inicia_temporada ? 1 : 0,

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

exports.cerrarEvento = (id, callback) => {
  db.query(
    'UPDATE eventos SET finalizado = 1 WHERE id = ?',
    [id],
    callback
  );
};
