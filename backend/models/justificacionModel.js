// Acceso MySQL de la pestaña "Documentos" del Portal del Socio: cartas de
// justificación de inasistencia y postulaciones a bloques. Lo del socio siempre
// filtra por su persona_id; la revisión (aprobar/rechazar) es solo del panel admin.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

// Art. 8.5 / 8.7: la asistencia cierra 10 minutos antes de la actividad y las
// cartas solo se reciben hasta ese cierre. NOW() está en hora de Chile (db.js),
// igual que eventos.fecha.
const MINUTOS_CIERRE_ASISTENCIA = 10;

// Actividad aún justificable para este socio: no ha cerrado la asistencia, no
// está finalizada, no tiene ya una carta pendiente/aprobada y su asistencia no
// figura como presente/atrasado (si ya la marcó, no hay nada que justificar).
const CONDICION_EVENTO_JUSTIFICABLE = `
  e.fecha > NOW() + INTERVAL ${MINUTOS_CIERRE_ASISTENCIA} MINUTE
  AND COALESCE(e.finalizado, 0) = 0
  AND NOT EXISTS (
    SELECT 1 FROM justificaciones j
    WHERE j.evento_id = e.id AND j.persona_id = ? AND j.estado IN ('pendiente', 'aprobada')
  )
  AND NOT EXISTS (
    SELECT 1 FROM asistencias a
    WHERE a.evento_id = e.id AND a.persona_id = ? AND a.estado <> 'ausente'
  )
`;

exports.MINUTOS_CIERRE_ASISTENCIA = MINUTOS_CIERRE_ASISTENCIA;

// =====================================
// SOCIO: datos para autocompletar las cartas
// =====================================
exports.obtenerDatosCarta = personaId =>
  ejecutar(`
    SELECT id, rut, nombres, apellido_paterno, apellido_materno,
           bloque, email, telefono, COALESCE(estado, 'activo') AS estado
    FROM personas
    WHERE id = ? AND activo = 1
    LIMIT 1
  `, [personaId]).then(rows => rows[0] || null);

// Próximas actividades (hasta 90 días) que todavía se pueden justificar.
exports.listarEventosJustificables = personaId =>
  ejecutar(`
    SELECT e.id, e.nombre, e.tipo, e.fecha, e.ubicacion
    FROM eventos e
    WHERE ${CONDICION_EVENTO_JUSTIFICABLE}
      AND e.fecha < NOW() + INTERVAL 90 DAY
    ORDER BY e.fecha ASC
  `, [personaId, personaId]);

// Revalida al momento de enviar: entre que el socio abrió el formulario y lo
// envió pudo cerrarse la asistencia (Art. 8.7).
exports.obtenerEventoJustificable = (personaId, eventoId) =>
  ejecutar(`
    SELECT e.id, e.nombre, e.tipo, e.fecha, e.ubicacion
    FROM eventos e
    WHERE e.id = ? AND ${CONDICION_EVENTO_JUSTIFICABLE}
    LIMIT 1
  `, [eventoId, personaId, personaId]).then(rows => rows[0] || null);

exports.crearJustificacion = data =>
  ejecutar(`
    INSERT INTO justificaciones
      (persona_id, evento_id, referencia, referencia_otro, fecha_actividad,
       tipo_solicitado, condicion, motivo, quien_entrega, adjunto_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.persona_id, data.evento_id, data.referencia, data.referencia_otro,
    data.fecha_actividad, data.tipo_solicitado, data.condicion, data.motivo,
    data.quien_entrega, data.adjunto_path
  ]).then(result => result.insertId);

exports.obtenerFechaCreacion = id =>
  ejecutar('SELECT creado_en FROM justificaciones WHERE id = ?', [id])
    .then(rows => (rows[0] ? rows[0].creado_en : null));

exports.marcarEmailJustificacion = id =>
  ejecutar('UPDATE justificaciones SET email_enviado = 1 WHERE id = ?', [id]);

exports.listarJustificacionesSocio = personaId =>
  ejecutar(`
    SELECT j.id, j.referencia, j.referencia_otro, j.fecha_actividad,
           j.tipo_solicitado, j.estado, j.estado_aplicado, j.observacion_directiva,
           j.revisado_en, j.creado_en, (j.adjunto_path IS NOT NULL) AS tiene_adjunto,
           e.nombre AS evento, e.fecha AS fecha_evento
    FROM justificaciones j
    LEFT JOIN eventos e ON e.id = j.evento_id
    WHERE j.persona_id = ?
    ORDER BY j.creado_en DESC
    LIMIT 100
  `, [personaId]);

// =====================================
// SOCIO: postulación a bloques
// =====================================
exports.listarBloques = () =>
  ejecutar(`
    SELECT DISTINCT TRIM(bloque) AS bloque
    FROM personas
    WHERE activo = 1 AND bloque IS NOT NULL AND TRIM(bloque) <> ''
    ORDER BY bloque
  `).then(rows => rows.map(r => r.bloque));

exports.crearPostulacion = data =>
  ejecutar(`
    INSERT INTO postulaciones_bloque
      (persona_id, bloque_actual, es_nuevo, opcion_1, opcion_2, celular, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    data.persona_id, data.bloque_actual, data.es_nuevo ? 1 : 0,
    data.opcion_1, data.opcion_2, data.celular, data.email
  ]).then(result => result.insertId);

exports.obtenerFechaCreacionPostulacion = id =>
  ejecutar('SELECT creado_en FROM postulaciones_bloque WHERE id = ?', [id])
    .then(rows => (rows[0] ? rows[0].creado_en : null));

exports.marcarEmailPostulacion = id =>
  ejecutar('UPDATE postulaciones_bloque SET email_enviado = 1 WHERE id = ?', [id]);

