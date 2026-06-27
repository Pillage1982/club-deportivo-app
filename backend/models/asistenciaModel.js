// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db = require('../config/db');

// =====================================
// INSERTAR REGISTRO ASISTENCIA
// =====================================

exports.crearAsistencia = (data, callback) => {

  // Registra asistencia evento
  // incluyendo estado y atraso
  const query = `
    INSERT INTO asistencias (
      evento_id,
      persona_id,
      estado,
      minutos_atraso
    )

    SELECT
      ?,
      p.id,
      ?,
      ?

    FROM personas p

    WHERE
      p.id = ?
      AND
      p.activo = 1
      AND
      COALESCE(p.estado, 'activo') = 'activo'
  `;

  // Ejecuta inserción MySQL
  db.query(
    query,
    [
      data.evento_id,
      data.estado,
      // Minutos solo aplican
      // cuando estado es atrasado
      data.minutos,
      data.persona_id
    ],
    callback
  );

};

// =====================================
// REGISTRAR AUSENTES AL CERRAR EVENTO
// =====================================

exports.registrarAusentesEvento = (evento_id, callback) => {

  const query = `
    INSERT INTO asistencias (evento_id, persona_id, estado, minutos_atraso)
    SELECT ?, p.id, 'ausente', 0
    FROM personas p
    WHERE
      p.activo = 1
      AND COALESCE(p.estado, 'activo') = 'activo'
      AND p.id NOT IN (
        SELECT persona_id FROM asistencias WHERE evento_id = ?
      )
  `;

  db.query(query, [evento_id, evento_id], callback);

};

// =====================================
// OBTENER HISTORIAL ASISTENCIAS
// =====================================

exports.obtenerAsistencias = (callback) => {

  // Consulta relacional:
  // asistencias + personas + eventos
  // Relaciona asistencia con persona
  // Relaciona asistencia con evento
  // Muestra asistencias recientes primero
  const query = `
    SELECT
      a.id,
      a.persona_id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.bloque,
      e.nombre AS evento,
      e.tipo AS tipo_evento,
      e.fecha AS fecha_evento,
      a.estado,
      a.minutos_atraso
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    JOIN eventos e ON a.evento_id = e.id
    ORDER BY a.id DESC
  `;

  db.query(query, callback);

};
