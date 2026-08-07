# Importación GDC

Herramienta monocliente y conservadora para preparar la migración desde los cuatro Excel oficiales. El modo seguro usa una instantánea SQL local de `personas`; no abre una conexión remota ni modifica datos.

## Dry-run

```powershell
node backend/scripts/gdc-migration/cli.js --dry-run --organization=gdc --db-snapshot="gdc_personas_junio2026.sql" --members-file="C:\Users\Admin\Downloads\Nomina GDC 2026 (1).xlsx" --payments-file="C:\Users\Admin\Downloads\Estado Finaciero Cuotas GDC 2026.xlsx" --attendance-file="C:\Users\Admin\Downloads\Asistencia GDC.xlsx" --positions-file="C:\Users\Admin\Downloads\Planilla Posiciones 2025 pd.xlsx" --report-dir="reports\gdc"
```

`--apply` se rechaza deliberadamente en esta versión hasta que el operador conecte una BD no productiva, ejecute la migración de auditoría, genere respaldo y revise `revision_manual.xlsx`. Esta protección evita una aplicación accidental contra producción.

## Reversión prevista

Cada inserción aplicada debe llevar `lote_id` y `referencia_externa`; la reversión se ejecuta en una transacción, eliminando primero detalles dependientes del lote y luego el lote. Antes de aplicar, use `mysqldump` para `personas`, `pagos`, `pago_detalle`, `cuotas`, `eventos`, `asistencias` y `puntajes`.
