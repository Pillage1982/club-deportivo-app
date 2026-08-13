-- Detalle de puntaje por asistencia de Williams Daisuke Rounin Alcayaga
-- Sotomayor (RUT 23749198-K): cada actividad puntuada, su fecha y el motivo.

SELECT
  e.nombre AS actividad,
  e.fecha AS fecha_actividad,
  a.estado AS estado_asistencia,
  a.minutos_atraso,
  pt.puntos,
  pt.detalle,
  pt.fecha AS fecha_puntaje
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
JOIN asistencias a ON a.id = pt.asistencia_id
JOIN eventos e ON e.id = a.evento_id
WHERE p.rut = '23749198-K'
  AND pt.asistencia_id IS NOT NULL
ORDER BY e.fecha;

-- Total de puntos de asistencia (suma de la consulta anterior)
SELECT COALESCE(SUM(pt.puntos), 0) AS total_puntos_asistencia,
       COUNT(pt.id) AS cantidad_actividades_puntuadas
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
WHERE p.rut = '23749198-K'
  AND pt.asistencia_id IS NOT NULL;
