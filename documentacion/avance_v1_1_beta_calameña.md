# Avance V1.1 Beta Cliente - Gran Diablada Calameña

## Estado general

La rama `v1.1-dev` contiene una versión beta preparada para revisión con el cliente Gran Diablada Calameña.

El objetivo de esta etapa es validar el alcance funcional de la primera versión productiva, revisar módulos necesarios y confirmar reglas de uso antes de pasar a una entrega final.

## Avances realizados

### Configuración por cliente

- Se incorporó `APP_CONFIG` como base de personalización.
- Se centralizaron datos visuales del cliente:
  - nombre de la agrupación,
  - nombre del producto,
  - logo,
  - roles visibles,
  - tipos de actividad,
  - etiquetas principales.
- Se corrigió el tamaño del logo en vista móvil y escritorio.

### Interfaz y textos

- Se reemplazaron textos visibles orientados a club deportivo por lenguaje adaptable a agrupación.
- Se avanzó en el cambio de “Persona/Socio” hacia “Integrante”.
- Se actualizaron títulos principales desde configuración.
- Se actualizaron botones principales desde configuración.
- Se corrigieron textos visibles en módulos de integrantes, actividades, pagos, cuotas y asistencias.

### Flujos funcionales validados

Se probaron correctamente:

- inicio de sesión,
- cierre de sesión,
- creación de integrantes,
- edición de integrantes,
- eliminación de integrantes,
- creación de actividades,
- edición de actividades,
- eliminación de actividades,
- registro de asistencia,
- creación de pagos,
- eliminación de pagos,
- generación de cuotas,
- vista de estado financiero,
- vistas por rol.

### Mejoras de experiencia de usuario

- Se reemplazaron confirmaciones nativas del navegador por modales Bootstrap.
- Se aplicó modal personalizado para:
  - generación de cuotas,
  - eliminación de integrantes,
  - eliminación de actividades,
  - eliminación de pagos.
- Se mantuvieron alertas visuales Bootstrap para resultados de acciones.

### Robustez frontend

Se agregaron validaciones para evitar errores cuando el backend devuelve respuestas inesperadas o sesiones vencidas.

Archivos reforzados:

- `frontend/js/personas.js`
- `frontend/js/eventos.js`
- `frontend/js/asistencias.js`
- `frontend/js/cuotas.js`
- `frontend/js/pagos.js`
- `frontend/js/dashboard.js`

Esto evita errores como:

```text
data.forEach is not a function
data.map is not a function