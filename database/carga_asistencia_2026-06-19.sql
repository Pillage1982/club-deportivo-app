-- Carga manual de asistencia recibida por WhatsApp el 08-08-2026.
-- La actividad se crea con nombre y hora provisionales porque la fuente solo
-- confirma la fecha 19-06-2026. Todos los registros se informaron presentes.
-- Script idempotente: puede ejecutarse nuevamente sin duplicar la actividad,
-- las asistencias. El puntaje queda pendiente de clasificación estatutaria.

SET NAMES utf8mb4;
START TRANSACTION;

SET @descripcion_evento =
  'Carga manual asistencia 2026-06-19; origen WhatsApp 2026-08-08';

INSERT INTO eventos (nombre, tipo, fecha, descripcion, finalizado)
SELECT
  'Actividad 2026-06-19',
  'reunion',
  '2026-06-19 18:00:00',
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

CREATE TEMPORARY TABLE carga_asistencia_20260619 (
  rut VARCHAR(20) PRIMARY KEY
);

INSERT INTO carga_asistencia_20260619 (rut) VALUES
('10149031-9'),
('10241653-8'),
('10475062-1'),
('10477250-1'),
('10818566-K'),
('10974306-2'),
('11720981-4'),
('11931690-1'),
('12801555-8'),
('13357046-2'),
('14308581-3'),
('14455768-9'),
('15015920-2'),
('15740823-2'),
('15981894-2'),
('15982332-6'),
('16203401-4'),
('16565345-9'),
('16565483-8'),
('17007660-5'),
('17392847-5'),
('19867652-7'),
('20098976-7'),
('20274853-8'),
('20348067-9'),
('20352620-2'),
('22004189-1'),
('22284026-0'),
('22644907-8'),
('22708633-5'),
('22777575-0'),
('23430795-9'),
('23581373-4'),
('23768663-2'),
('24011854-8'),
('24027170-2'),
('24032738-4'),
('24492108-6'),
('24711866-7'),
('24766846-2'),
('24990962-9'),
('25010509-6'),
('25016245-6'),
('25743573-3'),
('26823404-7'),
('27044985-9'),
('8874579-5'),
('9084008-8'),
('9270984-1');

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
  '2026-06-19 18:00:00'
FROM carga_asistencia_20260619 c
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
  '2026-06-19'
FROM asistencias a
WHERE a.evento_id = @evento_id
  AND a.estado = 'presente'
  AND 1 = 0; -- No puntuar con nombre, hora y categoría provisionales.

-- Debe devolver 49 esperados, 49 encontrados y 0 no encontrados.
SELECT
  (SELECT COUNT(*) FROM carga_asistencia_20260619) AS esperados,
  COUNT(p.id) AS encontrados,
  SUM(p.id IS NULL) AS no_encontrados
FROM carga_asistencia_20260619 c
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

DROP TEMPORARY TABLE carga_asistencia_20260619;

COMMIT;