exports.listarPostulacionesSocio = personaId =>
  ejecutar(`
    SELECT id, bloque_actual, es_nuevo, opcion_1, opcion_2, creado_en
    FROM postulaciones_bloque
    WHERE persona_id = ?
    ORDER BY creado_en DESC
    LIMIT 50
  `, [personaId]);

// =====================================
// ADMIN: revisión de justificaciones
// =====================================
exports.listarJustificaciones = estado => {
  const filtro = estado ? 'WHERE j.estado = ?' : '';
  return ejecutar(`
    SELECT j.id, j.persona_id, j.evento_id, j.referencia, j.referencia_otro,
           j.fecha_actividad, j.tipo_solicitado, j.condicion, j.motivo,
           j.quien_entrega, (j.adjunto_path IS NOT NULL) AS tiene_adjunto,
           j.estado, j.estado_aplicado, j.observacion_directiva,
           j.revisado_en, j.email_enviado, j.creado_en,
           p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque,
           e.nombre AS evento, e.fecha AS fecha_evento,
           u.usuario AS revisado_por_usuario
    FROM justificaciones j
    JOIN personas p ON p.id = j.persona_id
    LEFT JOIN eventos e ON e.id = j.evento_id
    LEFT JOIN usuarios u ON u.id = j.revisado_por
    ${filtro}
    ORDER BY (j.estado = 'pendiente') DESC, j.creado_en DESC
    LIMIT 500
  `, estado ? [estado] : []);
};

exports.obtenerJustificacion = id =>
  ejecutar(`
    SELECT j.*, p.nombres, p.apellido_paterno, p.apellido_materno, p.email,
           e.nombre AS evento, e.fecha AS fecha_evento
    FROM justificaciones j
    JOIN personas p ON p.id = j.persona_id
    LEFT JOIN eventos e ON e.id = j.evento_id
    WHERE j.id = ?
    LIMIT 1
  `, [id]).then(rows => rows[0] || null);

// Aprobar: en una transacción marca la carta y deja la asistencia del evento en
// justificado/licencia_medica (la crea si aún no existe, p. ej. el evento no se
// ha cerrado) y elimina la multa pendiente de esa asistencia. Nunca pisa una
// asistencia presente/atrasado/etc.: solo reemplaza ausente o una justificación
// anterior. El puntaje se recalcula después, fuera de la transacción (controller).
exports.aprobarJustificacion = ({ id, estadoAplicado, observacion, usuarioId }) =>
  new Promise((resolve, reject) => {
    db.getConnection(async (errConn, conexion) => {
      if (errConn) return reject(errConn);
      const conn = conexion.promise();

      try {
        await conn.beginTransaction();

        const [filas] = await conn.query(
          'SELECT id, persona_id, evento_id, estado FROM justificaciones WHERE id = ? FOR UPDATE',
          [id]
        );
        const justificacion = filas[0];

        if (!justificacion) {
          await conn.rollback();
          return resolve({ resultado: 'no_encontrada' });
        }
        if (justificacion.estado !== 'pendiente') {
          await conn.rollback();
          return resolve({ resultado: 'ya_revisada' });
        }

        let asistencia = null;

        if (justificacion.evento_id) {
          await conn.query(`
            INSERT INTO asistencias (evento_id, persona_id, estado, minutos_atraso)
            VALUES (?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE estado = IF(
              estado IN ('ausente', 'justificado', 'licencia_medica'), VALUES(estado), estado
            )
          `, [justificacion.evento_id, justificacion.persona_id, estadoAplicado]);

          const [asis] = await conn.query(
            'SELECT id, estado FROM asistencias WHERE evento_id = ? AND persona_id = ?',
            [justificacion.evento_id, justificacion.persona_id]
          );
          asistencia = asis[0] || null;

          if (asistencia && asistencia.estado === estadoAplicado) {
            await conn.query(
              "DELETE FROM multas WHERE asistencia_id = ? AND estado = 'pendiente'",
              [asistencia.id]
            );
          }
        }

        await conn.query(`
          UPDATE justificaciones
          SET estado = 'aprobada', estado_aplicado = ?, observacion_directiva = ?,
              revisado_por = ?, revisado_en = NOW()
          WHERE id = ?
        `, [estadoAplicado, observacion, usuarioId, id]);

        await conn.commit();

        resolve({
          resultado: 'aprobada',
          persona_id: justificacion.persona_id,
          sinEvento: !justificacion.evento_id,
          asistenciaAplicada: Boolean(asistencia && asistencia.estado === estadoAplicado),
          estadoAsistencia: asistencia ? asistencia.estado : null
        });
      } catch (err) {
        await conn.rollback().catch(() => {});
        reject(err);
      } finally {
        conexion.release();
      }
    });
  });

exports.rechazarJustificacion = ({ id, observacion, usuarioId }) =>
  ejecutar(`
    UPDATE justificaciones
    SET estado = 'rechazada', observacion_directiva = ?, revisado_por = ?, revisado_en = NOW()
    WHERE id = ? AND estado = 'pendiente'
  `, [observacion, usuarioId, id]);

exports.listarPostulaciones = () =>
  ejecutar(`
    SELECT pb.id, pb.bloque_actual, pb.es_nuevo, pb.opcion_1, pb.opcion_2,
           pb.celular, pb.email, pb.email_enviado, pb.creado_en,
           p.rut, p.nombres, p.apellido_paterno, p.apellido_materno
    FROM postulaciones_bloque pb
    JOIN personas p ON p.id = pb.persona_id
    ORDER BY pb.creado_en DESC
    LIMIT 500
  `);
