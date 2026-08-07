'use strict';

const db = require('../config/db');
const { CATEGORIAS_EXCLUIDAS } = require('../utils/formacionRules');
const marcadoresExclusion = CATEGORIAS_EXCLUIDAS.map(() => '?').join(',');

exports.listarEventos = callback => db.query('SELECT id,nombre,fecha,finalizado FROM eventos ORDER BY fecha DESC,nombre', callback);

exports.obtenerFormacionActual = callback => db.query(`
  SELECT p.id AS persona_id,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque,
         COALESCE(SUM(pt.puntos),0) AS puntaje_utilizado
  FROM personas p
  LEFT JOIN puntajes pt ON pt.persona_id=p.id
  WHERE p.activo=1 AND COALESCE(p.estado,'activo')='activo' AND COALESCE(p.es_honorario,0)=0
    AND p.bloque IS NOT NULL AND TRIM(p.bloque)<>''
    AND LOWER(TRIM(p.bloque)) NOT IN (${marcadoresExclusion})
  GROUP BY p.id,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque,p.fecha_ingreso
  ORDER BY p.bloque, puntaje_utilizado DESC,p.fecha_ingreso ASC,p.apellido_paterno ASC,p.nombres ASC`,
  CATEGORIAS_EXCLUIDAS, callback);

exports.listarBloquesElegibles = callback => db.query(`
  SELECT DISTINCT bloque
  FROM personas
  WHERE activo=1 AND COALESCE(estado,'activo')='activo' AND COALESCE(es_honorario,0)=0
    AND bloque IS NOT NULL AND TRIM(bloque)<>''
    AND LOWER(TRIM(bloque)) NOT IN (${marcadoresExclusion})
  ORDER BY bloque`, CATEGORIAS_EXCLUIDAS, callback);

exports.obtenerCandidatos = (bloque, callback) => db.query(`
  SELECT p.id,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque,
         COALESCE(SUM(pt.puntos),0) AS puntaje
  FROM personas p
  LEFT JOIN puntajes pt ON pt.persona_id=p.id
  WHERE p.activo=1 AND COALESCE(p.estado,'activo')='activo' AND COALESCE(p.es_honorario,0)=0
    AND p.bloque=?
    AND LOWER(TRIM(p.bloque)) NOT IN (${marcadoresExclusion})
  GROUP BY p.id,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque
  ORDER BY puntaje DESC,p.fecha_ingreso ASC,p.apellido_paterno ASC,p.nombres ASC`, [bloque, ...CATEGORIAS_EXCLUIDAS], callback);

exports.obtenerPorEvento = (eventoId, callback) => db.query(`
  SELECT f.id,f.evento_id,e.nombre evento,e.fecha,f.bloque,f.estado,f.fecha_ranking,
         f.observaciones,f.creado_por,f.confirmado_por,f.created_at,f.confirmed_at,
         u.usuario creado_por_nombre,uc.usuario confirmado_por_nombre
  FROM formaciones f JOIN eventos e ON e.id=f.evento_id
  LEFT JOIN usuarios u ON u.id=f.creado_por LEFT JOIN usuarios uc ON uc.id=f.confirmado_por
  WHERE (? IS NULL OR f.evento_id=?) ORDER BY e.fecha DESC,f.bloque`, [eventoId || null, eventoId || null], callback);

exports.obtenerPosiciones = (formacionId, callback) => db.query(`
  SELECT fp.id,fp.formacion_id,fp.persona_id,fp.orden_general,fp.puntaje_utilizado,fp.ajuste_manual,
         fp.motivo_ajuste,p.rut,p.nombres,p.apellido_paterno,p.apellido_materno,p.bloque
  FROM formacion_posiciones fp JOIN personas p ON p.id=fp.persona_id
  WHERE fp.formacion_id=? ORDER BY fp.orden_general`, [formacionId], callback);

exports.obtenerFormacion = (id, callback) => db.query('SELECT * FROM formaciones WHERE id=?', [id],
  (err, rows) => callback(err, rows ? rows[0] : null));

