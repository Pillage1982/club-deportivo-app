# Cambios V1 RC

## 2026-06-02

### Login
- Separado HTML, CSS y JS.
- Agregado botón mostrar/ocultar contraseña.
- Agregadas alertas Bootstrap.
- Corregido ingreso mediante Enter.

### Base de Datos
- Creado schema_v0.sql.
- Creado schema_v1_rc.sql.
- Creado respaldo_v1_rc.sql.

### Git
- Commit oficial: c5adf92 Version 1.0 RC - Base estable.

 ## Cuotas automáticas

- Se creó el módulo backend de cuotas.
- Se agregó la ruta POST /cuotas/generar.
- El sistema genera cuotas mensuales para socios activos.
- Se evita duplicar cuotas por persona, mes y año.
- Se agregó consulta para listar cuotas generadas.