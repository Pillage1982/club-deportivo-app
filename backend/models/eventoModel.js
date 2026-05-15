const db = require('../config/db');

exports.obtenerEventos = (callback) => {
  const query = `

  SELECT

    id,

    nombre,

    tipo,

    fecha,

    ubicacion,

    descripcion

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