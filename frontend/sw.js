// =====================================
// SERVICE WORKER — NexoComunidad PWA
// =====================================

const CACHE_STATIC  = 'nexo-static-v12';
const CACHE_API     = 'nexo-api-v12';

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
  '/img/logo-calamena.jpeg',
  '/img/logo-calamena-black.jpeg',
  '/favicon.svg'
];

const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Rutas de API que se cachean para uso offline
const API_CACHE_PATHS = ['/api/personas', '/api/eventos'];

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

  // GET a rutas de API cacheadas
  if (API_CACHE_PATHS.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirstAPI(request));
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
