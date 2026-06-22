# Checklist revision devnexo v1.2

Ambiente: `https://devnexo.pillageweb.cl`

Rama esperada: `v1.2-dev`

## Accesos

- Login admin funciona.
- Login tesorero funciona.
- Login encargado funciona.
- No aparecen errores rojos en consola al iniciar sesion.

## Dashboard por rol

- Admin ve resumen general: integrantes, actividades, asistencias y deuda.
- Tesorero ve resumen financiero: pagado, deuda, cuotas pendientes y multas.
- Encargado ve resumen operativo: integrantes, proximas actividades, asistencias y ausentes/atrasados.
- Las tarjetas no se cortan en movil.

## Busquedas y filtros

- Integrantes filtra por nombre, RUT, email o telefono.
- Actividades filtra por nombre/ubicacion/descripcion, tipo y fecha.
- Pagos filtra por integrante y metodo.
- Cuotas filtra por integrante, estado, mes y ano.
- Estado financiero filtra por integrante, con deuda, al dia y a favor.
- Los botones Limpiar restauran cada tabla.

## Tablas

- Montos se muestran con formato CLP.
- Estados se muestran con badges consistentes.
- Acciones editar/eliminar se ven compactas.
- En movil las tablas tienen scroll horizontal usable.
- La columna de acciones permanece visible en integrantes, actividades y pagos.

## Formularios

- Registrar asistencia guarda una sola vez aunque se presione rapido.
- Guardar integrante bloquea el boton mientras guarda.
- Guardar actividad bloquea el boton mientras guarda.
- Guardar pago bloquea el boton mientras guarda.
- Generar cuotas bloquea el boton mientras procesa.
- Los formularios muestran errores claros cuando faltan datos.

## Cierre

- Flujo admin completo: validado.
- Flujo tesorero completo: validado.
- Flujo encargado completo: validado.
- Accesos: validado.
- Dashboard por rol: validado.
- Formularios: validado.
- Busquedas y filtros: validado.
- Tablas desktop/movil: validado.
- Consola sin errores rojos: validado.
- Multas por asistencia: validado.
- Confirmar que no hay referencias de clientes especificos: validado durante limpieza de base neutral.
- Ambiente estable para preparar merge posterior: validado.

Resultado: `v1.2-dev` queda validada en `devnexo.pillageweb.cl` como version candidata para promover a `main`, pendiente solo de confirmacion explicita antes del merge.
