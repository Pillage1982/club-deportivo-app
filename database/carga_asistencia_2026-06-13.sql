-- Carga manual de asistencia recibida por WhatsApp el 08-08-2026.
-- La actividad se crea con nombre y hora provisionales porque la fuente solo
-- confirma la fecha 13-06-2026. Todos los registros se informaron presentes.
-- Script idempotente: puede ejecutarse nuevamente sin duplicar la actividad,
-- las asistencias. El puntaje queda pendiente de clasificación estatutaria.

SET NAMES utf8mb4;
START TRANSACTION;

SET @descripcion_evento =
  'Carga manual asistencia 2026-06-13; origen WhatsApp 2026-08-08';

INSERT INTO eventos (nombre, tipo, fecha, descripcion, finalizado)
SELECT
  'Actividad 2026-06-13',
  'reunion',
  '2026-06-13 15:00:00',
  @descripcion_evento,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM eventos
  WHERE descripcion = @descripcion_evento
);

SET @evento_id = (
  SELECT id
  FROM eventos
  WHERE descripcion = @descripcion_evento
  ORDER BY id
  LIMIT 1
);

CREATE TEMPORARY TABLE carga_asistencia_20260613 (
  rut VARCHAR(20) PRIMARY KEY
);

INSERT INTO carga_asistencia_20260613 (rut) VALUES
('23074307-K'),
('15982084-K'),
('16683254-3'),
('11333186-0'),
('13357046-2'),
('24011854-8'),
('10374609-4'),
('16450297-K'),
('15982371-7'),
('21361251-4'),
('16549177-7'),
('22104492-4'),
('24217189-6'),
('14308581-3'),
('15982332-6'),
('15982740-2'),
('18183734-9'),
('19825028-7'),
('20974689-1'),
('22536478-8'),
('18234880-5'),
('23483748-6'),
('20348067-9'),
('23511075-K'),
('17392847-5'),
('15013795-0'),
('24145893-8'),
('23631265-8'),
('19539400-8'),
('16867904-1'),
('23274256-9'),
('17724713-8'),
('16203401-4'),
('9270984-1'),
('18362574-8'),
('10241653-8'),
('20347778-3'),
('22708633-5'),
('15740823-2'),
('15981894-2'),
('22773051-K'),
('23807085-6'),
('15981679-6');

INSERT IGNORE INTO asistencias (
  evento_id,
  persona_id,
  estado,
  minutos_atraso,
  fecha_registro
)
SELECT
  @evento_id,
  p.id,
  'presente',
  0,
  '2026-06-13 15:00:00'
FROM carga_asistencia_20260613 c
JOIN personas p
  ON UPPER(REPLACE(REPLACE(p.rut, '.', ''), '-', '')) =
     UPPER(REPLACE(REPLACE(c.rut, '.', ''), '-', ''));

INSERT IGNORE INTO puntajes (
  persona_id,
  asistencia_id,
  evento_id,
  puntos,
  detalle,
  fecha
)
SELECT
  a.persona_id,
  a.id,
  a.evento_id,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM cuotas c
      WHERE c.persona_id = a.persona_id
        AND c.anio = 2026
        AND c.mes = 6
        AND c.estado = 'pagado'
    ) THEN 10
    ELSE 5
  END,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM cuotas c
      WHERE c.persona_id = a.persona_id
        AND c.anio = 2026
        AND c.mes = 6
        AND c.estado = 'pagado'
    ) THEN 'Presente + cuota al día'
    ELSE 'Presente sin cuota al día'
  END,
  '2026-06-13'
FROM asistencias a
WHERE a.evento_id = @evento_id
  AND a.estado = 'presente'
  AND 1 = 0; -- No puntuar con nombre, hora y categoría provisionales.

-- Debe devolver 43 esperados, 43 encontrados y 0 no encontrados.
SELECT
  (SELECT COUNT(*) FROM carga_asistencia_20260613) AS esperados,
  COUNT(p.id) AS encontrados,
  SUM(p.id IS NULL) AS no_encontrados
FROM carga_asistencia_20260613 c
LEFT JOIN personas p
  ON UPPER(REPLACE(REPLACE(p.rut, '.', ''), '-', '')) =
     UPPER(REPLACE(REPLACE(c.rut, '.', ''), '-', ''));

-- Resumen final de asistencias asociadas a la actividad.
SELECT
  @evento_id AS evento_id,
  COUNT(*) AS asistencias_presentes
FROM asistencias
WHERE evento_id = @evento_id
  AND estado = 'presente';

DROP TEMPORARY TABLE carga_asistencia_20260613;

COMMIT;