exports.crearBorrador = (eventoId, bloque, usuarioId, observaciones, callback) => db.query(`
  INSERT INTO formaciones (evento_id,bloque,estado,fecha_ranking,creado_por,observaciones)
  VALUES (?,?,'borrador',NOW(),?,?)
  ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`, [eventoId,bloque,usuarioId,observaciones || null], callback);

exports.actualizarBorrador = (id, usuarioId, observaciones, callback) => db.query(`
  UPDATE formaciones SET fecha_ranking=NOW(),creado_por=?,observaciones=?,updated_at=CURRENT_TIMESTAMP
  WHERE id=? AND estado='borrador'`, [usuarioId,observaciones || null,id], callback);

exports.reemplazarPosiciones = (formacionId, candidatos, callback) => {
  db.getConnection((err, conexion) => {
    if (err) return callback(err);
    conexion.beginTransaction(err2 => {
      if (err2) { conexion.release(); return callback(err2); }
      conexion.query('DELETE FROM formacion_posiciones WHERE formacion_id=?', [formacionId], err3 => {
        if (err3) return conexion.rollback(() => { conexion.release(); callback(err3); });
        const finalizar = resultado => conexion.commit(err4 => {
          if (err4) return conexion.rollback(() => { conexion.release(); callback(err4); });
          conexion.release(); callback(null, resultado);
        });
        if (!candidatos.length) return finalizar({ affectedRows: 0 });
        const values = candidatos.map((c, index) => [formacionId,c.id,index+1,c.puntaje,0]);
        conexion.query('INSERT INTO formacion_posiciones (formacion_id,persona_id,orden_general,puntaje_utilizado,ajuste_manual) VALUES ?', [values],
          (err4, resultado) => err4 ? conexion.rollback(() => { conexion.release(); callback(err4); }) : finalizar(resultado));
      });
    });
  });
};

exports.mover = (formacionId, posicionId, direccion, callback) => {
  db.getConnection((err, conexion) => {
    if (err) return callback(err);
    conexion.beginTransaction(err2 => {
      if (err2) { conexion.release(); return callback(err2); }
      conexion.query('SELECT id,orden_general FROM formacion_posiciones WHERE id=? AND formacion_id=? FOR UPDATE', [posicionId,formacionId], (err3, rows) => {
        if (err3 || !rows.length) return conexion.rollback(() => { conexion.release(); callback(err3 || new Error('Posición no encontrada')); });
        const actual=rows[0]; const destino=actual.orden_general+(direccion==='arriba'?-1:1);
        conexion.query('SELECT id,orden_general FROM formacion_posiciones WHERE formacion_id=? AND orden_general=? FOR UPDATE', [formacionId,destino], (err4, rows2) => {
          if (err4 || !rows2.length) return conexion.rollback(() => { conexion.release(); callback(err4, { affectedRows: 0 }); });
          const otra=rows2[0];
          conexion.query('UPDATE formacion_posiciones SET orden_general=-orden_general WHERE id IN (?,?)', [actual.id,otra.id], err5 => {
            if (err5) return conexion.rollback(() => { conexion.release(); callback(err5); });
            conexion.query(`UPDATE formacion_posiciones SET orden_general=CASE id WHEN ? THEN ? WHEN ? THEN ? END,
              ajuste_manual=1 WHERE id IN (?,?)`, [actual.id,otra.orden_general,otra.id,actual.orden_general,actual.id,otra.id], (err6, resultado) => {
              if (err6) return conexion.rollback(() => { conexion.release(); callback(err6); });
              conexion.commit(err7 => {
                if (err7) return conexion.rollback(() => { conexion.release(); callback(err7); });
                conexion.release(); callback(null,resultado);
              });
            });
          });
        });
      });
    });
  });
};

exports.confirmar = (id, usuarioId, callback) => db.query(`UPDATE formaciones SET estado='confirmada',confirmado_por=?,confirmed_at=NOW()
  WHERE id=? AND estado='borrador'`, [usuarioId,id], callback);
exports.reabrir = (id, callback) => db.query("UPDATE formaciones SET estado='borrador',confirmado_por=NULL,confirmed_at=NULL WHERE id=? AND estado='confirmada'", [id], callback);
exports.eliminar = (id, callback) => db.query('DELETE FROM formaciones WHERE id=?', [id], callback);
