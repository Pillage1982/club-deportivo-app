// =====================================
// SERVICE WORKER — NexoComunidad PWA
// =====================================

const CACHE_STATIC = 'nexo-static-v1';
const CACHE_API    = 'nexo-api-v1';

const STATIC_ASSETS = [
  '/index.html',
  '/login.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/main.js',
  '/js/personas.js',
  '/js/eventos.js',
  '/js/pagos.js',
  '/js/asistencias.js',
  '/js/dashboard.js',
  '/js/cuotas.js',
  '/js/offline-db.js',
  '/img/logo-nexocomunidad.svg',
  '/favicon.svg',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.7/dist/js/bootstrap.bundle.min.js',
  'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

const API_CACHE_PATHS = ['/api/personas', '/api/eventos'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_STATIC && k !== CACHE_API).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method === 'POST') return;

  if (API_CACHE_PATHS.some(p => url.pathname.startsWith(p))) {
    event.respondWith(networkFirstAPI(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

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
