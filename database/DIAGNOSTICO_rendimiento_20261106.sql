-- =============================================================================
-- DIAGNÓSTICO DE RENDIMIENTO (SOLO LECTURA) — 2026-11-06
-- App lenta en Tablas (Pagos) y Dashboard tras registrar muchos pagos.
-- Correr en phpMyAdmin (pestaña SQL) y pegar los resultados. No modifica nada.
-- =============================================================================

-- 1) Tamaño de las tablas grandes (cuántas filas hay hoy)
SELECT 'personas'     AS tabla, COUNT(*) AS filas FROM personas
UNION ALL SELECT 'pagos',        COUNT(*) FROM pagos
UNION ALL SELECT 'pago_detalle', COUNT(*) FROM pago_detalle
UNION ALL SELECT 'cuotas',       COUNT(*) FROM cuotas
UNION ALL SELECT 'multas',       COUNT(*) FROM multas
UNION ALL SELECT 'asistencias',  COUNT(*) FROM asistencias
UNION ALL SELECT 'puntajes',     COUNT(*) FROM puntajes
UNION ALL SELECT 'auditoria',    COUNT(*) FROM auditoria
UNION ALL SELECT 'ingresos',     COUNT(*) FROM ingresos
UNION ALL SELECT 'gastos',       COUNT(*) FROM gastos;

-- 2) Índices existentes en las tablas calientes (confirmar que persona_id/pago_id están indexados)
SHOW INDEX FROM pagos;
SHOW INDEX FROM pago_detalle;
SHOW INDEX FROM cuotas;
SHOW INDEX FROM multas;
SHOW INDEX FROM asistencias;
SHOW INDEX FROM puntajes;

-- 3) Plan de ejecución de las dos consultas calientes
--    (busca "ALL" en la columna type = escaneo completo, y "Using temporary"/"Using filesort")

-- 3a) Dashboard: lectura de la vista de estado financiero
EXPLAIN SELECT
  IFNULL(SUM(CASE WHEN deuda_actual > 0 THEN deuda_actual ELSE 0 END), 0) AS deuda_total,
  COUNT(CASE WHEN deuda_actual > 0 THEN 1 END) AS socios_con_deuda
FROM vista_estado_financiero;

-- 3b) Listado de Pagos (trae todos + EXISTS por fila)
EXPLAIN SELECT pa.id, pa.persona_id,
       EXISTS(SELECT 1 FROM pago_detalle d WHERE d.pago_id = pa.id) AS tiene_detalle
FROM pagos pa
JOIN personas p ON pa.persona_id = p.id
ORDER BY pa.fecha DESC;

-- 4) Tamaño en disco de las tablas (MB) y filas, por si alguna creció de más
SELECT table_name AS tabla,
       table_rows AS filas_aprox,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS mb
FROM information_schema.TABLES
WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC
LIMIT 15;
