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

## Cuotas mensuales

- Se agregó botón para generar cuotas del mes.
- Se agregó listado visual de cuotas.
- Se validó que no se dupliquen cuotas del mismo mes.
- Se aplicó formato de fecha reutilizable desde utils.js.

## Estado financiero consolidado

- Se integraron las cuotas mensuales al estado financiero.
- La deuda actual ahora considera multas pendientes + cuotas pendientes - pagos realizados.
- Se agregó la columna Total Cuotas en la tabla financiera.
- Se actualizó la vista vista_estado_financiero en MySQL.

## Permisos por rol

- Se restringió el acceso a módulos financieros para el rol entrenador.
- Se protegieron rutas sensibles de pagos, multas, finanzas y cuotas.
- La generación de cuotas queda disponible solo para admin y tesorero.
- Se ajustó el control visual del frontend según el rol del usuario.

# Registro de cambios - Despliegue Hostinger

## Contexto

La app `club-deportivo-app` fue desplegada en Hostinger desde GitHub para el subdominio:

`https://club.pillageweb.cl`

Durante el despliegue inicial se presentó error `503 Service Unavailable`.

## Problemas encontrados

- Hostinger desplegaba correctamente desde GitHub, pero la app Node no quedaba levantada.
- El backend real estaba dentro de `backend/`, mientras Hostinger estaba usando la raíz del repositorio.
- El frontend apuntaba a `http://localhost:3000`, lo que no funciona en producción.
- Faltaban dependencias runtime en el `package.json` raíz, especialmente `bcrypt`.
- Faltaban variables de entorno para MySQL.
- MySQL rechazaba conexión por usuario/host incorrecto.
- La ruta `finanzasRoutes.js` apuntaba a un handler inexistente.
- La conexión MySQL única (`createConnection`) se cortaba con `ECONNRESET` en Hostinger.

## Cambios realizados

### Backend

Se actualizó `backend/server.js` para:

- Agregar endpoint de salud:
  `/health`
- Servir archivos estáticos del frontend desde `../frontend`.
- Escuchar en `0.0.0.0`.
- Agregar logs temporales de arranque para diagnosticar Hostinger.

### Frontend

Se actualizaron:

- `frontend/js/login.js`
- `frontend/js/utils.js`

Cambio aplicado:

```js
const API_URL = window.API_URL || window.location.origin;