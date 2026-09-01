// Service Worker PWA: precachea recursos, aplica estrategias de caché y habilita funcionamiento offline.
// =====================================
// SERVICE WORKER — NexoComunidad PWA
// =====================================

const CACHE_STATIC  = 'nexo-static-v47';
const CACHE_API     = 'nexo-api-v47';

const LOCAL_ASSETS = [
  '/index.html',
  '/login.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/main.js',
  '/js/personas.js',
  '/js/eventos.js',
  '/js/pagos.js',
  '/js/multas.js',
  '/js/finanzas.js',
  '/js/asistencias.js',
  '/js/dashboard.js',
  '/js/cuotas.js',
  '/js/offline-db.js',
  '/js/puntaje.js',
  '/js/formaciones.js',
  '/js/reportes.js',
  '/js/gastos.js',
  '/img/logo-calamena.jpeg',
  '/img/logo-calamena-black.jpeg',
  '/favicon.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js'
];

// Rutas dinamicas reales expuestas por Express. Ninguna debe caer en la
// estrategia cache-first reservada para archivos estaticos.
const API_PATHS = [
  '/asistencia',
  '/personas',
  '/eventos',
  '/multas',
  '/usuarios',
  '/dashboard',
  '/finanzas',
  '/pagos',
  '/cuotas',
  '/puntaje',
  '/formaciones',
  '/gastos'
];

// Solo estos datos se conservan para la operacion offline.
const API_CACHE_PATHS = ['/personas', '/eventos'];

function coincideRuta(pathname, ruta) {
  return pathname === ruta || pathname.startsWith(`${ruta}/`);
}

// ─── INSTALL ─────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(async cache => {
      // Assets locales: críticos, deben cachearse
      await cache.addAll(LOCAL_ASSETS);
      // CDNs: opcionales — si fallan no rompen el SW
      await Promise.allSettled(
        CDN_ASSETS.map(url =>
          fetch(url).then(res => { if (res.ok) cache.put(url, res); })
        )
      );
    })
  );
  self.skipWaiting();
});

// ─── ACTIVATE: limpia caches viejos ──────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // POST — manejar offline en el cliente
  if (request.method === 'POST') return;

  // Navegación HTML — siempre intentar red, caer a index.html cacheado
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  const esRutaApi = API_PATHS.some(path => coincideRuta(url.pathname, path));

  // Las APIs offline-first intentan siempre la red y solo usan cache sin conexion.
  if (API_CACHE_PATHS.some(path => coincideRuta(url.pathname, path))) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  // El resto de las APIs son datos dinamicos: nunca servirlos con cache-first.
  if (esRutaApi) {
    event.respondWith(networkOnlyAPI(request));
    return;
  }

  // Resto de assets — cache first
  event.respondWith(cacheFirst(request));
});

// Navegación: red → caché de la página → index.html
async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/index.html');
  }
}

// Cache-first: sirve desde caché, actualiza en background
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Recurso no disponible sin conexión', { status: 503 });
  }
}

// Network-first para API: intenta red, cae a caché si no hay conexión
async function networkFirstAPI(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// APIs dinamicas sin respaldo offline: devuelve un error JSON coherente si no hay red.
async function networkOnlyAPI(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(JSON.stringify({ mensaje: 'Sin conexion' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
