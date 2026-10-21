// Acceso MySQL del registro de actividad (tabla auditoria): inserta movimientos y
// los lista por módulo con el nombre del integrante / actividad involucrados.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

exports.registrar = data =>
  ejecutar(`
    INSERT INTO auditoria
      (actor_tipo, actor_id, actor_nombre, rol, rol_base, modulo, accion, metodo, ruta,
       registro_id, persona_id, evento_id, detalle, resultado, ip)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    data.actor_tipo, data.actor_id, data.actor_nombre, data.rol, data.rol_base,
    data.modulo, data.accion, data.metodo, data.ruta, data.registro_id,
    data.persona_id, data.evento_id, data.detalle, data.resultado, data.ip
  ]);

function filtros({ modulo, usuario, desde, hasta }) {
  const where = [];
  const params = [];
  if (modulo) { where.push('au.modulo = ?'); params.push(modulo); }
  if (usuario) { where.push('au.actor_nombre = ?'); params.push(usuario); }
  if (desde) { where.push('au.fecha >= ?'); params.push(`${desde} 00:00:00`); }
  if (hasta) { where.push('au.fecha <= ?'); params.push(`${hasta} 23:59:59`); }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

// En asistencia, cuando la ruta trae el id del registro (ej. vestimenta) y no el
// persona_id/evento_id, se toman de la asistencia.
exports.listar = (opciones, limite = 1000) => {
  const { where, params } = filtros(opciones);
  return ejecutar(`
    SELECT
      au.id, au.fecha, au.actor_tipo, au.actor_nombre, au.rol, au.modulo, au.accion,
      au.metodo, au.ruta, au.registro_id, au.detalle, au.resultado, au.ip,
      TRIM(CONCAT_WS(' ', p.nombres, p.apellido_paterno, p.apellido_materno)) AS integrante,
      e.nombre AS actividad,
      e.fecha AS fecha_actividad
    FROM auditoria au
    LEFT JOIN asistencias asi
      ON au.modulo = 'asistencia' AND au.persona_id IS NULL AND asi.id = au.registro_id
    LEFT JOIN personas p ON p.id = COALESCE(au.persona_id, asi.persona_id)
    LEFT JOIN eventos e ON e.id = COALESCE(au.evento_id, asi.evento_id)
    ${where}
    ORDER BY au.id DESC
    LIMIT ${Number(limite) || 1000}
  `, params);
};

// Cantidad de movimientos por módulo (para las pestañas), con los mismos filtros
// de usuario y fechas pero sin el de módulo.
exports.contarPorModulo = opciones => {
  const { where, params } = filtros({ ...opciones, modulo: null });
  return ejecutar(`
    SELECT au.modulo, COUNT(*) AS total
    FROM auditoria au
    ${where}
    GROUP BY au.modulo
  `, params);
};

exports.listarActores = () =>
  ejecutar(`
    SELECT DISTINCT actor_nombre
    FROM auditoria
    WHERE actor_tipo = 'usuario' AND actor_nombre IS NOT NULL
    ORDER BY actor_nombre
  `);
