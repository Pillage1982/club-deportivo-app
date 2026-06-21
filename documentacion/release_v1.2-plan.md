# Plan v1.2 - Usabilidad Operativa

## Objetivo

Mejorar el uso diario de NexoComunidad sin cambiar la arquitectura principal ni romper la base estable v1.1.

## Rama de Trabajo

```text
v1.2-dev
```

La rama se crea desde `main` y se prueba en ambiente neutral antes de promover.

## Enfoque

La version v1.2 se enfoca en:

- busquedas,
- filtros,
- tablas mas faciles de leer,
- mejoras de formularios,
- dashboard mas util por rol.

## Prioridad 1 - Busquedas y Filtros

### Integrantes

- Buscar por nombre.
- Buscar por RUT.
- Filtrar activos/inactivos si el dato esta disponible.
- Mantener botones de accion visibles segun rol.

### Actividades

- Buscar por nombre.
- Filtrar por tipo.
- Filtrar por fecha.
- Mostrar fecha y hora de forma clara.

### Pagos y Cuotas

- Filtrar por integrante.
- Filtrar por estado.
- Filtrar por periodo.

### Finanzas

- Filtrar integrantes con deuda.
- Filtrar integrantes al dia.
- Mantener totales claros.

## Prioridad 2 - Tablas

- Usar badges para estados.
- Mejorar formato de montos.
- Mejorar formato de fechas.
- Mantener acciones editar/eliminar compactas.
- Evitar que tablas sean incomodas en movil.

## Prioridad 3 - Dashboard por Rol

### Admin

- Total integrantes.
- Actividades recientes.
- Asistencias recientes.
- Deuda total.
- Pagos recientes.

### Tesorero

- Total pagado.
- Deuda pendiente.
- Cuotas pendientes.
- Multas pendientes.
- Pagos recientes.

### Encargado

- Proximas actividades.
- Asistencias recientes.
- Ausentes o atrasados.
- Integrantes activos.

## Prioridad 4 - Formularios

- Deshabilitar boton mientras se guarda.
- Mostrar errores claros.
- Mantener formulario limpio despues de guardar.
- Evitar doble envio accidental.
- Confirmar eliminaciones con modal.

## Reglas

- No mezclar personalizaciones de clientes en `v1.2-dev`.
- No tocar `cliente/calamena` salvo mejoras reutilizables seleccionadas.
- No cambiar nombres internos de tablas/rutas sin migracion planificada.
- No romper `main`.
- Probar en `devnexo.pillageweb.cl` antes de promover.

## Checklist de Validacion

- Login admin probado.
- Login tesorero probado.
- Login encargado probado.
- Busqueda de integrantes funciona.
- Filtros de actividades funcionan.
- Tablas se ven bien en desktop.
- Tablas se ven bien en movil.
- Dashboard carga segun rol.
- Formularios guardan sin doble envio.
- No hay errores rojos en consola.
- `devnexo.pillageweb.cl` despliega correctamente.

## Criterio de Cierre

La version v1.2 queda lista cuando el uso diario sea mas rapido y comodo para una organizacion real, sin introducir cambios grandes de arquitectura.
