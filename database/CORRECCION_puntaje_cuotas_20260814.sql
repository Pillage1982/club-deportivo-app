-- Correccion del puntaje de cuotas (Art. 9.2/9.3 Estatutos GDC 2016) para TODOS
-- los integrantes que pagan cuotas, en TODOS los bloques del club.
--
-- CONTEXTO: la carga masiva historica de agosto-2026 (generate-gdc-refresh-sql.py)
-- le dio 10 puntos base a CUALQUIER cuota pagada, sin importar si se pago atrasada.
-- Esto contradice el Art. 9.3: una cuota pagada fuera de plazo no debe sumar puntos.
-- El modelo correcto (el mismo que ya usa pagoController.calcularPuntosCuota en el
-- flujo en vivo) es:
--   pagada ANTES del mes de la cuota      -> 20 puntos (anticipado)
--   pagada EN el mismo mes de la cuota    -> 10 puntos (oportuno)
--   pagada DESPUES del mes de la cuota    ->  0 puntos (atrasado, sin puntaje)
-- Cuando una cuota se completa con varios pagos parciales, se usa el pago MAS
-- RECIENTE (el que la deja en estado 'pagado') para determinar el mes real.
--
-- VALIDACION: se corrio este mismo calculo contra un respaldo de produccion del
-- 2026-08-14 y se comparo persona por persona contra las cuadraturas manuales que
-- hicieron los lideres de los bloques Diablesas, Diablos y Chinas Supay (198
-- integrantes). El modelo general (Parte 1+2) reprodujo el total exacto de 147/198
-- (74%) sin ningun ajuste puntual. Con los 17 ajustes puntuales de la Parte 3
-- (10 de cuotas + 7 de asistencia) se llega a 161/198 (81%) con el total EXACTO
-- de cuotas y asistencia coincidiendo en 197 de 198 personas (todas salvo
-- Urquieta, dejada a proposito con el valor de la formula general). Las 35
-- diferencias que quedan en el total final son EXCLUSIVAMENTE por antiguedad
-- (fecha_ingreso, fuera del alcance de esta tabla) mas 1 caso donde el error
-- estaba en la propia cuadratura (Saldias, confirmado que la BD ya estaba bien).
-- Ver database/CORRECCION_puntaje_cuotas_20260814_NOTAS.md para el detalle
-- completo de la comparacion.
--
-- IMPORTANTE: los IDs usados en los ajustes puntuales de la Parte 3 vienen de un
-- respaldo de produccion exportado el 2026-08-14. Si se cargaron pagos/cuotas
-- nuevos en produccion despues de ese respaldo, esos IDs pueden no corresponder
-- a las mismas personas -- revisar antes de ejecutar si paso mucho tiempo.
--
-- No toca: puntos de asistencia (salvo los 7 ajustes puntuales de la Parte 3) ni
-- antiguedad (se calcula en vivo desde personas.fecha_ingreso, no esta en esta tabla).


-- =====================================================================
-- PARTE 0: RESPALDO (ejecutar primero, siempre)
-- =====================================================================
CREATE TABLE IF NOT EXISTS respaldo_puntajes_cuotas_20260814 AS
SELECT * FROM puntajes WHERE cuota_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS respaldo_puntajes_asistencia_20260814 AS
SELECT * FROM puntajes WHERE asistencia_id IS NOT NULL;


-- =====================================================================
-- PARTE 1: correccion general de TODAS las cuotas pagadas del club
-- =====================================================================
UPDATE puntajes pt
JOIN cuotas c ON c.id = pt.cuota_id
JOIN (
  SELECT d.referencia_id AS cuota_id, MAX(p.fecha) AS fecha_completada
  FROM pago_detalle d
  JOIN pagos p ON p.id = d.pago_id
  WHERE d.tipo = 'cuota'
  GROUP BY d.referencia_id
) fc ON fc.cuota_id = c.id
SET
  pt.puntos = CASE
    WHEN YEAR(fc.fecha_completada) < c.anio
      OR (YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) < c.mes) THEN 20
    WHEN YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) = c.mes THEN 10
    ELSE 0
  END,
  pt.detalle = CASE
    WHEN YEAR(fc.fecha_completada) < c.anio
      OR (YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) < c.mes)
      THEN CONCAT('Cuota ', LPAD(c.mes,2,'0'), '/', c.anio, ' pagada anticipadamente (correccion 2026-08-14)')
    WHEN YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) = c.mes
      THEN CONCAT('Cuota ', LPAD(c.mes,2,'0'), '/', c.anio, ' pagada oportunamente (correccion 2026-08-14)')
    ELSE CONCAT('Cuota ', LPAD(c.mes,2,'0'), '/', c.anio, ' pagada atrasada, sin puntaje (correccion 2026-08-14)')
  END
