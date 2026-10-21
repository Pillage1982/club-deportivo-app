// Acceso MySQL de la pestaña "Documentos" del Portal del Integrante: cartas de
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
       tipo_solicitado, motivo_tipo, condicion, motivo, quien_entrega, adjunto_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.persona_id, data.evento_id, data.referencia, data.referencia_otro,
    data.fecha_actividad, data.tipo_solicitado, data.motivo_tipo, data.condicion, data.motivo,
    data.quien_entrega, data.adjunto_path
  ]).then(result => result.insertId);

exports.obtenerFechaCreacion = id =>
  ejecutar('SELECT creado_en FROM justificaciones WHERE id = ?', [id])
    .then(rows => (rows[0] ? rows[0].creado_en : null));

exports.marcarEmailJustificacion = id =>
  ejecutar('UPDATE justificaciones SET email_enviado = 1 WHERE id = ?', [id]);

// `desde` ('YYYY-MM-DD'): el portal lista solo la temporada vigente.
exports.listarJustificacionesSocio = (personaId, desde) =>
  ejecutar(`
    SELECT j.id, j.referencia, j.referencia_otro, j.fecha_actividad,
           j.tipo_solicitado, j.motivo_tipo, j.estado, j.estado_aplicado, j.observacion_directiva,
           j.revisado_en, j.creado_en, (j.adjunto_path IS NOT NULL) AS tiene_adjunto,
           e.nombre AS evento, e.fecha AS fecha_evento
    FROM justificaciones j
    LEFT JOIN eventos e ON e.id = j.evento_id
    WHERE j.persona_id = ? AND (j.fecha_actividad >= ? OR j.creado_en >= ?)
    ORDER BY j.creado_en DESC
    LIMIT 100
  `, [personaId, desde, desde]);

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

exports.listarPostulacionesSocio = (personaId, desde) =>
  ejecutar(`
    SELECT id, bloque_actual, es_nuevo, opcion_1, opcion_2, creado_en,
           estado, bloque_asignado, observacion_directiva
    FROM postulaciones_bloque
    WHERE persona_id = ? AND creado_en >= ?
    ORDER BY creado_en DESC
    LIMIT 50
  `, [personaId, desde]);

