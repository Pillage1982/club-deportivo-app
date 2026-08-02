const db = require('../config/db');

exports.obtenerResumen = (callback) => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM personas WHERE activo = 1) AS total_personas,
      (SELECT COUNT(*) FROM eventos) AS total_eventos,
      (SELECT COUNT(*) FROM eventos WHERE finalizado = 0 AND fecha >= NOW()) AS proximas_actividades,
      (SELECT COUNT(*) FROM multas WHERE estado = 'pendiente') AS total_multas,
      (SELECT IFNULL(SUM(monto_total), 0) FROM pagos) AS total_pagado,
      (SELECT COUNT(*) FROM cuotas WHERE estado IN ('pendiente', 'vencido')) AS cuotas_pendientes,
      vef.deuda_total,
      ast.total_asistencias,
      ast.asistencias_con_problema,
      ast.ensayos_total,
      ast.ensayos_presentes,
      ast.presentaciones_total,
      ast.presentaciones_presentes
    FROM (
      SELECT IFNULL(SUM(CASE WHEN deuda_actual > 0 THEN deuda_actual ELSE 0 END), 0) AS deuda_total
      FROM vista_estado_financiero
    ) vef
    CROSS JOIN (
      SELECT
        COUNT(*) AS total_asistencias,
        SUM(CASE WHEN a.estado IN ('ausente', 'atrasado') THEN 1 ELSE 0 END) AS asistencias_con_problema,
        SUM(CASE WHEN e.tipo = 'entrenamiento' THEN 1 ELSE 0 END) AS ensayos_total,
        SUM(CASE WHEN e.tipo = 'entrenamiento' AND a.estado IN ('presente', 'atrasado') THEN 1 ELSE 0 END) AS ensayos_presentes,
        SUM(CASE WHEN e.tipo = 'partido' THEN 1 ELSE 0 END) AS presentaciones_total,
        SUM(CASE WHEN e.tipo = 'partido' AND a.estado IN ('presente', 'atrasado') THEN 1 ELSE 0 END) AS presentaciones_presentes
      FROM asistencias a
      JOIN eventos e ON e.id = a.evento_id
    ) ast
  `;

  db.query(query, callback);
};
