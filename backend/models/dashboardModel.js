const db = require('../config/db');

exports.obtenerResumen = (callback) => {

  const query = `

    SELECT

      (
        SELECT COUNT(*)
        FROM personas
        WHERE activo = 1
      ) AS total_personas,

      (
        SELECT COUNT(*)
        FROM eventos
      ) AS total_eventos,

      (
        SELECT COUNT(*)
        FROM multas
        WHERE estado = 'pendiente'
      ) AS total_multas,

      (
        SELECT IFNULL(SUM(deuda_actual), 0)
        FROM vista_estado_financiero
        WHERE deuda_actual > 0
      ) AS deuda_total,

      (
        SELECT COUNT(*)
        FROM vista_estado_financiero
        WHERE deuda_actual > 0
      ) AS socios_con_deuda,

      (
        SELECT IFNULL(SUM(total_cuotas), 0)
        FROM vista_estado_financiero
      ) AS cuotas_pendientes,

      (
        SELECT IFNULL(SUM(total_multas), 0)
        FROM vista_estado_financiero
      ) AS multas_pendientes,

      (
        SELECT IFNULL(SUM(monto_total), 0)
        FROM pagos
        WHERE MONTH(fecha) = MONTH(CURRENT_DATE())
        AND YEAR(fecha) = YEAR(CURRENT_DATE())
      ) AS pagos_mes

  `;

  db.query(query, callback);

};