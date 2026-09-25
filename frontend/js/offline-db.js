// =====================================
// INDEXEDDB — COLA DE ASISTENCIAS OFFLINE
// =====================================

const OFFLINE_DB_NAME    = 'nexo-offline';
const OFFLINE_DB_VERSION = 2;
const OFFLINE_STORE      = 'asistencias_pendientes';

function generarUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback para Safari iOS < 15.4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] % 16;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function abrirOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      // v1→v2: reemplazar store autoIncrement por UUID como keyPath
      if (db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.deleteObjectStore(OFFLINE_STORE);
      }
      const store = db.createObjectStore(OFFLINE_STORE, { keyPath: 'id' });
      store.createIndex('estadoSync', 'estadoSync', { unique: false });
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

// estadoSync: 'sin_evento' | 'pendiente' | 'sincronizado'
// 'sin_evento'  → escaneado sin actividad asignada
// 'pendiente'   → tiene evento_id, esperando conexión para subir
// 'sincronizado'→ confirmado por el servidor (200)
async function guardarAsistenciaOffline(data) {
  const db    = await abrirOfflineDB();
  const tx    = db.transaction(OFFLINE_STORE, 'readwrite');
  const store = tx.objectStore(OFFLINE_STORE);
  const registro = {
    ...data,
    id:            generarUUID(),
    timestamp:     new Date().toISOString(),
    estadoSync:    data.evento_id ? 'pendiente' : 'sin_evento',
    creadoOffline: true
  };
  store.add(registro);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { iniciarCicloSync(); resolve(registro.id); };
    tx.onerror    = e => reject(e.target.error);
  });
}

async function actualizarRegistroOffline(id, cambios) {
  const db    = await abrirOfflineDB();
  const tx    = db.transaction(OFFLINE_STORE, 'readwrite');
  const store = tx.objectStore(OFFLINE_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = e => {
      const registro = e.target.result;
      if (registro) store.put(Object.assign(registro, cambios));
    };
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function obtenerAsistenciasOffline() {
  const db    = await abrirOfflineDB();
  const tx    = db.transaction(OFFLINE_STORE, 'readonly');
  const store = tx.objectStore(OFFLINE_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function obtenerAsistenciasSinEvento() {
  const todos = await obtenerAsistenciasOffline();
  return todos.filter(r => r.estadoSync === 'sin_evento');
}

async function eliminarAsistenciaOffline(id) {
  const db    = await abrirOfflineDB();
  const tx    = db.transaction(OFFLINE_STORE, 'readwrite');
  const store = tx.objectStore(OFFLINE_STORE);
  store.delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
  });
}

async function contarAsistenciasOffline() {
  const registros = await obtenerAsistenciasOffline();
  return registros.filter(r => r.estadoSync !== 'sincronizado').length;
}

async function sincronizarAsistenciasOffline() {
  let pendientes;
  try {
    const todos = await obtenerAsistenciasOffline();
    // Solo sincronizar registros con evento asignado y aún no subidos
    pendientes = todos.filter(r => r.estadoSync === 'pendiente' && r.evento_id);
  } catch {
    return;
  }

  if (pendientes.length === 0) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  let sincronizados = 0;
  let descartados = 0;

  for (const registro of pendientes) {
    const { id, timestamp, estadoSync, creadoOffline, ...data } = registro;
    try {
      const res = await fetch(`${API_URL}/asistencia`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(data)
      });

      if (res.ok || res.status === 409) {
        // 409 = el servidor ya tiene esta asistencia (duplicado); no es un
        // error real, solo evita que el registro quede reintentando para
        // siempre cuando la respuesta original se perdió por corte de red.
        await eliminarAsistenciaOffline(id);
        sincronizados++;
      } else if (res.status >= 400 && res.status < 500) {
        // Cualquier otro 4xx (evento finalizado, actividad no encontrada,
        // integrante inactivo) es un rechazo definitivo del servidor:
        // reintentar no lo va a resolver, así que se descarta en vez de
        // quedar "pendiente" reintentando para siempre.
        await eliminarAsistenciaOffline(id);
        descartados++;
      }
      // 5xx: se deja "pendiente" para reintentar, puede ser transitorio del servidor.
    } catch {
      break; // sin red, reintentar al próximo evento online
    }
  }

  if (sincronizados > 0) {
    mostrarAlerta(`${sincronizados} asistencia(s) sincronizada(s) al recuperar conexión`, 'success');
  }
  if (descartados > 0) {
    mostrarAlerta(`${descartados} asistencia(s) offline no se pudieron sincronizar (evento finalizado o no encontrado) y fueron descartadas`, 'warning');
  }
  if (sincronizados > 0 || descartados > 0) {
    actualizarBadgeOffline();
    cargarAsistencias();
    cargarDashboard();
  }
}

async function actualizarBadgeOffline() {
  const badge = document.getElementById('badge_offline');
  if (!badge) return;
  const total = await contarAsistenciasOffline();
  const span  = badge.querySelector('span');
  if (span) span.textContent = total;
  badge.classList.toggle('d-none', total === 0);
}

// ── Retry con backoff progresivo ──────────────────────────────────────────────
// Reintenta sincronizar mientras haya pendientes: 30s → 60s → 300s → cada 5min
const _retryCadencias = [30000, 60000, 300000];
let   _retryTimer     = null;
let   _retryIdx       = 0;

function programarReintento() {
  if (_retryTimer) return; // ya hay uno en vuelo
  const delay = _retryCadencias[Math.min(_retryIdx, _retryCadencias.length - 1)];
  _retryTimer = setTimeout(async () => {
    _retryTimer = null;
    const pendientes = await contarAsistenciasOffline();
    if (pendientes === 0) { _retryIdx = 0; return; }
    await sincronizarAsistenciasOffline();
    _retryIdx++;
    const quedan = await contarAsistenciasOffline();
    if (quedan > 0) programarReintento();
    else _retryIdx = 0;
  }, delay);
}

function iniciarCicloSync() {
  programarReintento();
}

async function sincronizarManual() {
  if (_retryTimer) { clearTimeout(_retryTimer); _retryTimer = null; }
  _retryIdx = 0;
  await sincronizarAsistenciasOffline();
  const quedan = await contarAsistenciasOffline();
  if (quedan > 0) programarReintento();
}
