# Spec: Asistencia offline sin evento — NexoComunidad (rama `cliente/calamena`)

Documento de especificación. Ver estado de implementación al final.

## Contexto

App PWA para Gran Diablada Calameña. Temporada de ~10 días con varios eventos por día (misas, procesiones, bailes), en zona con cobertura mala. El operador puede estar offline y sin evento creado al momento de escanear.

## Problema original (bug en terreno)

El lector QR exigía evento seleccionado. Si no había evento o no había red, se bloqueaba y se perdía la asistencia.

## Objetivo

El lector QR nunca debe bloquearse. Toda captura debe guardarse siempre, y la asignación a un evento se resuelve después (automática o manual).

---

## Modelo de datos (IndexedDB)

```js
{
  id: crypto.randomUUID(),       // UUID v4 — nunca autoincremental
  persona_id: "123",
  evento_id: null,               // null si sin_evento
  timestamp: new Date().toISOString(),
  estadoSync: 'sin_evento',      // sin_evento | pendiente | sincronizado
  creadoOffline: true
}
```

### Estados
- `sin_evento` — escaneado sin evento asignado
- `pendiente` — tiene evento_id, esperando sync al servidor
- `sincronizado` — confirmado por servidor (200). Se elimina del store

---

## Requisitos funcionales

### 1. Scanner nunca bloqueado
- Si no hay evento seleccionado: guardar con `sin_evento`, aviso no bloqueante
- Si no hay red: guardar con `pendiente`, sync al recuperar

### 2. Matching automático (cliente)
Cuando se selecciona un evento o se abre el panel "Sin asignar":
- Comparar fecha local del escaneo con fecha del evento
- 1 evento ese día → asignar automáticamente
- Si hay varios eventos ese día → usar cercanía horaria cuando exista un candidato inequívoco
- Si no existe un candidato inequívoco → dejar para asignación manual

### 3. Panel "Sin asignar"
- Tabla de registros sin evento en IndexedDB
- Dropdown con eventos del día por registro
- Botones Asignar y Descartar por fila
- Badge con contador en el tab

### 4. Sincronización resiliente
- Retry backoff: 30s → 60s → 300s → cada 5min
- Badge clickeable = sincronización manual
- Nunca borrar un registro local hasta recibir 200

### 5. Indicador visible
- Badge en navbar con contador de pendientes
- Mensaje de alerta no bloqueante al escanear sin evento

---

## Checklist de implementación

- [x] IndexedDB v2 con UUID como keyPath
- [x] Scanner nunca bloqueado (guarda sin_evento)
- [x] Aviso visual no bloqueante
- [x] Matching automático por fecha al seleccionar evento (dropdown change)
- [x] Auto-matching al abrir panel "Sin asignar" (1 evento ese día)
- [x] Sync automático tras matching (sincronizarManual)
- [x] Panel "Sin asignar" en Tablas con dropdown, asignar y descartar
- [x] Badge offline con contador
- [x] Badge clickeable → sincronizarManual
- [x] Retry backoff 30s → 60s → 300s
- [x] Timezone fix (fecha local vs UTC)
- [x] Matching por cercanía horaria cuando hay varias actividades el mismo día
- [ ] Background Sync API (SyncManager) — fallback manual ya existe
- [ ] Creación de eventos offline (UUID temporal → ID real al sync)
- [ ] Panel "Eventos duplicados" en admin
- [ ] Matching server-side para asistencias de otros dispositivos

---

## Limitación cross-device conocida

Los registros `sin_evento` viven solo en el IndexedDB del dispositivo que escaneó. Si ese dispositivo nunca selecciona el evento en su propio dropdown, sus registros no se sincronizan solos.

**Solución actual:** El operador abre la app y selecciona el evento → matching local → sync automático.

**Solución futura (no implementada):** Endpoint `POST /api/asistencia/matching` para que el servidor asigne registros huérfanos subidos por cualquier dispositivo.

---

## Tolerancia de atraso — en espera del cliente

Existe una configuración global en `frontend/js/config.js`, actualmente con valor `0`. No se debe implementar un campo por actividad ni fijar otro valor hasta que el cliente confirme:

- si desea aplicar tolerancia;
- la cantidad de minutos;
- si será global o diferente por actividad;
- cómo afectará el estado de asistencia y el puntaje.

---

## Archivos involucrados

| Archivo | Función |
|---------|---------|
| `frontend/js/offline-db.js` | IndexedDB, guardar, actualizar, sincronizar, retry |
| `frontend/js/asistencias.js` | Scanner, matching, panel sin asignar |
| `frontend/sw.js` | Service Worker, cache-first, network-first API |
| `backend/controllers/asistenciaController.js` | POST /api/asistencia |
