// Acceso MySQL de las cartas de permiso para el colegio (tabla cartas_permiso).
// El Portal solo ve y crea las del integrante de la sesión; la revisión es del
// panel (roles admin y secretaria) y la verificación pública va por código.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

const COLUMNAS = `
  c.id, c.persona_id, c.colegio, c.director, c.curso, c.fecha_desde, c.fecha_hasta,
  c.estado, c.observacion_directiva, c.codigo_verificacion, c.anios, c.integrantes,
  c.emitida_en, c.revisado_en, c.email_enviado, c.email_carta_enviado, c.creado_en,
  p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.email, p.bloque,
  u.usuario AS revisado_por_usuario
`;

const FROM = `
  FROM cartas_permiso c
  JOIN personas p ON p.id = c.persona_id
  LEFT JOIN usuarios u ON u.id = c.revisado_por
`;

exports.crear = datos =>
  ejecutar(`
    INSERT INTO cartas_permiso (persona_id, colegio, director, curso, fecha_desde, fecha_hasta)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [datos.persona_id, datos.colegio, datos.director, datos.curso, datos.fecha_desde, datos.fecha_hasta])
    .then(r => r.insertId);

// Evita pedir dos veces la misma carta mientras la primera sigue en revisión.
exports.existePendienteIgual = (personaId, desde, hasta) =>
  ejecutar(`
    SELECT id FROM cartas_permiso
    WHERE persona_id = ? AND estado = 'pendiente' AND fecha_desde = ? AND fecha_hasta = ?
    LIMIT 1
  `, [personaId, desde, hasta]).then(rows => rows.length > 0);

exports.obtener = id =>
  ejecutar(`SELECT ${COLUMNAS} ${FROM} WHERE c.id = ? LIMIT 1`, [id])
    .then(rows => rows[0] || null);

exports.obtenerDelSocio = (id, personaId) =>
  ejecutar(`SELECT ${COLUMNAS} ${FROM} WHERE c.id = ? AND c.persona_id = ? LIMIT 1`, [id, personaId])
    .then(rows => rows[0] || null);

exports.listarSocio = (personaId, desde) =>
  ejecutar(`
    SELECT c.id, c.colegio, c.curso, c.fecha_desde, c.fecha_hasta, c.estado,
           c.observacion_directiva, c.email_carta_enviado, c.creado_en
    FROM cartas_permiso c
    WHERE c.persona_id = ? ${desde ? 'AND c.creado_en >= ?' : ''}
    ORDER BY c.id DESC
  `, desde ? [personaId, desde] : [personaId]);

exports.listar = estado =>
  ejecutar(`
    SELECT ${COLUMNAS} ${FROM}
    ${estado ? 'WHERE c.estado = ?' : ''}
    ORDER BY (c.estado = 'pendiente') DESC, c.id DESC
    LIMIT 500
  `, estado ? [estado] : []);

exports.contarPendientes = () =>
  ejecutar("SELECT COUNT(*) AS total FROM cartas_permiso WHERE estado = 'pendiente'")
    .then(rows => Number(rows[0].total));

// "Integrado actualmente por N personas": integrantes activos al emitir la carta.
exports.contarIntegrantesActivos = () =>
  ejecutar("SELECT COUNT(*) AS total FROM personas WHERE activo = 1 AND COALESCE(estado, 'activo') = 'activo'")
    .then(rows => Number(rows[0].total));

// Solo cambia si sigue pendiente: dos revisores a la vez no pisan la decisión.
exports.aprobar = (id, datos) =>
  ejecutar(`
    UPDATE cartas_permiso
    SET estado = 'aprobada', codigo_verificacion = ?, anios = ?, integrantes = ?, emitida_en = ?,
        observacion_directiva = ?, revisado_por = ?, revisado_en = NOW()
    WHERE id = ? AND estado = 'pendiente'
  `, [datos.codigo, datos.anios, datos.integrantes, datos.emitida_en,
      datos.observacion, datos.revisado_por, id])
    .then(r => r.affectedRows > 0);

exports.rechazar = (id, observacion, revisadoPor) =>
  ejecutar(`
    UPDATE cartas_permiso
    SET estado = 'rechazada', observacion_directiva = ?, revisado_por = ?, revisado_en = NOW()
    WHERE id = ? AND estado = 'pendiente'
  `, [observacion, revisadoPor, id])
    .then(r => r.affectedRows > 0);

exports.marcarEmail = id =>
  ejecutar('UPDATE cartas_permiso SET email_enviado = 1 WHERE id = ?', [id]);

exports.marcarEmailCarta = id =>
  ejecutar('UPDATE cartas_permiso SET email_carta_enviado = 1 WHERE id = ?', [id]);

// Verificación pública: solo cartas aprobadas, por código (no por folio, para que
// no se puedan recorrer los folios y ver datos de menores).
exports.obtenerPorCodigo = codigo =>
  ejecutar(`
    SELECT c.id, c.colegio, c.curso, c.fecha_desde, c.fecha_hasta, c.emitida_en,
           p.nombres, p.apellido_paterno, p.apellido_materno
    FROM cartas_permiso c
    JOIN personas p ON p.id = c.persona_id
    WHERE c.codigo_verificacion = ? AND c.estado = 'aprobada'
    LIMIT 1
  `, [codigo]).then(rows => rows[0] || null);
