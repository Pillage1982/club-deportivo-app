-- Reinicio financiero: la temporada 2026-2027 parte desde $0.
--
-- Borra TODO lo que sea dinero en las tablas vivas:
--   cuotas, pagos, pago_detalle, multas, gastos, comprobantes_deposito
--   y los puntajes por pago de cuotas (puntajes.cuota_id IS NOT NULL).
--
-- NO toca: personas, asistencias, eventos, puntajes de asistencia,
-- justificaciones, formaciones, usuarios, tipos_cuotas ni las tablas respaldo_*
-- anteriores. El ranking 2026-2027 no cambia: ya corta en la actividad que
-- inicia temporada (Misa a la Chilena 26-09-2026) y no había puntaje por
-- cuotas de esta temporada.
--
-- Contenido según el respaldo de producción del 03-10-2026 16:50
-- (u402516660_Diablada_BD.sql):
--   cuotas                4.370  (oct-2025 a jul-2026, temporada 2025-2026)
--   pagos                   460  ($23.318.000, oct-2025 a jul-2026)
--   pago_detalle          1.998
--   multas                  581  (sep/oct-2026, todas pendientes)
--   puntajes por cuotas   2.074
--   gastos                    0
--   comprobantes_deposito     0
--
-- Las multas quedan además deshabilitadas en la app (backend/config/multas.js
-- y APP_CONFIG.multas en frontend/js/config.js): no se generan al registrar
-- asistencia ni al cerrar actividades, y no se muestran en ninguna pantalla.
--
-- Las cuotas de la temporada 2026-2027 (oct-2026 a jul-2027) NO se generan
-- aquí: se generan después desde el panel.
--
-- Reemplaza a CORRECCION_cuotas_socios_temporada_2025_2026_20261002.sql y
-- CORRECCION_repartir_saldo_socios_20261002.sql (corregían cuotas que este
-- script elimina): ya no hay que ejecutarlos.
--
-- ORDEN: ejecutar primero en la BD de pruebas (u402516660_Diablada_dev),
-- revisar el PASO 0 y el PASO 3, y recién después repetir en producción.
-- Antes de producción, descargar un respaldo nuevo desde phpMyAdmin.

-- ============================================================
-- PASO 0 (solo lectura): lo que se va a borrar
-- (comparar con las cifras de arriba; si hay más filas es porque se
-- registró algo después del respaldo, revisarlo antes de seguir)
-- ============================================================
SELECT 'cuotas' AS tabla, COUNT(*) AS filas, COALESCE(SUM(monto), 0) AS monto FROM cuotas
UNION ALL SELECT 'pagos', COUNT(*), COALESCE(SUM(monto_total), 0) FROM pagos
UNION ALL SELECT 'pago_detalle', COUNT(*), COALESCE(SUM(monto_pagado), 0) FROM pago_detalle
UNION ALL SELECT 'multas', COUNT(*), COALESCE(SUM(monto), 0) FROM multas
UNION ALL SELECT 'gastos', COUNT(*), COALESCE(SUM(monto), 0) FROM gastos
UNION ALL SELECT 'comprobantes_deposito', COUNT(*), COALESCE(SUM(monto), 0) FROM comprobantes_deposito
UNION ALL SELECT 'puntajes por cuotas', COUNT(*), COALESCE(SUM(puntos), 0) FROM puntajes WHERE cuota_id IS NOT NULL;

-- ============================================================
-- PASO 1: respaldo dentro de la misma BD
-- (CREATE TABLE confirma la transacción en curso: por eso va antes del
-- START TRANSACTION. Si una tabla ya existe, el script se detiene aquí sin
-- borrar nada.)
-- ============================================================
CREATE TABLE respaldo_reinicio_20261003_cuotas                AS SELECT * FROM cuotas;
CREATE TABLE respaldo_reinicio_20261003_pagos                 AS SELECT * FROM pagos;
CREATE TABLE respaldo_reinicio_20261003_pago_detalle          AS SELECT * FROM pago_detalle;
CREATE TABLE respaldo_reinicio_20261003_multas                AS SELECT * FROM multas;
CREATE TABLE respaldo_reinicio_20261003_gastos                AS SELECT * FROM gastos;
CREATE TABLE respaldo_reinicio_20261003_comprobantes_deposito AS SELECT * FROM comprobantes_deposito;
CREATE TABLE respaldo_reinicio_20261003_puntajes_cuotas       AS SELECT * FROM puntajes WHERE cuota_id IS NOT NULL;

-- ============================================================
-- PASO 2: borrado
-- ============================================================
START TRANSACTION;

DELETE FROM pago_detalle;
DELETE FROM pagos;
DELETE FROM puntajes WHERE cuota_id IS NOT NULL;
DELETE FROM multas;
DELETE FROM cuotas;
DELETE FROM gastos;
DELETE FROM comprobantes_deposito;

COMMIT;

-- ============================================================
-- PASO 3 (solo lectura): verificación
-- Todo en 0, y los respaldos con las mismas filas del PASO 0.
-- ============================================================
SELECT 'cuotas' AS tabla, COUNT(*) AS filas FROM cuotas
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL SELECT 'pago_detalle', COUNT(*) FROM pago_detalle
UNION ALL SELECT 'multas', COUNT(*) FROM multas
UNION ALL SELECT 'gastos', COUNT(*) FROM gastos
UNION ALL SELECT 'comprobantes_deposito', COUNT(*) FROM comprobantes_deposito
UNION ALL SELECT 'puntajes por cuotas', COUNT(*) FROM puntajes WHERE cuota_id IS NOT NULL
UNION ALL SELECT 'puntajes de asistencia (se conservan)', COUNT(*) FROM puntajes WHERE asistencia_id IS NOT NULL;

SELECT 'respaldo cuotas' AS tabla, COUNT(*) AS filas FROM respaldo_reinicio_20261003_cuotas
UNION ALL SELECT 'respaldo pagos', COUNT(*) FROM respaldo_reinicio_20261003_pagos
UNION ALL SELECT 'respaldo pago_detalle', COUNT(*) FROM respaldo_reinicio_20261003_pago_detalle
UNION ALL SELECT 'respaldo multas', COUNT(*) FROM respaldo_reinicio_20261003_multas
UNION ALL SELECT 'respaldo gastos', COUNT(*) FROM respaldo_reinicio_20261003_gastos
UNION ALL SELECT 'respaldo comprobantes_deposito', COUNT(*) FROM respaldo_reinicio_20261003_comprobantes_deposito
UNION ALL SELECT 'respaldo puntajes por cuotas', COUNT(*) FROM respaldo_reinicio_20261003_puntajes_cuotas;

-- ============================================================
-- REVERSA (solo si hay que deshacer; dejar comentado)
-- ============================================================
-- START TRANSACTION;
-- INSERT INTO cuotas                SELECT * FROM respaldo_reinicio_20261003_cuotas;
-- INSERT INTO pagos                 SELECT * FROM respaldo_reinicio_20261003_pagos;
-- INSERT INTO pago_detalle          SELECT * FROM respaldo_reinicio_20261003_pago_detalle;
-- INSERT INTO multas                SELECT * FROM respaldo_reinicio_20261003_multas;
-- INSERT INTO gastos                SELECT * FROM respaldo_reinicio_20261003_gastos;
-- INSERT INTO comprobantes_deposito SELECT * FROM respaldo_reinicio_20261003_comprobantes_deposito;
-- INSERT INTO puntajes              SELECT * FROM respaldo_reinicio_20261003_puntajes_cuotas;
-- COMMIT;
