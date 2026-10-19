// Acceso MySQL de actividades: CRUD, consulta individual y cierre administrativo.
const db = require('../config/db');

// Minutos de tolerancia de atraso; vacío = usar el valor global del panel.
function toleranciaONull(valor) {
  if (valor === undefined || valor === null || valor === '') return null;
  return Number(valor);
}

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

    inicia_temporada,

    tolerancia_minutos

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
      inicia_temporada,
      tolerancia_minutos
    )

    VALUES (?, ?, ?, ?, ?, ?, ?)

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
      toleranciaONull(data.tolerancia_minutos)
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
      inicia_temporada = ?,
      tolerancia_minutos = ?

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
      toleranciaONull(data.tolerancia_minutos),

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

// Próximas actividades para el sitio público gdcayquina.cl: solo campos que pueden
// mostrarse sin sesión (sin descripción ni datos internos). La sesión MySQL está en
// hora de Chile (ver config/db.js), así que CURDATE() es el día local.
exports.obtenerProximosPublicos = (limite, callback) => {
  const query = `
    SELECT nombre, tipo, fecha, ubicacion
    FROM eventos
    WHERE fecha >= CURDATE()
      AND finalizado = 0
    ORDER BY fecha ASC
    LIMIT ?
  `;

  db.query(query, [limite], callback);
};
