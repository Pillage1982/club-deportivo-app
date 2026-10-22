// Consultas agregadas del dashboard: reúne métricas financieras, personas, actividades y asistencias.
// Consultas agregadas del dashboard: reúne métricas financieras, personas, actividades y asistencias.
const db = require('../config/db');

exports.obtenerResumen = (callback) => {

  // La vista vista_estado_financiero se lee UNA sola vez (subquery vef)
  // Antes se referenciaba 4 veces = 4 ejecuciones completas de la vista
  const query = `
    SELECT
      (SELECT COUNT(*) FROM personas WHERE activo = 1)       AS total_personas,
      -- Nuevos: ingreso entre septiembre y diciembre del último septiembre
      -- (misma regla que esIntegranteNuevo en frontend/js/personas.js)
      (
        SELECT COUNT(*) FROM personas
        WHERE activo = 1
          AND MONTH(fecha_ingreso) >= 9
          AND YEAR(fecha_ingreso) = YEAR(CURDATE()) - (MONTH(CURDATE()) < 9)
      ) AS total_personas_nuevas,
      (SELECT COUNT(*) FROM eventos)                         AS total_eventos,
      (SELECT COUNT(*) FROM multas WHERE estado = 'pendiente') AS total_multas,
      (
        SELECT IFNULL(SUM(monto_total), 0) FROM pagos
        WHERE MONTH(fecha) = MONTH(CURRENT_DATE())
          AND YEAR(fecha) = YEAR(CURRENT_DATE())
      ) AS pagos_mes,
      (SELECT IFNULL(SUM(monto_total), 0) FROM pagos WHERE tipo_pago <> 'integracion') AS total_pagos_socios,
      (SELECT IFNULL(SUM(monto_total), 0) FROM pagos WHERE tipo_pago = 'integracion')  AS total_pagos_integracion,
      (SELECT IFNULL(SUM(monto), 0)       FROM ingresos) AS total_ingresos_terceros,
      (SELECT IFNULL(SUM(monto), 0)       FROM gastos)   AS total_gastos,
      IFNULL((
        SELECT CAST(valor AS DECIMAL(12,2)) FROM configuracion
        WHERE clave = 'saldo_anio_anterior'
      ), 0) AS saldo_anio_anterior,
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

exports.guardarSaldoAnioAnterior = (monto, usuario, callback) => {
  db.query(`
    INSERT INTO configuracion (clave, valor, actualizado_por)
    VALUES ('saldo_anio_anterior', ?, ?)
    ON DUPLICATE KEY UPDATE valor = VALUES(valor), actualizado_por = VALUES(actualizado_por)
  `, [String(monto), usuario || null], callback);
};
