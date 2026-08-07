# Importación final GDC 2025–2026

Archivo a importar: `seed_gdc_calamena_final.sql`.

## Antes de importar

1. Seleccionar en phpMyAdmin la base `u193403304_club_dev`.
2. Exportar un respaldo SQL completo, aunque las tablas operacionales estén vacías.
3. Abrir la pestaña SQL y ejecutar `ROLLBACK;` para cerrar cualquier transacción fallida anterior.
4. No usar las semillas anteriores de reemplazo total.

## Importación

Usar la pestaña **Importar**, seleccionar `seed_gdc_calamena_final.sql`, mantener UTF-8 y ejecutar una sola vez. No copiar el archivo por fragmentos en la consola SQL.

La semilla no elimina personas, eventos, asistencias, cuotas ni pagos. Consolida los tipos duplicados llamados `Mensualidad`, agrega metadatos de precisión mensual a pagos y registra el lote `gdc-2025-2026-v1`.

## Resultado esperado

- Personas: 472.
- Eventos: 23.
- Asistencias: 1.804.
- Cuotas: 5.136.
- Pagos: 386.
- Detalles de pago: 1.917.
- Tipos llamados `Mensualidad`: 1.
- Lote `gdc-2025-2026-v1`: `aplicado`.
- Los 5 registros de asistencia con RUT no resuelto permanecen excluidos.

## Comprobación posterior

```sql
SELECT 'personas' entidad, COUNT(*) total FROM personas
UNION ALL SELECT 'eventos', COUNT(*) FROM eventos
UNION ALL SELECT 'asistencias', COUNT(*) FROM asistencias
UNION ALL SELECT 'cuotas', COUNT(*) FROM cuotas
UNION ALL SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL SELECT 'pago_detalle', COUNT(*) FROM pago_detalle
UNION ALL SELECT 'puntajes', COUNT(*) FROM puntajes;

SELECT identificador, estado, fecha_importacion
FROM importacion_lotes
WHERE identificador='gdc-2025-2026-v1';

SELECT nombre, COUNT(*) cantidad
FROM tipos_cuotas
WHERE nombre='Mensualidad'
GROUP BY nombre;

SELECT COUNT(*) asistencias_huerfanas
FROM asistencias a
LEFT JOIN personas p ON p.id=a.persona_id
LEFT JOIN eventos e ON e.id=a.evento_id
WHERE p.id IS NULL OR e.id IS NULL;

SELECT COUNT(*) detalles_huerfanos
FROM pago_detalle d
LEFT JOIN pagos pg ON pg.id=d.pago_id
LEFT JOIN cuotas c ON d.tipo='cuota' AND c.id=d.referencia_id
WHERE pg.id IS NULL OR (d.tipo='cuota' AND c.id IS NULL);
```

Los dos conteos de registros huérfanos deben ser cero. Si la importación muestra un error antes del `COMMIT`, ejecutar `ROLLBACK;`, guardar la captura completa del error y no volver a ejecutar otra semilla hasta corregirla.
