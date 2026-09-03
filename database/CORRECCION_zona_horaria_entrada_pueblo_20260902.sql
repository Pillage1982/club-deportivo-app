-- Corrección retroactiva de zona horaria en asistencias del evento
-- "Entrada de Pueblo 2026" (evento_id = 127, fecha 2026-09-02).
--
-- Causa raíz: fecha_registro se llenaba con DEFAULT CURRENT_TIMESTAMP de
-- MySQL, evaluado en UTC (zona por defecto del servidor de Hostinger), no
-- en hora de Chile. El backend nunca mandaba un timestamp explícito en el
-- INSERT. Fix de código (ya en producción, commit e6e4155 en
-- cliente/calamena, backend/config/db.js): cada conexión nueva del pool fija
-- `SET time_zone` a la hora de Chile calculada con Intl, así que los
-- registros hechos DESDE ese deploy en adelante ya quedan correctos. Este
-- script corrige solo lo que se guardó ANTES del deploy, dentro de este
-- evento puntual.
--
-- Corte encontrado en el respaldo de la tabla completa (asistencias.sql,
-- exportado 03-09-2026 02:09:41): el commit del fix quedó a las 21:42:42
-- hora Chile, y la última fila mal guardada (id 8491) muestra
-- '2026-09-03 01:42:22' — casi exactamente 4h después, es decir la
-- primera fila ya correcta (id 8492) muestra '2026-09-02 21:43:39'.
-- Confirma que el deploy automático (webhook) tomó efecto ahí.
--
-- Alcance: evento_id = 127 tiene 165 filas en total. 136 (id 8338–8491)
-- estaban desfasadas +4h (UTC, sin cruce de horario de verano/invierno
-- porque todas caen en la misma tarde/noche); las otras 29 (id 8492–8523)
-- ya estaban correctas y no se tocaron.
--
-- No cubre: el resto del histórico (otros eventos, pagos, multas, cuotas,
-- personas, formaciones) con el mismo problema de zona horaria — queda
-- pendiente, a corregir evento por evento o en un lote más grande cuando
-- se cierre el registro de asistencia y se levante la moratoria de
-- escritura en BD.
--
-- EJECUTADO el 03-09-2026 por el cliente (Mario Riquelme), con respaldo
-- previo de la tabla `asistencias` completa (asistencias.sql). Se deja
-- este script como registro del cambio, no para volver a correr.
--
-- Nota aparte, mismo evento: también se eliminó un registro erróneo
-- (Natalya Noemi Tapia Maldonado, RUT 21086497-0, id 8337) antes de esta
-- corrección de horario, sin relación con el bug de zona horaria.

UPDATE asistencias
SET fecha_registro = fecha_registro - INTERVAL 4 HOUR
WHERE evento_id = 127
  AND id <= 8491;

-- Verificación posterior (confirmado OK): las 165 filas del evento quedaron
-- con horas coherentes de la tarde/noche del 2 de septiembre, sin saltos.
-- SELECT id, fecha_registro FROM asistencias WHERE evento_id = 127 ORDER BY id;
