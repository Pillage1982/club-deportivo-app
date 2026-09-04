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

// Temporadas seleccionables: cada "Despedida de Pueblo <anio>" ya ocurrida abre
// una temporada (ver reconstruirVistaRankingPuntaje en backend/config/migrations.js,
// misma referencia de corte). Se listan de la mas antigua a la mas reciente.
exports.obtenerTemporadas = () =>
  ejecutar(`
    SELECT id, nombre, DATE(fecha) AS fecha
    FROM eventos
    WHERE LOWER(nombre) LIKE 'despedida de pueblo%' AND DATE(fecha) <= CURDATE()
    ORDER BY fecha ASC
  `);

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
// mezclar con los puntos de asistencia o antigüedad.
exports.obtenerPuntosCuotasPorPersona = () =>
  ejecutar(`
    SELECT persona_id, COALESCE(SUM(puntos),0) AS puntos_cuotas
    FROM puntajes
    WHERE cuota_id IS NOT NULL
    GROUP BY persona_id
  `);

// LEFT JOIN: los puntos por pago de cuota (insertarPuntajeCuota) no tienen
// evento_id (es NULL), así que un INNER JOIN los descartaba silenciosamente
// del historial aunque sí sumaran al puntaje_total del ranking.
exports.obtenerHistorial = (persona_id) =>
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
    WHERE pt.persona_id = ?
    ORDER BY pt.fecha DESC, pt.id DESC
    LIMIT 200
  `, [persona_id]);

exports.verificarCuotaAlDia = (persona_id, mes, anio) =>
  ejecutar(`
    SELECT EXISTS (
      SELECT 1
      FROM cuotas
      WHERE persona_id = ? AND anio = ? AND mes = ? AND estado = 'pagado'
    ) AND NOT EXISTS (
      SELECT 1
      FROM cuotas
      WHERE persona_id = ?
        AND (anio < ? OR (anio = ? AND mes <= ?))
        AND estado <> 'pagado'
    ) AS al_dia
  `, [persona_id, anio, mes, anio, anio, mes]);

exports.recalcularPuntajesAsistencia = persona_id =>
  ejecutar(`
    INSERT INTO puntajes
      (persona_id, asistencia_id, evento_id, puntos, detalle, fecha)
    SELECT
      a.persona_id,
      a.id,
      a.evento_id,
      CASE a.estado
        WHEN 'presente' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 10, 5)
        WHEN 'atrasado' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 7, 3)
        WHEN 'justificado' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 5, 1)
        WHEN 'vestimenta_distinta' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 3, 1)
        WHEN 'licencia_medica' THEN 6
        WHEN 'retiro_sin_aviso' THEN -3
      END,
      CASE a.estado
        WHEN 'presente' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 'Presente + cuota al día', 'Presente sin cuota al día')
        WHEN 'atrasado' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 'Atraso + cuota al día', 'Atraso sin cuota al día')
        WHEN 'justificado' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 'Justificación + cuota al día', 'Justificación sin cuota al día')
        WHEN 'vestimenta_distinta' THEN IF(EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND c.anio=YEAR(e.fecha) AND c.mes=MONTH(e.fecha) AND c.estado='pagado') AND NOT EXISTS (SELECT 1 FROM cuotas c WHERE c.persona_id=a.persona_id AND (c.anio<YEAR(e.fecha) OR (c.anio=YEAR(e.fecha) AND c.mes<=MONTH(e.fecha))) AND c.estado<>'pagado'), 'Vestimenta distinta + cuota al día', 'Vestimenta distinta sin cuota al día')
        WHEN 'licencia_medica' THEN 'Licencia médica'
        WHEN 'retiro_sin_aviso' THEN 'Retiro sin aviso'
      END,
      DATE(e.fecha)
    FROM asistencias a
    JOIN eventos e ON e.id = a.evento_id
    WHERE a.persona_id = ?
      AND a.estado <> 'ausente'
      AND e.nombre NOT LIKE 'Actividad %'
    ON DUPLICATE KEY UPDATE
      persona_id = VALUES(persona_id), evento_id = VALUES(evento_id),
      puntos = VALUES(puntos), detalle = VALUES(detalle), fecha = VALUES(fecha)
  `, [persona_id]);

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
