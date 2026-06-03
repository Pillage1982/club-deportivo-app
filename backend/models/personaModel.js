const db = require('../config/db');

exports.obtenerPersonas = (callback) => {

  const query = `

    SELECT

      id,

      rut,

      nombres,

      apellido_paterno,

      apellido_materno,

      email,

      telefono,

      fecha_nacimiento

    FROM personas

    WHERE activo = 1

  `;

  db.query(query, callback);

};

exports.crearPersona = (
  data,
  callback
) => {

  const query = `

    INSERT INTO personas
    (
      rut,
      nombres,
      apellido_paterno,
      apellido_materno,
      email,
      telefono,
      fecha_nacimiento
    )

    VALUES (?, ?, ?, ?, ?, ?, ?)

  `;

  db.query(

    query,

    [
      data.rut,
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.email,
      data.telefono,
      data.fecha_nacimiento || null
    ],

    callback

  );

};

exports.actualizarPersona = (
  id,
  data,
  callback
) => {

  const query = `

    UPDATE personas

    SET

      rut = ?,
      nombres = ?,
      apellido_paterno = ?,
      apellido_materno = ?,
      email = ?,
      telefono = ?,
      fecha_nacimiento = ?

    WHERE id = ?

  `;

  db.query(

    query,

    [

      data.rut,
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.email,
      data.telefono,
      data.fecha_nacimiento || null,

      id

    ],

    callback

  );

};

exports.eliminarPersona = (
  id,
  callback
) => {

  const query = `

    UPDATE personas

    SET activo = 0

    WHERE id = ?

  `;

  db.query(
    query,
    [id],
    callback
  );

};