// Acceso MySQL del puntaje GDC: calcula registros por asistencia/cuota y consulta ranking y detalle.
// =====================================
// MODELO PUNTAJE GDC
// =====================================

const db = require('../config/db');
const { MESES_SIN_CUOTA, EVENTO_PROVISIONAL_SQL } = require('../utils/estatutoGdcRules');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

// Temporadas seleccionables: cada actividad marcada "Inicia temporada" ya ocurrida
// abre una temporada (ver reconstruirVistaRankingPuntaje en backend/config/migrations.js,
// misma referencia de corte). Se listan de la mas antigua a la mas reciente.
exports.obtenerTemporadas = () =>
  ejecutar(`
    SELECT id, nombre, DATE(fecha) AS fecha
    FROM eventos
    WHERE inicia_temporada = 1 AND DATE(fecha) <= CURDATE()
    ORDER BY fecha ASC
  `);

// Inicio de la temporada vigente ('YYYY-MM-DD'): la actividad "Inicia temporada"
// ya ocurrida más reciente, mismo corte que vista_ranking_puntaje. Sin ninguna
// marcada devuelve '1900-01-01' (sin corte).
exports.obtenerInicioTemporadaVigente = () =>
  ejecutar(`
    SELECT DATE_FORMAT(COALESCE(MAX(DATE(fecha)), '1900-01-01'), '%Y-%m-%d') AS inicio
    FROM eventos
    WHERE inicia_temporada = 1 AND DATE(fecha) <= CURDATE()
  `).then(rows => rows[0].inicio);

// Ranking acotado a un rango [inicio, fin) de fechas de puntaje. inicio/fin nulos
// dejan ese extremo abierto (usado para "antes de la primera Despedida" y para la
// temporada en curso, que no tiene fin). Misma agregacion que la vista
// vista_ranking_puntaje, parametrizada porque las vistas de MySQL no aceptan
// argumentos: si se ajusta una, ajustar la otra.
exports.obtenerRankingPorTemporada = (inicio, fin) => {
  const params = [];
  let condicionFecha = '';
  if (inicio) { condicionFecha += ' AND pt.fecha >= ?'; params.push(inicio); }
  if (fin)    { condicionFecha += ' AND pt.fecha < ?';  params.push(fin); }

  return ejecutar(`
    SELECT
      p.id,
      p.rut,
      p.nombres,
      p.apellido_paterno,
      p.apellido_materno,
      p.bloque,
      CASE
        WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
        ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE())
      END AS puntos_antiguedad,
      COALESCE(SUM(CASE WHEN pt.cuota_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_cuotas,
      COALESCE(SUM(CASE WHEN pt.asistencia_id IS NOT NULL THEN pt.puntos ELSE 0 END), 0) AS puntos_asistencia,
      COALESCE(SUM(pt.puntos), 0) + CASE
        WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
        ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE())
      END AS puntaje_total,
      COUNT(pt.id)                AS total_registros
    FROM personas p
    LEFT JOIN puntajes pt ON p.id = pt.persona_id${condicionFecha}
    WHERE p.activo = 1 AND COALESCE(p.estado, 'activo') = 'activo'
    GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno, p.bloque, p.fecha_ingreso
    ORDER BY puntaje_total DESC
  `, params);
};

// Total de puntos generados por pagos de cuotas (Fase 2, Art. 9.2/9.3), sin
// mezclar con los puntos de asistencia o antigüedad. `desde` ('YYYY-MM-DD'):
// solo desde el inicio de la temporada, como el ranking.
exports.obtenerPuntosCuotasPorPersona = (desde = null) =>
  ejecutar(`
    SELECT persona_id, COALESCE(SUM(puntos),0) AS puntos_cuotas
    FROM puntajes
    WHERE cuota_id IS NOT NULL${desde ? ' AND fecha >= ?' : ''}
    GROUP BY persona_id
  `, desde ? [desde] : []);

