-- Todos los pagos y su detalle para Daniela Dubos Rojas (18234880-5),
-- para identificar exactamente cual es el pago de julio con el error
-- de tipeo antes de eliminarlo.

SELECT pg.id AS pago_id, pg.monto_total, pg.metodo, pg.fecha, pg.fecha_precision,
       pg.referencia_externa,
       pd.id AS detalle_id, pd.tipo, pd.referencia_id AS cuota_id, pd.monto_pagado,
       c.anio, c.mes, c.monto AS monto_cuota, c.estado AS estado_cuota
FROM pagos pg
JOIN personas p ON p.id = pg.persona_id
LEFT JOIN pago_detalle pd ON pd.pago_id = pg.id
LEFT JOIN cuotas c ON pd.tipo = 'cuota' AND c.id = pd.referencia_id
WHERE p.rut = '18234880-5'
ORDER BY pg.fecha, pg.id;

-- Puntajes de cuotas de la misma persona, para ver si alguno quedaria huerfano
SELECT pt.id, pt.cuota_id, pt.puntos, pt.detalle, pt.fecha, c.anio, c.mes
FROM puntajes pt
JOIN personas p ON p.id = pt.persona_id
LEFT JOIN cuotas c ON c.id = pt.cuota_id
WHERE p.rut = '18234880-5' AND pt.cuota_id IS NOT NULL
ORDER BY c.anio, c.mes;
