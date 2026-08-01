# Guía del código — archivo por archivo

Esta guía explica dónde vive cada responsabilidad. Los comentarios dentro del código describen el propósito general de cada archivo y los bloques importantes; este documento sirve como mapa de navegación.

## Recorrido recomendado

1. `frontend/login.html` y `frontend/js/login.js`: autenticación y almacenamiento de la sesión.
2. `frontend/index.html`: estructura visual completa de la aplicación.
3. `frontend/js/main.js`: arranque, roles, navegación y carga de módulos.
4. `frontend/js/utils.js` y `frontend/js/config.js`: funciones compartidas y personalización del cliente.
5. Un módulo frontend, por ejemplo `personas.js`.
6. Su ruta, controlador y modelo equivalentes en `backend/`.
7. `backend/server.js`, `backend/config/db.js` y `backend/config/migrations.js`.
8. `frontend/js/offline-db.js` y `frontend/sw.js` para comprender el modo offline.

El flujo habitual es:

```text
HTML → JavaScript frontend → fetch /api/... → routes → middleware
     → controller → model → MySQL → respuesta JSON → renderizado HTML
```

## Raíz del proyecto

| Archivo | Responsabilidad |
|---|---|
| `server.js` | Punto de entrada mínimo para hosting; carga el servidor real. |
| `package.json` | Scripts y dependencias que instala el hosting desde la raíz. JSON no permite comentarios. |
| `package-lock.json` | Versiones exactas generadas por npm; no debe editarse manualmente. |
| `gdc_personas_junio2026.sql` | Importación puntual del padrón entregado por GDC. |

## Backend

### Arranque y configuración

| Archivo | Responsabilidad |
|---|---|
| `backend/server.js` | Crea Express, registra rutas, sirve el frontend e inicia migraciones. |
| `backend/config/db.js` | Configura el pool MySQL usando variables de entorno. |
| `backend/config/migrations.js` | Mantiene la base existente compatible con el código actual. |
| `backend/hashPassword.js` | Herramienta manual para generar hashes bcrypt de desarrollo. |
| `backend/package.json` | Dependencias del backend cuando se instala desde esa carpeta. |
| `backend/package-lock.json` | Bloqueo automático de versiones del backend. |

### Patrón de módulos

Cada recurso sigue tres capas:

- `routes/*Routes.js`: define URL, método HTTP, autenticación y roles.
- `controllers/*Controller.js`: valida entradas, coordina reglas y construye la respuesta HTTP.
- `models/*Model.js`: contiene consultas MySQL y no manipula la interfaz.

| Recurso | Ruta | Controlador | Modelo |
|---|---|---|---|
| Asistencias | `asistenciaRoutes.js` | `asistenciaController.js` | `asistenciaModel.js` |
| Cuotas | `cuotaRoutes.js` | `cuotaController.js` | `cuotaModel.js` |
| Dashboard | `dashboardRoutes.js` | `dashboardController.js` | `dashboardModel.js` |
| Actividades | `eventoRoutes.js` | `eventoController.js` | `eventoModel.js` |
| Finanzas | `finanzasRoutes.js` | `finanzasController.js` | `finanzasModel.js` |
| Gastos | `gastoRoutes.js` | `gastoController.js` | `gastoModel.js` |
| Multas | `multaRoutes.js` | `multaController.js` | `multaModel.js` |
| Pagos | `pagoRoutes.js` | `pagoController.js` | `pagoModel.js` |
| Integrantes | `personaRoutes.js` | `personaController.js` | `personaModel.js` |
| Puntaje | `puntajeRoutes.js` | `puntajeController.js` | `puntajeModel.js` |
| Usuarios | `usuarioRoutes.js` | `usuarioController.js` | `usuarioModel.js` |

### Componentes transversales

| Archivo | Responsabilidad |
|---|---|
| `middleware/authMiddleware.js` | Verifica el token JWT. |
| `middleware/roleMiddleware.js` | Comprueba permisos por rol. |
| `middleware/uploadComprobante.js` | Recibe y valida archivos de comprobantes. |
| `services/emailService.js` | Envía notificaciones de ausencia por correo. |

## Frontend

### Documentos y estilos

| Archivo | Responsabilidad |
|---|---|
| `frontend/login.html` | Estructura de la pantalla de acceso. |
| `frontend/index.html` | Estructura de todo el panel autenticado. |
| `frontend/css/login.css` | Apariencia exclusiva del login. |
| `frontend/css/styles.css` | Tema, layout, tablas, responsive y scanner. |

### JavaScript compartido

| Archivo | Responsabilidad |
|---|---|
| `frontend/js/config.js` | Marca, etiquetas, roles visuales y configuración del cliente. |
| `frontend/js/main.js` | Arranque, sesión, roles, pestañas y carga inicial. |
| `frontend/js/utils.js` | API, JWT, formatos, alertas, modales y caché en memoria. |
| `frontend/js/reportes.js` | Generación de Excel y PDF. |
| `frontend/js/offline-db.js` | Cola IndexedDB de asistencias pendientes. |
| `frontend/sw.js` | Caché PWA y funcionamiento sin conexión. |
| `frontend/manifest.json` | Metadatos instalables de la PWA; JSON no admite comentarios. |

### JavaScript por módulo

| Archivo | Responsabilidad |
|---|---|
| `asistencias.js` | QR/manual, atraso, historial, matching y sincronización. |
| `cuotas.js` | Generación y consulta de mensualidades. |
| `dashboard.js` | Métricas y gráficos. |
| `eventos.js` | CRUD, filtros y cierre de actividades. |
| `finanzas.js` | Estado financiero consolidado. |
| `gastos.js` | Gastos y comprobantes. |
| `login.js` | Autenticación desde el navegador. |
| `multas.js` | Tabla y filtros de multas. |
| `pagos.js` | Registro de pagos y vinculación con cuotas. |
| `personas.js` | Gestión de integrantes. |
| `puntaje.js` | Ranking y detalle de puntaje GDC. |

## Base de datos

| Archivo | Uso |
|---|---|
| `database/schema_v0.sql` | Modelo inicial histórico. |
| `database/schema_v1_rc.sql` | Modelo completo de V1 RC. |
| `database/schema_hostinger.sql` | Instalación base del ambiente Hostinger. |
| `database/migracion_estado_integrantes_receso.sql` | Migración manual puntual del estado receso. |
| `database/seed.sql` | Datos de prueba locales. |
| `database/seed.hostinger.sql` | Datos de demostración para Hostinger; es destructivo sobre las tablas que vacía. |
| `database/triggers.sql` | Automatizaciones MySQL históricas; comprobar reglas duplicadas antes de usarlas. |
| `database/respaldo_v1_rc.sql` | Respaldo estructural histórico. |

## Archivos JSON

JSON no admite comentarios. Agregar `//` o `/* ... */` rompería `npm`, el manifest o el despliegue. Por eso su explicación vive aquí:

- Los `package.json` declaran scripts y dependencias.
- Los `package-lock.json` son generados por npm y fijan versiones exactas.
- `frontend/manifest.json` define nombre, iconos, colores y modo de apertura de la PWA.

## Reglas para futuros comentarios

- Explicar el motivo y la regla de negocio, no repetir literalmente la instrucción siguiente.
- Mantener la separación routes → controllers → models.
- Actualizar esta guía cuando se agregue, elimine o cambie de responsabilidad un archivo.
- No escribir credenciales, datos personales ni secretos en comentarios.
- No agregar comentarios dentro de JSON ni editar manualmente archivos `package-lock.json`.
