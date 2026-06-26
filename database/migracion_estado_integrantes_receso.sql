-- Agrega estado operacional a integrantes existentes.
-- activo: participa en asistencia y generacion de cuotas.
-- receso: permanece en la agrupacion, pero queda pausado para asistencia y cuotas nuevas.
-- inactivo: baja logica usada al eliminar.

ALTER TABLE personas
  ADD COLUMN estado ENUM('activo', 'receso', 'inactivo') DEFAULT 'activo' AFTER activo;

UPDATE personas
SET estado = CASE
  WHEN activo = 1 THEN 'activo'
  ELSE 'inactivo'
END
WHERE estado IS NULL OR estado = '';

DROP VIEW IF EXISTS vista_estado_financiero;

CREATE VIEW vista_estado_financiero AS

SELECT

  p.id,

  p.nombres,

  p.apellido_paterno,

  p.apellido_materno,

  COALESCE(m.total_multas, 0) AS total_multas,

  COALESCE(c.total_cuotas, 0) AS total_cuotas,

  COALESCE(pg.total_pagado, 0) AS total_pagado,

  (
    COALESCE(m.total_multas, 0)
    +
    COALESCE(c.total_cuotas, 0)
    -
    COALESCE(pg.total_pagado, 0)
  ) AS deuda_actual

FROM personas p

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto) AS total_multas

  FROM multas

  WHERE estado = 'pendiente'

  GROUP BY persona_id

) m

ON p.id = m.persona_id

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto) AS total_cuotas

  FROM cuotas

  WHERE estado IN (
    'pendiente',
    'vencido'
  )

  GROUP BY persona_id

) c

ON p.id = c.persona_id

LEFT JOIN (

  SELECT
    persona_id,
    SUM(monto_total) AS total_pagado

  FROM pagos

  GROUP BY persona_id

) pg

ON p.id = pg.persona_id

WHERE
  p.activo = 1
  AND
  COALESCE(p.estado, 'activo') = 'activo';
