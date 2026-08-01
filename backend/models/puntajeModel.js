// Acceso MySQL del puntaje GDC: calcula registros por asistencia/cuota y consulta ranking y detalle.
// =====================================
// MODELO PUNTAJE GDC
// =====================================

const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

exports.obtenerRanking = () =>
  ejecutar('SELECT * FROM vista_ranking_puntaje');

exports.obtenerHistorial = (persona_id) =>
  ejecutar(`
    SELECT
      pt.id,
      pt.puntos,
      pt.detalle,
      pt.fecha,
      e.nombre AS evento,
      e.tipo   AS tipo_evento
    FROM puntajes pt
    JOIN eventos e ON pt.evento_id = e.id
    WHERE pt.persona_id = ?
    ORDER BY pt.fecha DESC, pt.id DESC
    LIMIT 200
  `, [persona_id]);

exports.verificarCuotaAlDia = (persona_id, mes, anio) =>
  ejecutar(`
    SELECT COUNT(*) AS cnt
    FROM cuotas
    WHERE persona_id = ? AND mes = ? AND anio = ? AND estado = 'pagado'
  `, [persona_id, mes, anio]);

exports.insertarPuntaje = (data) =>
  ejecutar(`
    INSERT IGNORE INTO puntajes
      (persona_id, asistencia_id, evento_id, puntos, detalle, fecha)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [data.persona_id, data.asistencia_id, data.evento_id, data.puntos, data.detalle, data.fecha]);

exports.insertarPuntajeCuota = (data) =>
  ejecutar(`
    INSERT IGNORE INTO puntajes
      (persona_id, cuota_id, puntos, detalle, fecha)
    VALUES (?, ?, ?, ?, ?)
  `, [data.persona_id, data.cuota_id, data.puntos, data.detalle, data.fecha]);
