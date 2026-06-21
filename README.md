# NexoComunidad

Sistema administrativo web adaptable para organizaciones comunitarias.

## Descripcion

NexoComunidad permite administrar organizaciones con una base tecnica comun y una capa de personalizacion por cliente.

La aplicacion cubre:

- integrantes o personas
- actividades o eventos
- asistencias
- multas
- cuotas
- pagos
- estados financieros
- dashboard administrativo
- roles y permisos

## Enfoque de Producto

La rama `v1.1-dev` funciona como base neutral del producto. Las personalizaciones de clientes concretos deben vivir en ramas separadas, por ejemplo:

```text
cliente/nombre-cliente
```

Esto permite conservar una base reutilizable sin perder trabajos especificos de clientes.

## Tecnologias

### Frontend

- HTML5
- CSS3
- Bootstrap 5
- JavaScript Vanilla
- Chart.js

### Backend

- Node.js
- Express.js
- JWT Authentication
- Middleware de autenticacion y roles

### Base de Datos

- MySQL
- UTF8MB4

## Arquitectura

```plaintext
club-deportivo-app/
|-- backend/
|   |-- config/
|   |-- controllers/
|   |-- middleware/
|   |-- models/
|   |-- routes/
|   `-- server.js
|-- frontend/
|   |-- css/
|   |-- img/
|   |-- js/
|   |-- index.html
|   `-- login.html
|-- database/
`-- documentacion/
```

## Roles

### Administrador

Puede gestionar personas, actividades, asistencias, pagos, multas, finanzas y dashboard.

### Tesorero

Puede gestionar pagos y revisar finanzas, multas y dashboard.

### Encargado

Puede registrar asistencias y revisar actividades/asistencias.

## Personalizacion

La personalizacion base se concentra en:

```text
frontend/js/config.js
```

Desde ahi se definen nombre del producto, nombre de organizacion, logos, textos visibles, roles y tipos de actividad.

## Instalacion

Instalar dependencias del backend:

```bash
cd backend
npm install
```

Crear archivo `.env`:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=club_deportivo
JWT_SECRET=secret123
```

Ejecutar backend:

```bash
node server.js
```

Abrir el frontend desde `frontend/index.html` o usar un servidor local.

## Estado

Base v1.1 estabilizada como NexoComunidad neutral.

Ambientes principales:

- `nexocomunidad.pillageweb.cl` -> landing publica para clientes potenciales
- `club.pillageweb.cl` -> `main`
- `devnexo.pillageweb.cl` -> `v1.1-dev`
- `devclub.pillageweb.cl` -> `cliente/calamena`

Ver detalles en `documentacion/release_v1.1.md` y `documentacion/ambientes_y_ramas.md`.
