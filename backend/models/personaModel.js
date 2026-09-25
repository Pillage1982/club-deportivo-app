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

      fecha_nacimiento,

      fecha_ingreso,
      apoderado_nombre,
      apoderado_telefono,

      COALESCE(estado, 'activo') AS estado,
      COALESCE(es_honorario, 0) AS es_honorario

    FROM personas

    WHERE activo = 1

  `;

  db.query(query, callback);

};

exports.obtenerPersonaPorId = (id, callback) => {
  db.query(
    'SELECT id, COALESCE(es_honorario, 0) AS es_honorario FROM personas WHERE id = ? AND activo = 1 LIMIT 1',
    [id],
    (err, results) => callback(err, results ? results[0] : null)
  );
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
      fecha_nacimiento,
      fecha_ingreso,
      estado,
      es_honorario,
      apoderado_nombre,
      apoderado_telefono
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
      data.fecha_ingreso || null,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0,
      data.apoderado_nombre || null,
      data.apoderado_telefono || null
    ],

    callback

  );

};

exports.obtenerPersonaPorRutIncluyendoInactivos = (
  rut,
  callback
) => {
  const query = `

    SELECT
      id,
      rut,
      nombres,
      apellido_paterno,
      apellido_materno,
      email,
      telefono,
      fecha_nacimiento,
      activo

    FROM personas

    WHERE
      REPLACE(
        REPLACE(
          REPLACE(
            UPPER(rut),
            '.',
            ''
          ),
          '-',
          ''
        ),
        ' ',
        ''
      ) = ?

    LIMIT 1

  `;

  db.query(
    query,
    [rut],
    callback
  );
};

exports.reactivarPersona = (
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
      fecha_nacimiento = ?,
      activo = 1

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
      fecha_nacimiento = ?,
      fecha_ingreso = ?,
      estado = ?,
      es_honorario = ?,
      apoderado_nombre = ?,
      apoderado_telefono = ?

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
      data.fecha_ingreso || null,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0,
      data.apoderado_nombre || null,
      data.apoderado_telefono || null,

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

    SET
      activo = 0,
      estado = 'inactivo'

    WHERE id = ?

  `;

  db.query(
    query,
    [id],
    callback
  );

};