// LEFT JOIN: los puntos por pago de cuota (insertarPuntajeCuota) no tienen
// evento_id (es NULL), así que un INNER JOIN los descartaba silenciosamente
// del historial aunque sí sumaran al puntaje_total del ranking.
// `desde` / `hasta` opcionales ('YYYY-MM-DD'): solo puntajes de ese rango [desde, hasta)
// (temporada vigente en el Portal del Integrante, temporada elegida en el panel).
exports.obtenerHistorial = (persona_id, desde = null, hasta = null) =>
  ejecutar(`
    SELECT
      pt.id,
      pt.puntos,
      pt.detalle,
      pt.fecha,
      COALESCE(e.nombre, IF(pt.cuota_id IS NOT NULL, 'Pago de cuota', 'Evento eliminado')) AS evento,
      e.tipo AS tipo_evento
    FROM puntajes pt
    LEFT JOIN eventos e ON pt.evento_id = e.id
    WHERE pt.persona_id = ?${desde ? ' AND pt.fecha >= ?' : ''}${hasta ? ' AND pt.fecha < ?' : ''}
    ORDER BY pt.fecha DESC, pt.id DESC
    LIMIT 200
  `, [persona_id, ...(desde ? [desde] : []), ...(hasta ? [hasta] : [])]);

// "Cuota al día" para una actividad del mes `mes`/`anio` (expresiones SQL):
// ninguna cuota de ese mes o anterior impaga y, en los meses con cuota, la de ese
// mes pagada. En los meses sin cuota de la temporada (MESES_SIN_CUOTA, agosto y
// septiembre) basta con no deber cuotas anteriores. Única definición: la usan el
// registro en vivo (verificarCuotaAlDia) y el recálculo.
function condicionCuotaAlDia(persona, anio, mes) {
  return `(
    (${mes} IN (${MESES_SIN_CUOTA.join(', ')}) OR EXISTS (
      SELECT 1 FROM cuotas c
      WHERE c.persona_id = ${persona} AND c.anio = ${anio} AND c.mes = ${mes} AND c.estado = 'pagado'
    ))
    AND NOT EXISTS (
      SELECT 1 FROM cuotas c
      WHERE c.persona_id = ${persona}
        AND (c.anio < ${anio} OR (c.anio = ${anio} AND c.mes <= ${mes}))
        AND c.estado <> 'pagado'
    )
  )`;
}

// Historial del panel (Puntaje → historial de un integrante): TODAS las
// actividades ya ocurridas del rango [desde, hasta), aunque no haya sumado puntos
// (ausente, sin registro), más los puntos por pago de cuota del rango. `estado`:
// estado de la asistencia, 'sin_registro' o NULL en las filas de cuota.
exports.obtenerHistorialTemporada = (persona_id, desde = null, hasta = null) => {
  const rangoEvento = `${desde ? ' AND DATE(e.fecha) >= ?' : ''}${hasta ? ' AND DATE(e.fecha) < ?' : ''}`;
  const rangoCuota  = `${desde ? ' AND pt.fecha >= ?' : ''}${hasta ? ' AND pt.fecha < ?' : ''}`;
  const rango = [...(desde ? [desde] : []), ...(hasta ? [hasta] : [])];

  return ejecutar(`
    SELECT * FROM (
      SELECT
        DATE(e.fecha) AS fecha,
        e.fecha AS orden,
        e.nombre AS evento,
        e.tipo AS tipo_evento,
        COALESCE(a.estado, 'sin_registro') AS estado,
        CASE
          WHEN pt.id IS NOT NULL THEN pt.detalle
          WHEN a.estado = 'ausente' THEN 'Ausente'
          WHEN a.id IS NULL THEN 'Sin registro de asistencia'
          ELSE CONCAT(REPLACE(a.estado, '_', ' '), ' (no puntúa)')
        END AS detalle,
        COALESCE(pt.puntos, 0) AS puntos
      FROM eventos e
      LEFT JOIN asistencias a ON a.evento_id = e.id AND a.persona_id = ?
      LEFT JOIN puntajes pt ON pt.asistencia_id = a.id
      WHERE e.fecha <= NOW()${rangoEvento}

      UNION ALL

      SELECT pt.fecha, pt.fecha, 'Pago de cuota', NULL, NULL, pt.detalle, pt.puntos
      FROM puntajes pt
      WHERE pt.persona_id = ? AND pt.cuota_id IS NOT NULL${rangoCuota}
    ) h
    ORDER BY h.orden DESC
  `, [persona_id, ...rango, persona_id, ...rango]);
};

