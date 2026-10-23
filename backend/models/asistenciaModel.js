// Acceso MySQL de asistencias: registra, lista y consulta ausentes sin decidir respuestas HTTP.
// Acceso MySQL de asistencias: registra, lista y consulta ausentes sin decidir respuestas HTTP.
// =====================================
// CONEXION BASE DATOS MYSQL
// =====================================

const db = require('../config/db');

// =====================================
// INSERTAR REGISTRO ASISTENCIA
// =====================================

exports.crearAsistencia = (data, callback) => {

  // Registra asistencia evento
  // incluyendo estado y atraso.
  // fecha_registro: hora del escaneo si vino de la cola offline, si no ahora.
  const query = `
    INSERT INTO asistencias (
      evento_id,
      persona_id,
      estado,
      minutos_atraso,
      fecha_registro
    )

    SELECT
      ?,
      p.id,
      ?,
      ?,
      COALESCE(?, NOW())

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
      data.fecha_registro || null,
      data.persona_id
    ],
    callback
  );

};

// Escaneo offline que llega después de cerrar la actividad: al cerrar, el
// integrante quedó como ausente. Se reemplaza ese ausente por lo escaneado (y se
// borra su multa pendiente). Nunca pisa otro estado (justificado, presente...).
// Devuelve la asistencia actualizada o null si no había un ausente que reemplazar.
exports.reemplazarAusentePorEscaneo = async ({ evento_id, persona_id, estado, minutos, fecha_registro }) => {
  const result = await ejecutar(`
    UPDATE asistencias
    SET estado = ?, minutos_atraso = ?, fecha_registro = COALESCE(?, fecha_registro)
    WHERE evento_id = ? AND persona_id = ? AND estado = 'ausente'
  `, [estado, minutos, fecha_registro || null, evento_id, persona_id]);

  if (!result.affectedRows) return null;

  const [asistencia] = await ejecutar(
    'SELECT id FROM asistencias WHERE evento_id = ? AND persona_id = ?',
    [evento_id, persona_id]
  );
  await ejecutar("DELETE FROM multas WHERE asistencia_id = ? AND estado = 'pendiente'", [asistencia.id]);
  return asistencia;
};

// =====================================
// VESTIMENTA DISTINTA / RETIRO SIN AVISO (Art. 8.4)
// =====================================

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

exports.obtenerEstadoAsistencia = (evento_id, persona_id) =>
  ejecutar('SELECT estado FROM asistencias WHERE evento_id = ? AND persona_id = ?', [evento_id, persona_id])
    .then(rows => (rows[0] ? rows[0].estado : null));

exports.obtenerAsistenciaPorId = id =>
  ejecutar('SELECT id, persona_id, evento_id, estado, minutos_atraso FROM asistencias WHERE id = ?', [id])
    .then(rows => rows[0] || null);

// Solo cambia entre presente/atrasado y las marcas manuales: nunca pisa un
// ausente ni una justificación.
exports.ESTADOS_MARCABLES = ['presente', 'atrasado', 'vestimenta_distinta', 'retiro_sin_aviso'];

exports.actualizarEstadoManual = (id, estadoNuevo) =>
  ejecutar(`
    UPDATE asistencias
    SET estado = ?
    WHERE id = ? AND estado IN (?)
  `, [estadoNuevo, id, exports.ESTADOS_MARCABLES]);

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
// OBTENER AUSENTES DE UN EVENTO CON CONTACTO
// =====================================

exports.obtenerAusentesConContacto = (evento_id, callback) => {

  const query = `
    SELECT
      p.id,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.email
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    WHERE
      a.evento_id = ?
      AND a.estado = 'ausente'
      AND p.email IS NOT NULL
      AND p.email != ''
  `;

  db.query(query, [evento_id], callback);

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
      a.evento_id,
      p.rut,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.bloque,
      COALESCE(p.estado, 'activo') AS estado_persona,
      e.nombre AS evento,
      e.tipo AS tipo_evento,
      e.fecha AS fecha_evento,
      a.fecha_registro,
      a.estado,
      a.minutos_atraso,
      pt.puntos
    FROM asistencias a
    JOIN personas p ON a.persona_id = p.id
    JOIN eventos e ON a.evento_id = e.id
    LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
    ORDER BY a.id DESC
    LIMIT 5000
  `;

  db.query(query, callback);

};