// =====================================
// ADMIN: revisión de justificaciones
// =====================================
exports.listarJustificaciones = estado => {
  const filtro = estado ? 'WHERE j.estado = ?' : '';
  return ejecutar(`
    SELECT j.id, j.persona_id, j.evento_id, j.referencia, j.referencia_otro,
           j.fecha_actividad, j.tipo_solicitado, j.motivo_tipo, j.condicion, j.motivo,
           j.quien_entrega, (j.adjunto_path IS NOT NULL) AS tiene_adjunto,
           j.estado, j.estado_aplicado, j.observacion_directiva,
           j.revisado_en, j.email_enviado, j.creado_en, j.origen,
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

// Corre fn(conn) en una transacción. fn devuelve { commit: bool, valor }: con
// commit false se deshace todo (validaciones que fallan dentro de la transacción).
function enTransaccion(fn) {
  return new Promise((resolve, reject) => {
    db.getConnection(async (errConn, conexion) => {
      if (errConn) return reject(errConn);
      const conn = conexion.promise();

      try {
        await conn.beginTransaction();
        const { commit, valor } = await fn(conn);
        if (commit) await conn.commit();
        else await conn.rollback();
        resolve(valor);
      } catch (err) {
        await conn.rollback().catch(() => {});
        reject(err);
      } finally {
        conexion.release();
      }
    });
  });
}

// Deja la asistencia del evento en justificado/licencia_medica (la crea si aún no
// existe, p. ej. el evento no se ha cerrado) y elimina la multa pendiente de esa
// asistencia. Nunca pisa una asistencia presente/atrasado/etc.: solo reemplaza
// ausente o una justificación anterior. Devuelve la asistencia resultante.
async function aplicarJustificacionEnAsistencia(conn, { eventoId, personaId, estadoAplicado }) {
  await conn.query(`
    INSERT INTO asistencias (evento_id, persona_id, estado, minutos_atraso)
    VALUES (?, ?, ?, 0)
    ON DUPLICATE KEY UPDATE estado = IF(
      estado IN ('ausente', 'justificado', 'licencia_medica'), VALUES(estado), estado
    )
  `, [eventoId, personaId, estadoAplicado]);

  const [asis] = await conn.query(
    'SELECT id, estado FROM asistencias WHERE evento_id = ? AND persona_id = ?',
    [eventoId, personaId]
  );
  const asistencia = asis[0] || null;

  if (asistencia && asistencia.estado === estadoAplicado) {
    await conn.query(
      "DELETE FROM multas WHERE asistencia_id = ? AND estado = 'pendiente'",
      [asistencia.id]
    );
  }
  return asistencia;
}

// Aprobar: en una transacción marca la carta y aplica la justificación en la
// asistencia del evento (ver aplicarJustificacionEnAsistencia). El puntaje se
// recalcula después, fuera de la transacción (controller).
exports.aprobarJustificacion = ({ id, estadoAplicado, observacion, usuarioId }) =>
  enTransaccion(async conn => {
    const [filas] = await conn.query(
      'SELECT id, persona_id, evento_id, estado FROM justificaciones WHERE id = ? FOR UPDATE',
      [id]
    );
    const justificacion = filas[0];

    if (!justificacion) return { commit: false, valor: { resultado: 'no_encontrada' } };
    if (justificacion.estado !== 'pendiente') return { commit: false, valor: { resultado: 'ya_revisada' } };

    const asistencia = justificacion.evento_id
      ? await aplicarJustificacionEnAsistencia(conn, {
        eventoId: justificacion.evento_id, personaId: justificacion.persona_id, estadoAplicado
      })
      : null;

    await conn.query(`
      UPDATE justificaciones
      SET estado = 'aprobada', estado_aplicado = ?, observacion_directiva = ?,
          revisado_por = ?, revisado_en = NOW()
      WHERE id = ?
    `, [estadoAplicado, observacion, usuarioId, id]);

    return {
      commit: true,
      valor: {
        resultado: 'aprobada',
        persona_id: justificacion.persona_id,
        sinEvento: !justificacion.evento_id,
        asistenciaAplicada: Boolean(asistencia && asistencia.estado === estadoAplicado),
        estadoAsistencia: asistencia ? asistencia.estado : null
      }
    };
  });

// =====================================
// ADMIN: justificación manual (cartas que llegan fuera del Portal, p. ej. al
// correo antiguo de la agrupación). Solo temporada vigente y hasta un mes atrás.
// =====================================

// Fecha más antigua justificable a mano: la mayor entre el inicio de la temporada
// vigente y hoy menos un mes (CURDATE está en hora de Chile, db.js).
exports.obtenerDesdeJustificacionManual = inicioTemporada =>
  ejecutar(
    "SELECT DATE_FORMAT(GREATEST(?, DATE_SUB(CURDATE(), INTERVAL 1 MONTH)), '%Y-%m-%d') AS desde",
    [inicioTemporada]
  ).then(rows => rows[0].desde);

exports.listarIntegrantesJustificacionManual = () =>
  ejecutar(`
    SELECT id, rut, nombres, apellido_paterno, apellido_materno, bloque,
           COALESCE(estado, 'activo') AS estado
    FROM personas
    WHERE activo = 1 AND COALESCE(estado, 'activo') IN ('activo', 'receso')
    ORDER BY nombres, apellido_paterno
  `);

// Actividades desde `desde` hasta 90 días adelante (igual que el Portal), incluidas
// las ya finalizadas: la carta suele llegar después de la actividad.
const CONDICION_EVENTO_MANUAL = 'DATE(e.fecha) >= ? AND e.fecha < NOW() + INTERVAL 90 DAY';

exports.listarEventosJustificacionManual = desde =>
  ejecutar(`
    SELECT e.id, e.nombre, e.tipo, e.fecha, COALESCE(e.finalizado, 0) AS finalizado
    FROM eventos e
    WHERE ${CONDICION_EVENTO_MANUAL}
    ORDER BY e.fecha DESC
  `, [desde]);

exports.obtenerEventoJustificacionManual = (eventoId, desde) =>
  ejecutar(`
    SELECT e.id, e.nombre, e.tipo, e.fecha
    FROM eventos e
    WHERE e.id = ? AND ${CONDICION_EVENTO_MANUAL}
    LIMIT 1
  `, [eventoId, desde]).then(rows => rows[0] || null);

exports.obtenerIntegranteJustificacionManual = personaId =>
  ejecutar(`
    SELECT id FROM personas
    WHERE id = ? AND activo = 1 AND COALESCE(estado, 'activo') IN ('activo', 'receso')
    LIMIT 1
  `, [personaId]).then(rows => rows[0] || null);

// Crea la carta ya aprobada (origen 'manual') y la aplica en la asistencia, todo en
// una transacción. Se deshace si el integrante ya tiene una carta pendiente o
// aprobada para esa actividad, o si su asistencia figura como presente/atrasado/etc.
exports.crearJustificacionManual = data =>
  enTransaccion(async conn => {
    if (data.evento_id) {
      const [previas] = await conn.query(`
        SELECT id FROM justificaciones
        WHERE evento_id = ? AND persona_id = ? AND estado IN ('pendiente', 'aprobada')
        LIMIT 1 FOR UPDATE
      `, [data.evento_id, data.persona_id]);
      if (previas.length) {
        return { commit: false, valor: { resultado: 'duplicada', folio: previas[0].id } };
      }
    }

    const [ins] = await conn.query(`
      INSERT INTO justificaciones
        (persona_id, evento_id, referencia, referencia_otro, fecha_actividad,
         tipo_solicitado, motivo_tipo, condicion, motivo, adjunto_path, origen,
         estado, estado_aplicado, observacion_directiva, revisado_por, revisado_en)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', 'aprobada', ?, ?, ?, NOW())
    `, [
      data.persona_id, data.evento_id, data.referencia, data.referencia_otro,
      data.fecha_actividad, data.estado_aplicado, data.motivo_tipo, data.condicion,
      data.motivo, data.adjunto_path, data.estado_aplicado, data.observacion, data.usuario_id
    ]);

    if (data.evento_id) {
      const asistencia = await aplicarJustificacionEnAsistencia(conn, {
        eventoId: data.evento_id, personaId: data.persona_id, estadoAplicado: data.estado_aplicado
      });
      if (!asistencia || asistencia.estado !== data.estado_aplicado) {
        return { commit: false, valor: { resultado: 'asistio', estadoAsistencia: asistencia && asistencia.estado } };
      }
    }

    return {
      commit: true,
      valor: { resultado: 'aprobada', folio: ins.insertId, sinEvento: !data.evento_id }
    };
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
           pb.estado, pb.bloque_asignado, pb.observacion_directiva, pb.revisado_en,
           p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
           u.usuario AS revisado_por_usuario
    FROM postulaciones_bloque pb
    JOIN personas p ON p.id = pb.persona_id
    LEFT JOIN usuarios u ON u.id = pb.revisado_por
    ORDER BY (pb.estado = 'pendiente') DESC, pb.creado_en DESC
    LIMIT 500
  `);

exports.obtenerPostulacion = id =>
  ejecutar(`
    SELECT pb.*, p.nombres, p.apellido_paterno, p.apellido_materno,
           p.email AS email_persona
    FROM postulaciones_bloque pb
    JOIN personas p ON p.id = pb.persona_id
    WHERE pb.id = ?
    LIMIT 1
  `, [id]).then(rows => rows[0] || null);

// Aceptar: en una transacción marca la postulación y asigna la opción elegida
// (1ª o 2ª) como bloque del integrante en su ficha.
exports.aceptarPostulacion = ({ id, opcion, observacion, usuarioId }) =>
  new Promise((resolve, reject) => {
    db.getConnection(async (errConn, conexion) => {
      if (errConn) return reject(errConn);
      const conn = conexion.promise();

      try {
        await conn.beginTransaction();

        const [filas] = await conn.query(
          'SELECT id, persona_id, opcion_1, opcion_2, estado FROM postulaciones_bloque WHERE id = ? FOR UPDATE',
          [id]
        );
        const postulacion = filas[0];

        if (!postulacion) {
          await conn.rollback();
          return resolve({ resultado: 'no_encontrada' });
        }
        if (postulacion.estado !== 'pendiente') {
          await conn.rollback();
          return resolve({ resultado: 'ya_revisada' });
        }

        const bloque = opcion === 2 ? postulacion.opcion_2 : postulacion.opcion_1;
        if (!bloque) {
          await conn.rollback();
          return resolve({ resultado: 'sin_opcion' });
        }

        await conn.query('UPDATE personas SET bloque = ? WHERE id = ?', [bloque, postulacion.persona_id]);
        await conn.query(`
          UPDATE postulaciones_bloque
          SET estado = 'aprobada', bloque_asignado = ?, observacion_directiva = ?,
              revisado_por = ?, revisado_en = NOW()
          WHERE id = ?
        `, [bloque, observacion, usuarioId, id]);

        await conn.commit();
        resolve({ resultado: 'aprobada', bloque });
      } catch (err) {
        await conn.rollback().catch(() => {});
        reject(err);
      } finally {
        conexion.release();
      }
    });
  });

exports.rechazarPostulacion = ({ id, observacion, usuarioId }) =>
  ejecutar(`
    UPDATE postulaciones_bloque
    SET estado = 'rechazada', observacion_directiva = ?, revisado_por = ?, revisado_en = NOW()
    WHERE id = ? AND estado = 'pendiente'
  `, [observacion, usuarioId, id]);