exports.verificarCuotaAlDia = (persona_id, mes, anio) =>
  ejecutar(`
    SELECT ${condicionCuotaAlDia('q.persona_id', 'q.anio', 'q.mes')} AS al_dia
    FROM (SELECT ? AS persona_id, ? AS anio, ? AS mes) q
  `, [persona_id, anio, mes]);

// Mismos puntos que calcularPuntosAsistencia (estatutoGdcRules.js, Art. 8.4): si
// se ajusta uno, ajustar el otro. Las actividades provisionales de la importación
// ("Actividad AAAA-MM-DD") no puntúan.
exports.recalcularPuntajesAsistencia = persona_id =>
  ejecutar(`
    INSERT INTO puntajes
      (persona_id, asistencia_id, evento_id, puntos, detalle, fecha)
    SELECT
      x.persona_id,
      x.id,
      x.evento_id,
      CASE x.estado
        WHEN 'presente'            THEN IF(x.al_dia, 10, 5)
        WHEN 'atrasado'            THEN IF(x.al_dia, 7, 3)
        WHEN 'justificado'         THEN IF(x.al_dia, 5, 1)
        WHEN 'vestimenta_distinta' THEN IF(x.al_dia, 3, 1)
        WHEN 'licencia_medica'     THEN 6
        WHEN 'retiro_sin_aviso'    THEN -3
      END,
      CASE x.estado
        WHEN 'presente'            THEN CONCAT('Presente ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
        WHEN 'atrasado'            THEN CONCAT('Atraso ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
        WHEN 'justificado'         THEN CONCAT('Justificación ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
        WHEN 'vestimenta_distinta' THEN CONCAT('Vestimenta distinta ', IF(x.al_dia, '+ cuota al día', 'sin cuota al día'))
        WHEN 'licencia_medica'     THEN 'Licencia médica'
        WHEN 'retiro_sin_aviso'    THEN 'Retiro sin aviso'
      END,
      x.fecha
    FROM (
      SELECT
        a.id, a.persona_id, a.evento_id, a.estado, DATE(e.fecha) AS fecha,
        ${condicionCuotaAlDia('a.persona_id', 'YEAR(e.fecha)', 'MONTH(e.fecha)')} AS al_dia
      FROM asistencias a
      JOIN eventos e ON e.id = a.evento_id
      WHERE a.persona_id = ?
        AND a.estado <> 'ausente'
        AND e.nombre NOT REGEXP '${EVENTO_PROVISIONAL_SQL}'
    ) x
    ON DUPLICATE KEY UPDATE
      persona_id = VALUES(persona_id), evento_id = VALUES(evento_id),
      puntos = VALUES(puntos), detalle = VALUES(detalle), fecha = VALUES(fecha)
  `, [persona_id]);

// Al eliminar una actividad sus asistencias se borran en cascada, pero `puntajes`
// no tiene clave foránea: sin esto los puntos seguían sumando en el ranking.
exports.eliminarPuntajesEvento = evento_id =>
  ejecutar('DELETE FROM puntajes WHERE evento_id = ? AND asistencia_id IS NOT NULL', [evento_id]);

exports.eliminarPuntajesAsistenciasAusentes = persona_id =>
  ejecutar(`
    DELETE pt FROM puntajes pt
    JOIN asistencias a ON a.id = pt.asistencia_id
    WHERE a.persona_id = ? AND a.estado = 'ausente'
  `, [persona_id]);

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
