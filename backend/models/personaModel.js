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

      COALESCE(estado, 'activo') AS estado

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
      bloque,
      sexo,
      direccion,
      email,
      telefono,
      fecha_nacimiento,
      fecha_ingreso,
      nombre_apoderado,
      telefono_apoderado,
      estado
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
      data.estado || 'activo'
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
      estado = ?

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
