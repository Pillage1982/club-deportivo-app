const db = require('../config/db');

exports.obtenerResumen = (callback) => {

  // La vista vista_estado_financiero se lee UNA sola vez (subquery vef)
  // Antes se referenciaba 4 veces = 4 ejecuciones completas de la vista
  const query = `
    SELECT
      (SELECT COUNT(*) FROM personas WHERE activo = 1)       AS total_personas,
      (SELECT COUNT(*) FROM eventos)                         AS total_eventos,
      (SELECT COUNT(*) FROM multas WHERE estado = 'pendiente') AS total_multas,
      (
        SELECT IFNULL(SUM(monto_total), 0) FROM pagos
        WHERE MONTH(fecha) = MONTH(CURRENT_DATE())
          AND YEAR(fecha) = YEAR(CURRENT_DATE())
      ) AS pagos_mes,
      vef.deuda_total,
      vef.socios_con_deuda,
      vef.cuotas_pendientes,
      vef.multas_pendientes
    FROM (
      SELECT
        IFNULL(SUM(CASE WHEN deuda_actual > 0 THEN deuda_actual ELSE 0 END), 0) AS deuda_total,
        COUNT(CASE WHEN deuda_actual > 0 THEN 1 END)                             AS socios_con_deuda,
        IFNULL(SUM(total_cuotas), 0)                                             AS cuotas_pendientes,
        IFNULL(SUM(total_multas), 0)                                             AS multas_pendientes
      FROM vista_estado_financiero
    ) vef
  `;

  db.query(query, callback);

};
