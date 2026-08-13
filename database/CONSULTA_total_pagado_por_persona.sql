-- Suma todos los pagos de cada persona (sin importar el mes ni si estan
-- vinculados a una cuota especifica) para ver quien acumulo $120.000 o mas
-- en la temporada, sin importar como se repartieron los pagos.

SELECT p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno,
       COUNT(pg.id) AS cantidad_pagos,
       SUM(pg.monto_total) AS total_pagado
FROM pagos pg
JOIN personas p ON p.id = pg.persona_id
GROUP BY p.id, p.rut, p.nombres, p.apellido_paterno, p.apellido_materno
HAVING SUM(pg.monto_total) >= 120000
ORDER BY total_pagado DESC, p.apellido_paterno, p.nombres;
