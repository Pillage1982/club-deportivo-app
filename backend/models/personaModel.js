// Acceso MySQL de integrantes: CRUD, estados activo/receso/inactivo y datos de contacto.
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

      rut_apoderado,

      observacion,

      COALESCE(bautizo, 0) AS bautizo,

      COALESCE(comunion, 0) AS comunion,

      COALESCE(confirmacion, 0) AS confirmacion,

      COALESCE(estado, 'activo') AS estado,

      COALESCE(es_honorario, 0) AS es_honorario

    FROM personas

    WHERE activo = 1

  `;

  db.query(query, callback);

};

// Histórico de integrantes retirados (eliminación lógica). La fecha de retiro sale
// del registro de actividad: los retiros anteriores a la auditoría (oct-2026) no la tienen.
exports.obtenerRetirados = (callback) => {
  const query = `
    SELECT
      p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
      p.bloque, p.sexo, p.email, p.telefono, p.fecha_nacimiento, p.fecha_ingreso,
      p.observacion,
      COALESCE(p.es_honorario, 0) AS es_honorario,
      (
        SELECT MAX(au.fecha)
        FROM auditoria au
        WHERE au.modulo = 'integrantes' AND au.metodo = 'DELETE' AND au.registro_id = p.id
      ) AS fecha_retiro
    FROM personas p
    WHERE p.activo = 0 OR p.estado = 'inactivo'
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
      rut_apoderado,
      observacion,
      bautizo,
      comunion,
      confirmacion,
      estado,
      es_honorario
    )

    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

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
      data.rut_apoderado || null,
      data.observacion || null,
      data.bautizo ? 1 : 0,
      data.comunion ? 1 : 0,
      data.confirmacion ? 1 : 0,
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
      rut_apoderado = ?,
      observacion = ?,
      bautizo = ?,
      comunion = ?,
      confirmacion = ?,
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
      data.rut_apoderado || null,
      data.observacion || null,
      data.bautizo ? 1 : 0,
      data.comunion ? 1 : 0,
      data.confirmacion ? 1 : 0,
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
      rut_apoderado = ?,
      observacion = ?,
      bautizo = ?,
      comunion = ?,
      confirmacion = ?,
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
      data.rut_apoderado || null,
      data.observacion || null,
      data.bautizo ? 1 : 0,
      data.comunion ? 1 : 0,
      data.confirmacion ? 1 : 0,
      data.estado || 'activo',
      data.es_honorario ? 1 : 0,

      id

    ],

    callback

  );

};

// Reintegro de un retirado: solo vuelve a activo; el resto de la ficha (datos,
// cuotas, pagos, asistencias, puntaje) queda tal como estaba al retirarse.
exports.reintegrarPersona = (id, callback) => {
  db.query(
    `UPDATE personas
     SET activo = 1, estado = 'activo'
     WHERE id = ? AND (activo = 0 OR estado = 'inactivo')`,
    [id],
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
