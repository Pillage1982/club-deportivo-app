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
    tx.oncomplete = () => resolve(registro.id);
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

  for (const registro of pendientes) {
    const { id, timestamp, estadoSync, creadoOffline, ...data } = registro;
    try {
      const res = await fetch(`${API_URL}/asistencia`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(data)
      });

      if (res.ok) {
        await eliminarAsistenciaOffline(id);
        sincronizados++;
      }
    } catch {
      break; // sin red, reintentar al próximo evento online
    }
  }

  if (sincronizados > 0) {
    mostrarAlerta(`${sincronizados} asistencia(s) sincronizada(s) al recuperar conexión`, 'success');
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