WHERE c.estado = 'pagado';

-- Cuotas 'pagado' que por algun motivo no tengan fila en puntajes todavia
-- (defensivo -- en el respaldo de referencia no se encontro ningun caso, pero
-- production puede haber cambiado desde entonces).
INSERT INTO puntajes (persona_id, cuota_id, puntos, detalle, fecha)
SELECT c.persona_id, c.id,
  CASE
    WHEN YEAR(fc.fecha_completada) < c.anio
      OR (YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) < c.mes) THEN 20
    WHEN YEAR(fc.fecha_completada) = c.anio AND MONTH(fc.fecha_completada) = c.mes THEN 10
    ELSE 0
  END,
  CONCAT('Cuota ', LPAD(c.mes,2,'0'), '/', c.anio, ' -- puntaje generado en correccion 2026-08-14'),
  DATE(fc.fecha_completada)
FROM cuotas c
JOIN (
  SELECT d.referencia_id AS cuota_id, MAX(p.fecha) AS fecha_completada
  FROM pago_detalle d JOIN pagos p ON p.id = d.pago_id
  WHERE d.tipo = 'cuota' GROUP BY d.referencia_id
) fc ON fc.cuota_id = c.id
LEFT JOIN puntajes pt ON pt.cuota_id = c.id
WHERE c.estado = 'pagado' AND pt.id IS NULL;


-- =====================================================================
-- PARTE 2: bono escenario (a) Art. 9.3 -- temporada completa pagada de una
-- sola vez dentro de octubre 2025. La cuota de octubre pasa de 10 a 20.
-- (misma condicion que ya usa ajustarPagoAnualInicioCiclo en migrations.js)
-- =====================================================================
UPDATE puntajes pt
JOIN cuotas c ON c.id = pt.cuota_id
JOIN pago_detalle d ON d.tipo = 'cuota' AND d.referencia_id = c.id
JOIN pagos pg ON pg.id = d.pago_id
JOIN (
  SELECT d2.pago_id
  FROM pago_detalle d2
  WHERE d2.tipo = 'cuota'
  GROUP BY d2.pago_id
  HAVING COUNT(DISTINCT d2.referencia_id) = 10
     AND SUM(d2.monto_pagado) >= 120000
) anual ON anual.pago_id = pg.id
SET pt.puntos = 20,
    pt.detalle = 'Cuota pagada anticipadamente (art. 9.3, pago anual al inicio) [correccion 2026-08-14]'
WHERE c.anio = 2025 AND c.mes = 10
  AND YEAR(pg.fecha) = 2025 AND MONTH(pg.fecha) = 10
  AND pg.monto_total >= 120000
  AND pt.puntos = 10;


-- =====================================================================
-- PARTE 3: ajustes puntuales validados contra las cuadraturas manuales de
-- Diablesas / Diablos / Chinas Supay. Ejecutar DESPUES de las partes 1 y 2
-- (la resta/suma es relativa al valor que dejaron los pasos anteriores).
-- =====================================================================

-- --- Cuotas: la formula general no reproduce el total de la cuadratura ---

-- 15981679-6 León María José De Guadalupe (Chinas Supay): total cuotas segun cuadratura = 30
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 41860;

-- 16867904-1 Zamora Viviana Stefany (Chinas Supay): total cuotas segun cuadratura = 40
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 42137;

-- 18234880-5 Dubos Daniela del Carmen (Chinas Supay): total cuotas segun cuadratura = 130
UPDATE puntajes SET puntos = puntos + (-50), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 42567;

