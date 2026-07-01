// =====================================
// INDEXEDDB — COLA DE ASISTENCIAS OFFLINE
// =====================================

const OFFLINE_DB_NAME    = 'nexo-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE      = 'asistencias_pendientes';

function abrirOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
        db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

async function guardarAsistenciaOffline(data) {
  const db    = await abrirOfflineDB();
  const tx    = db.transaction(OFFLINE_STORE, 'readwrite');
  const store = tx.objectStore(OFFLINE_STORE);
  store.add({ ...data, guardadoEn: new Date().toISOString() });
  return new Promise((resolve, reject) => {
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
  return registros.length;
}

async function sincronizarAsistenciasOffline() {
  let pendientes;
  try { pendientes = await obtenerAsistenciasOffline(); } catch { return; }
  if (pendientes.length === 0) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  let sincronizados = 0;
  for (const registro of pendientes) {
    const { id, guardadoEn, ...data } = registro;
    try {
      const res = await fetch(`${API_URL}/asistencia`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body:    JSON.stringify(data)
      });
      if (res.ok) { await eliminarAsistenciaOffline(id); sincronizados++; }
    } catch { break; }
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
  badge.textContent = total;
  badge.classList.toggle('d-none', total === 0);
}
