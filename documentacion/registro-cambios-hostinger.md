# Registro de cambios - Despliegue en Hostinger

## Contexto

La aplicacion `club-deportivo-app` fue desplegada en Hostinger desde GitHub para un subdominio de produccion.

Durante el despliegue inicial se presento el error:

```text
503 Service Unavailable
```

El objetivo fue corregir el despliegue, levantar correctamente el backend Node/Express, conectar la base de datos MySQL y validar el inicio de sesion.

## Diagnostico inicial

Se identificaron los siguientes problemas:

- El despliegue desde GitHub se completaba, pero la aplicacion Node no quedaba viva.
- Hostinger estaba ejecutando el proyecto desde la raiz del repositorio.
- El backend real de la aplicacion se encontraba dentro de la carpeta `backend`.
- El frontend apuntaba a `http://localhost:3000`, lo que no funciona en produccion.
- Faltaban dependencias runtime en el `package.json` raiz.
- La dependencia `bcrypt` no estaba disponible durante la ejecucion en Hostinger.
- Las variables de entorno de MySQL no estaban configuradas inicialmente.
- La conexion a MySQL fallaba hasta configurar correctamente host, usuario, base de datos y password.
- Una ruta de finanzas apuntaba a un handler inexistente.
- La conexion MySQL persistente se cortaba en hosting compartido con errores `ECONNRESET`.

## Cambios realizados

### 1. Ajuste de arranque para Hostinger

Se ajusto el `package.json` de la raiz para que Hostinger pudiera iniciar el backend aunque el directorio raiz del despliegue siguiera siendo `./`.

Se agregaron scripts de produccion:

```json
{
  "scripts": {
    "build": "echo build complete",
    "start": "node backend/server.js"
  }
}
```

Tambien se agregaron en el `package.json` raiz las dependencias necesarias para ejecutar el backend:

```json
{
  "dependencies": {
    "bcrypt": "^6.0.0",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "jsonwebtoken": "^9.0.3",
    "mysql2": "^3.22.3"
  }
}
```

Esto resolvio el error:

```text
Cannot find module 'bcrypt'
```

### 2. Ajuste de `backend/server.js`

Se modifico `backend/server.js` para soportar mejor el entorno de Hostinger.

Cambios principales:

- Se agrego endpoint de prueba:

```text
/health
```

- Se configuro el servidor para servir el frontend desde:

```text
../frontend
```

- Se ajusto el `listen` para enlazar correctamente en hosting:

```js
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
```

- Se agregaron logs temporales de diagnostico para confirmar el arranque del backend.

El endpoint `/health` fue usado para validar que el proceso Node quedara vivo.

### 3. Correccion de URL de API en frontend

Se actualizaron los archivos:

```text
frontend/js/login.js
frontend/js/utils.js
```

Antes:

```js
const API_URL = 'http://localhost:3000';
```

Despues:

```js
const API_URL = window.API_URL || window.location.origin;
```

Con esto, el frontend usa automaticamente el mismo dominio donde esta publicada la aplicacion.

### 4. Variables de entorno

Se configuraron variables de entorno en Hostinger para la conexion MySQL y JWT.

Formato usado:

```env
DB_HOST=127.0.0.1
DB_USER=<usuario_mysql>
DB_PASSWORD=<password_mysql>
DB_NAME=<nombre_base_datos>
JWT_SECRET=<secreto_jwt>
```

Notas:

- Se uso `127.0.0.1` en lugar de `localhost` para evitar problemas de resolucion hacia IPv6.
- No se documento ningun valor sensible.
- No se debe versionar el archivo `.env`.

### 5. Correccion de ruta de finanzas

El backend fallaba durante el arranque con:

```text
TypeError: argument handler must be a function
```

El error estaba en:

```text
backend/routes/finanzasRoutes.js
```

La ruta intentaba usar:

```js
controller.obtenerEstadoFinanciero
```

Pero el controlador exportaba:

```js
exports.listar
```

Se corrigio la ruta para usar:

```js
controller.listar
```

Esto permitio que Express cargara correctamente todas las rutas.

### 6. Cambio de conexion MySQL a pool

La configuracion original usaba una conexion persistente:

```js
mysql.createConnection(...)
```

En Hostinger aparecian errores:

```text
Error MySQL: read ECONNRESET
```

Se reemplazo por un pool de conexiones en:

```text
backend/config/db.js
```

Configuracion aplicada:

```js
require('dotenv').config();

const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
    return;
  }

  console.log('Conexion MySQL correcta');
  connection.release();
});

module.exports = pool;
```

Este cambio permite que cada consulta pueda usar una conexion disponible del pool, reduciendo problemas por conexiones cortadas en hosting compartido.

### 7. Base de datos y seed de prueba

Se creo una base de datos MySQL en Hostinger y se importo el esquema correspondiente.

Tambien se preparo un seed especifico para el entorno online:

```text
database/seed.hostinger.sql
```

Se creo un usuario de prueba para validar el login:

```text
usuario: admin
password: admin123
rol: admin
```

La contrasena fue almacenada como hash bcrypt en la tabla `usuarios`.

No se documentan hashes ni secretos en este archivo.

## Validaciones realizadas

Se verifico lo siguiente:

- El despliegue desde GitHub se completa correctamente.
- El backend inicia en Hostinger.
- El proceso Node muestra logs de arranque.
- La conexion a MySQL se realiza correctamente.
- El endpoint `/health` responde.
- El frontend carga desde el dominio de produccion.
- El login funciona con el usuario de prueba.

## Resultado

El error `503 Service Unavailable` fue resuelto.

La aplicacion quedo funcionando en Hostinger con:

- Backend Node/Express activo.
- Frontend servido desde el mismo dominio.
- Conexion MySQL operativa.
- Login funcional.
- Despliegue conectado a GitHub.

## Comandos Git utilizados

Ejemplo de comandos usados durante el proceso:

```bash
git add package.json package-lock.json
git commit -m "Install runtime dependencies from root"
git push origin main
```

```bash
git add backend/server.js
git commit -m "Add startup logs and bind host for Hostinger"
git push origin main
```

```bash
git add backend/routes/finanzasRoutes.js
git commit -m "Fix finanzas route handler"
git push origin main
```

```bash
git add backend/config/db.js
git commit -m "Use MySQL connection pool"
git push origin main
```

```bash
git add database/seed.hostinger.sql
git commit -m "Add Hostinger seed data"
git push origin main
```

## Pendientes

- Probar todos los modulos funcionales:
  - Dashboard
  - Asistencias
  - Multas
  - Finanzas
  - Pagos
  - Cuotas
- Validar seed completo de datos de prueba.
- Revisar mensajes `ECONNRESET` si aparecen durante uso real.
- Limpiar logs temporales de diagnostico antes de dejar la app en produccion final.
- Revisar manejo de errores del login para devolver mensajes mas claros.
- Validar roles y permisos por tipo de usuario.

## Recomendaciones

- No versionar archivos `.env`.
- No subir `node_modules` al repositorio.
- Mantener las variables sensibles solo en el panel de Hostinger.
- Usar siempre hashes bcrypt para passwords de usuarios.
- Mantener `/health` como endpoint simple de monitoreo.
- Usar pool de conexiones MySQL en produccion.
