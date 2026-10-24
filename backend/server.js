console.log('Iniciando backend NexoComunidad...');

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});

require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const ejecutarMigraciones = require('./config/migrations');

const app = express();

const allowedOrigin = process.env.FRONTEND_URL;

// Las respuestas de la API nunca se guardan en caché. La CDN de Hostinger (hcdn)
// puede guardar días respuestas de la API: un dato viejo seguía llegando aunque
// ya hubiera cambiado y, peor, un archivo privado podía quedar servido por la CDN
// sin pasar por la autenticación.
const RUTAS_API = [
  '/asistencia', '/personas', '/eventos', '/multas', '/usuarios', '/dashboard',
  '/finanzas', '/pagos', '/cuotas', '/gastos', '/socio-auth', '/auditoria'
];
app.use(RUTAS_API, (req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  next();
});

// Antes se llamaba cors() sin opciones (abierto a cualquier origen) pese a
// calcular allowedOrigin, que quedaba sin usar. Si no esta configurado el
// origen, se deja abierto (mismo comportamiento que antes) en vez de romper
// el arranque en ambientes que aun no definen FRONTEND_URL.
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : undefined));
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Registro de actividad: anota quién hizo cada cambio (ver auditoriaMiddleware).
app.use(require('./middleware/auditoriaMiddleware'));
app.use('/auditoria', require('./routes/auditoriaRoutes'));

app.use('/asistencia', require('./routes/asistenciaRoutes'));
app.use('/personas', require('./routes/personaRoutes'));
app.use('/eventos', require('./routes/eventoRoutes'));
app.use('/multas', require('./routes/multaRoutes'));
app.use('/usuarios', require('./routes/usuarioRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/finanzas', require('./routes/finanzasRoutes'));
app.use('/pagos', require('./routes/pagoRoutes'));
app.use('/cuotas', require('./routes/cuotaRoutes'));
app.use('/gastos', require('./routes/gastoRoutes'));
// Ambos bajo /socio-auth (no /socio): el frontend del socio vive en la carpeta
// /socio/ servida como estático (ver abajo) — si la API usara el prefijo /socio
// colisionaría con esa ruta y el Service Worker cachearía mal el HTML/JS estático
// del socio como si fuera un endpoint dinámico (ver sw.js API_PATHS).
app.use('/socio-auth', require('./routes/socioAuthRoutes'));
app.use('/socio-auth', require('./routes/socioDataRoutes'));

const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

const PORT = process.env.PORT || 3000;

ejecutarMigraciones()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Error ejecutando migraciones:', err);
    process.exit(1);
  });