-- 19463396-3 Anza Valeria Camila (Chinas Supay): total cuotas segun cuadratura = 10
UPDATE puntajes SET puntos = puntos + (10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 42745;

-- 19825028-7 Maluenda Nayara Ivonne (Chinas Supay): total cuotas segun cuadratura = 10
UPDATE puntajes SET puntos = puntos + (10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 42852;

-- 20274334-K Urquieta Conny Alexandra (Chinas Supay): EXCLUIDA a proposito.
-- Su fila en la cuadratura tiene "Pago al dia"/"Pago anticipado" en blanco (no "0"
-- escrito) pese a tener Monto Pagado=120000 -- la lideresa de bloque no alcanzo a
-- revisar sus cuotas. No se fuerza a 0: queda con el valor de la formula general
-- (150) hasta que se confirme el numero real con el bloque.

-- 20348067-9 Ibaceta Nataly Fernanda (Chinas Supay): total cuotas segun cuadratura = 60
UPDATE puntajes SET puntos = puntos + (40), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 43084;

-- 22761503-6 Becerra Angello Benjamin (Diablos): total cuotas segun cuadratura = 80
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 43852;

-- 22951452-0 Avila Tadish Belen Alicia (Chinas Supay): total cuotas segun cuadratura = 60
UPDATE puntajes SET puntos = puntos + (10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 43934;

-- 23457709-3 Cortes Naomi Amaral (Chinas Supay): total cuotas segun cuadratura = 110
UPDATE puntajes SET puntos = puntos + (-40), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 44105;

-- 23454852-2 Carrillo Catalina (Diablesas): total cuotas segun cuadratura = 0
-- (detectada en la verificacion final, no en la primera pasada: quedaba enmascarada
-- porque esta misma persona tambien tenia un problema de asistencia)
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE cuota_id = 44090;

-- --- Asistencia: la BD no coincide ni con el resumen ni con el detalle de la cuadratura ---

-- 10477250-1 Teran Patricia Sandra (Chinas Supay): total asistencia segun cuadratura = 60
UPDATE puntajes SET puntos = puntos + (-40), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 5844;

-- 15015920-2 Gajardo Marcela Veronica (Chinas Supay): total asistencia segun cuadratura = 25
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 6105;

-- 20347778-3 Aguilera Carolina Andrea (Chinas Supay): total asistencia segun cuadratura = 45
UPDATE puntajes SET puntos = puntos + (-30), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 6617;

-- 21186873-2 Cruz Daniela Emilia (Chinas Supay): total asistencia segun cuadratura = 35
UPDATE puntajes SET puntos = puntos + (-25), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 6711;

-- 23454852-2 Carrillo Catalina (Diablesas): total asistencia segun cuadratura = 20
UPDATE puntajes SET puntos = puntos + (-10), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 7085;

-- 24145893-8 Carvajal Javiera Paz (Chinas Supay): total asistencia segun cuadratura = 50
UPDATE puntajes SET puntos = puntos + (-25), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 7220;

-- 7886094-4 Barraza Minda Martina (Chinas Supay): total asistencia segun cuadratura = 40
UPDATE puntajes SET puntos = puntos + (-15), detalle = CONCAT(detalle, ' [ajuste manual cuadratura de bloque]') WHERE asistencia_id = 7555;


-- =====================================================================
-- PARTE 4: verificacion -- correr despues y revisar contra las cuadraturas
-- =====================================================================
SELECT
  p.rut, p.apellido_paterno, p.nombres, p.bloque,
  CASE WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
       ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE()) END AS puntos_antiguedad,
  COALESCE(SUM(CASE WHEN pt.cuota_id IS NOT NULL THEN pt.puntos ELSE 0 END),0) AS puntos_cuotas,
  COALESCE(SUM(CASE WHEN pt.asistencia_id IS NOT NULL THEN pt.puntos ELSE 0 END),0) AS puntos_asistencia,
  COALESCE(SUM(pt.puntos),0) + CASE WHEN p.fecha_ingreso IS NULL OR p.fecha_ingreso > CURDATE() THEN 0
       ELSE TIMESTAMPDIFF(YEAR, p.fecha_ingreso, CURDATE()) END AS puntaje_total
FROM personas p
LEFT JOIN puntajes pt ON pt.persona_id = p.id
WHERE p.bloque IN ('Diablesas','Diablos','Chinas Supay')
GROUP BY p.id, p.rut, p.apellido_paterno, p.nombres, p.bloque, p.fecha_ingreso
ORDER BY p.bloque, p.apellido_paterno;
