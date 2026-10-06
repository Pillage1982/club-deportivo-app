// Acceso MySQL de las solicitudes "Súmate a la promesa" (formulario público del
// sitio gdcayquina.cl). Aprobar crea el integrante (o reactiva uno dado de baja)
// con los datos básicos; el resto lo completa él en su primer ingreso al Portal.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

// Misma normalización que personaModel.obtenerPersonaPorRutIncluyendoInactivos:
// los RUT antiguos de personas pueden tener puntos, guion o espacios.
const RUT_PERSONA_NORMALIZADO = "REPLACE(REPLACE(REPLACE(UPPER(p.rut), '.', ''), '-', ''), ' ', '')";

// Hay una solicitud pendiente o un integrante activo con este RUT (sin puntos ni guion).
exports.existeRegistroActivo = rutLimpio =>
  ejecutar(`
    SELECT
      EXISTS (
        SELECT 1 FROM solicitudes_ingreso
        WHERE REPLACE(rut, '-', '') = ? AND estado = 'pendiente'
      ) AS solicitud_pendiente,
      EXISTS (
        SELECT 1 FROM personas p
        WHERE ${RUT_PERSONA_NORMALIZADO} = ? AND p.activo = 1
      ) AS integrante_activo
  `, [rutLimpio, rutLimpio]).then(rows => rows[0]);

exports.crearSolicitud = datos =>
  ejecutar(`
    INSERT INTO solicitudes_ingreso
      (rut, nombres, apellido_paterno, apellido_materno, fecha_nacimiento, telefono, email,
       comparsa_interes, mensaje, nombre_apoderado, rut_apoderado, telefono_apoderado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    datos.rut,
    datos.nombres,
    datos.apellido_paterno,
    datos.apellido_materno || null,
    datos.fecha_nacimiento,
    datos.telefono,
    datos.email,
    datos.comparsa_interes || null,
    datos.mensaje || null,
    datos.nombre_apoderado || null,
    datos.rut_apoderado || null,
    datos.telefono_apoderado || null
  ]).then(result => result.insertId);

exports.marcarEmailEnviado = id =>
  ejecutar('UPDATE solicitudes_ingreso SET email_enviado = 1 WHERE id = ?', [id]);

exports.listarSolicitudes = estado =>
  ejecutar(`
    SELECT s.*, u.usuario AS revisado_por_usuario
    FROM solicitudes_ingreso s
    LEFT JOIN usuarios u ON u.id = s.revisado_por
    ${estado ? 'WHERE s.estado = ?' : ''}
    ORDER BY s.creado_en DESC
  `, estado ? [estado] : []);

exports.obtenerSolicitud = id =>
  ejecutar('SELECT * FROM solicitudes_ingreso WHERE id = ?', [id]).then(rows => rows[0] || null);

// Crea el integrante desde la solicitud. Si el RUT ya existía dado de baja, lo
// reactiva con los datos nuevos y borra su acceso al Portal: la clave vuelve a
// ser el RUT y en el primer ingreso se le exige crear contraseña y actualizar datos.
exports.aprobarSolicitud = ({ id, bloque, observacion, usuarioId }) =>
  new Promise((resolve, reject) => {
    db.getConnection(async (errConn, conexion) => {
      if (errConn) return reject(errConn);
      const conn = conexion.promise();

      try {
        await conn.beginTransaction();

        const [filas] = await conn.query(
          'SELECT * FROM solicitudes_ingreso WHERE id = ? FOR UPDATE',
          [id]
        );
        const s = filas[0];

        if (!s) {
          await conn.rollback();
          return resolve({ resultado: 'no_encontrada' });
        }
        if (s.estado !== 'pendiente') {
          await conn.rollback();
          return resolve({ resultado: 'ya_revisada' });
        }

        const rutLimpio = String(s.rut).replace(/-/g, '');
        const [existentes] = await conn.query(
          `SELECT p.id, p.activo FROM personas p WHERE ${RUT_PERSONA_NORMALIZADO} = ? LIMIT 1 FOR UPDATE`,
          [rutLimpio]
        );
        const existente = existentes[0];

        if (existente && Number(existente.activo) === 1) {
          await conn.rollback();
          return resolve({ resultado: 'ya_integrante' });
        }

        const valores = [
          s.rut, s.nombres, s.apellido_paterno, s.apellido_materno,
          bloque || null, s.email, s.telefono, s.fecha_nacimiento,
          s.nombre_apoderado, s.telefono_apoderado, s.rut_apoderado
        ];
        let personaId;

        if (existente) {
          await conn.query(`
            UPDATE personas
            SET rut = ?, nombres = ?, apellido_paterno = ?, apellido_materno = ?,
                bloque = ?, email = ?, telefono = ?, fecha_nacimiento = ?,
                nombre_apoderado = ?, telefono_apoderado = ?, rut_apoderado = ?,
                fecha_ingreso = CURDATE(), estado = 'activo', activo = 1
            WHERE id = ?
          `, [...valores, existente.id]);
          await conn.query('DELETE FROM socios_auth WHERE persona_id = ?', [existente.id]);
          personaId = existente.id;
        } else {
          const [insert] = await conn.query(`
            INSERT INTO personas
              (rut, nombres, apellido_paterno, apellido_materno, bloque, email, telefono,
               fecha_nacimiento, nombre_apoderado, telefono_apoderado, rut_apoderado,
               fecha_ingreso, estado, es_honorario)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), 'activo', 0)
          `, valores);
          personaId = insert.insertId;
        }

        await conn.query(`
          UPDATE solicitudes_ingreso
          SET estado = 'aprobada', persona_id = ?, observacion_directiva = ?,
              revisado_por = ?, revisado_en = NOW()
          WHERE id = ?
        `, [personaId, observacion, usuarioId, id]);

        await conn.commit();
        resolve({ resultado: 'aprobada', persona_id: personaId, reactivado: Boolean(existente) });
      } catch (err) {
        await conn.rollback().catch(() => {});
        reject(err);
      } finally {
        conexion.release();
      }
    });
  });

exports.rechazarSolicitud = ({ id, observacion, usuarioId }) =>
  ejecutar(`
    UPDATE solicitudes_ingreso
    SET estado = 'rechazada', observacion_directiva = ?, revisado_por = ?, revisado_en = NOW()
    WHERE id = ? AND estado = 'pendiente'
  `, [observacion, usuarioId, id]);
