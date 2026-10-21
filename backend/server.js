// Servidor principal: configura Express, seguridad, rutas API, archivos estáticos y migraciones de arranque.
console.log('Iniciando backend club deportivo...');

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

// En Hostinger la app corre detrás de proxies (LiteSpeed y la CDN hcdn). Sin
// 'trust proxy', req.ip era la IP del proxy para todos: los límites de login,
// recuperación de clave y verificación de cartas se compartían entre toda la
// agrupación (11 ingresos en 15 minutos bloqueaban a todos). Por defecto se confía
// solo en proxies de red local; con la variable TRUST_PROXY se ajusta (ej. 2 si la
// CDN agrega un salto más que no es local).
const TRUST_PROXY = process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal';
app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);

// Diagnóstico: las primeras peticiones con X-Forwarded-For tras cada arranque dejan
// en el registro la cadena de proxies y la IP que resultó, para confirmar el ajuste
// de TRUST_PROXY en "Registros de tiempo de ejecución".
let diagnosticosProxy = 3;
app.use((req, res, next) => {
  if (diagnosticosProxy > 0 && req.headers['x-forwarded-for']) {
    diagnosticosProxy--;
    console.log(`[proxy] x-forwarded-for="${req.headers['x-forwarded-for']}" remoto=${req.socket.remoteAddress} -> req.ip=${req.ip} (trust proxy: ${TRUST_PROXY})`);
  }
  next();
});

const allowedOrigin = process.env.FRONTEND_URL;

// Las respuestas de la API nunca se guardan en caché. La CDN de Hostinger (hcdn)
// guardaba 7 días ("public, max-age=604800") respuestas con tipo de imagen: un
// "no encontrado" viejo seguía llegando aunque el archivo ya existiera y, peor, un
// comprobante real podía quedar servido por la CDN sin pasar por la autenticación.
const RUTAS_API = [
  '/asistencia', '/personas', '/eventos', '/multas', '/usuarios', '/dashboard',
  '/finanzas', '/pagos', '/cuotas', '/puntaje', '/formaciones', '/gastos',
  '/ingresos', '/justificaciones', '/solicitudes-ingreso', '/socio-auth', '/publico',
  '/auditoria', '/cartas-permiso'
];
app.use(RUTAS_API, (req, res, next) => {
  res.set('Cache-Control', 'no-store, private');
  next();
});

// Antes se llamaba cors() sin opciones (abierto a cualquier origen) pese a
// calcular allowedOrigin, que quedaba sin usar. Si no esta configurado el
// origen, se deja abierto (mismo comportamiento que antes) en vez de romper
// el arranque en ambientes que aun no definen FRONTEND_URL.
// Rutas públicas (sitio gdcayquina.cl) antes del CORS global: usan su propio CORS.
app.use('/publico', require('./routes/publicoRoutes'));

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
app.use('/puntaje', require('./routes/puntajeRoutes'));
app.use('/formaciones', require('./routes/formacionRoutes'));
app.use('/gastos', require('./routes/gastoRoutes'));
app.use('/ingresos', require('./routes/ingresoRoutes'));
app.use('/justificaciones', require('./routes/justificacionRoutes'));
app.use('/solicitudes-ingreso', require('./routes/solicitudIngresoRoutes'));
app.use('/cartas-permiso', require('./routes/cartaPermisoRoutes'));
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
