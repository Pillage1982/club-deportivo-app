const db = require('../config/db');

exports.obtenerPersonas = (callback) => {

  const query = `

    SELECT

      id,

      rut,

      nombres,

      apellido_paterno,

      apellido_materno,

      bloque,

      sexo,

      direccion,

      email,

      telefono,

      fecha_nacimiento,

      fecha_ingreso,

      nombre_apoderado,

      telefono_apoderado,

      COALESCE(estado, 'activo') AS estado,

      COALESCE(es_honorario, 0) AS es_honorario

    FROM personas

    WHERE activo = 1

  `;

  db.query(query, callback);

};

exports.obtenerPersonaPorId = (id, callback) => {
  db.query(
    'SELECT id, es_honorario FROM personas WHERE id = ? AND activo = 1 LIMIT 1',
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
      bloque,
      sexo,
      direccion,
      email,
      telefono,
      fecha_nacimiento,
      fecha_ingreso,
      nombre_apoderado,
      telefono_apoderado,
      estado,
      es_honorario
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

  `;

  db.query(

    query,

    [
      data.rut,
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.bloque || null,
      data.sexo || null,
      data.direccion || null,
      data.email,
      data.telefono,
      data.fecha_nacimiento || null,
      data.fecha_ingreso || null,
      data.nombre_apoderado || null,
      data.telefono_apoderado || null,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0
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
      activo,
      COALESCE(estado, 'activo') AS estado

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
      bloque = ?,
      sexo = ?,
      direccion = ?,
      email = ?,
      telefono = ?,
      fecha_nacimiento = ?,
      fecha_ingreso = ?,
      nombre_apoderado = ?,
      telefono_apoderado = ?,
      estado = ?,
      es_honorario = ?,
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
      data.bloque || null,
      data.sexo || null,
      data.direccion || null,
      data.email,
      data.telefono,
      data.fecha_nacimiento || null,
      data.fecha_ingreso || null,
      data.nombre_apoderado || null,
      data.telefono_apoderado || null,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0,
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
      bloque = ?,
      sexo = ?,
      direccion = ?,
      email = ?,
      telefono = ?,
      fecha_nacimiento = ?,
      fecha_ingreso = ?,
      nombre_apoderado = ?,
      telefono_apoderado = ?,
      estado = ?,
      es_honorario = ?

    WHERE id = ?

  `;

  db.query(

    query,

    [

      data.rut,
      data.nombres,
      data.apellido_paterno,
      data.apellido_materno,
      data.bloque || null,
      data.sexo || null,
      data.direccion || null,
      data.email,
      data.telefono,
      data.fecha_nacimiento || null,
      data.fecha_ingreso || null,
      data.nombre_apoderado || null,
      data.telefono_apoderado || null,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0,

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
