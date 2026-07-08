# Estado del Proyecto — NexoComunidad (julio 2026)

Documento de referencia rápida: qué está hecho, qué está pendiente y en qué orden.

---

## Lo que está construido

### Base (v1.0 RC2 → main)
- Login JWT con roles (admin, tesorero, entrenador)
- CRUD integrantes con validación RUT chileno, edad automática, apoderado condicional
- CRUD eventos con tipos configurables por cliente
- Registro de asistencia (presente, atrasado, ausente)
- Multas automáticas por ausencia/atraso
- Cuotas mensuales con generación masiva (INSERT SELECT)
- Pagos con estado financiero consolidado (`vista_estado_financiero`)
- Dashboard con endpoint único `/api/dashboard`
- Roles aplicados en frontend y backend
- Pool de conexiones MySQL (sin ECONNRESET)
- Migraciones con guardas INFORMATION_SCHEMA (sin ALTER TABLE ciego)
- Endpoint `/health`

### Adaptación NexoComunidad (v1.1 → v1.3-dev)
- `config.js` con APP_CONFIG por cliente (nombre, logo, colores, etiquetas, tipos de actividad)
- Filtros en todas las tablas (personas, eventos, asistencias, pagos, cuotas, multas, finanzas)
- Botones compactos btn-group en todas las tablas
- utils.js con funciones reutilizables (formatearMonto, badges, bloquearBoton, etc.)
- Carga condicional por rol en main.js
- Cache-first con pre-fetch compartido en main.js

### Personalización calamena (cliente/calamena)
- Logo, paleta negro/naranja, textos en español adaptado a agrupación
- Cierre de evento con notificación email a ausentes (nodemailer defensivo)
- PWA offline-first completa:
  - Service Worker v15 (cache-first para assets, network-first para API)
  - IndexedDB v2 (UUID, store único, índice por estadoSync)
  - Scanner QR/PDF417 nunca bloqueado: guarda `sin_evento` si no hay evento
  - Matching automático por fecha al seleccionar evento en dropdown
  - Auto-matching al abrir panel "Sin asignar" (1 evento ese día → asigna sin intervención)
  - Sync automático tras matching (sincronizarManual)
  - Retry backoff 30s → 60s → 300s
  - Badge offline con contador de pendientes
  - Panel "Sin asignar" en Tablas con asignación manual, dropdown de eventos del día, descarte

---

## Pendiente — calamena (cliente/calamena)

### Alta prioridad
| Pendiente | Notas |
|-----------|-------|
| EMAIL_PASS en Hostinger | Gmail App Password en .env de devclub — emails cerrar evento no funcionan |
| Exportación Excel/PDF | SheetJS + jsPDF client-side. Reportes: deudores, asistencias, integrantes, cuotas |
| Despliegue grandiabladacalameña.cl | Bloqueado — cliente no entrega acceso cPanel de BlueHosting |

### Media prioridad
| Pendiente | Notas |
|-----------|-------|
| Sistema de puntaje GDC | Reemplaza multas. Tabla de puntajes según Estatutos 2016. Requiere diseño antes de codificar |
| Portal del socio | PWA separada, login RUT+PIN, datos propios, solo lectura |

### Baja prioridad / futuro
| Pendiente | Notas |
|-----------|-------|
| Cancionero | Spotify + letras |
| Background Sync API | SyncManager en SW para Chromium. El fallback manual ya existe |
| Creación de eventos offline | UUID temporal → ID real al sincronizar. Complejo |
| Panel "Eventos duplicados" | Para cuando haya creación offline multi-dispositivo |
| Matching server-side | Endpoint para asistencias huérfanas de otros dispositivos |

---

## Pendiente — NexoComunidad genérico (v1.3-dev)

| Pendiente | Notas |
|-----------|-------|
| Portar emailService genérico | Sin montos hardcodeados de calamena |
| Apoderado condicional por edad | Ya en calamena, portar a nexo |
| Ordenar integrantes por bloque | Ya en calamena, portar a nexo |
| Exportación Excel/PDF | Misma implementación que calamena |

---

## Roadmap largo plazo

| Versión | Objetivo |
|---------|----------|
| V1.3 | Reportes y exportación Excel/PDF |
| V1.4 | Portal de integrantes |
| V1.5 | Módulos opcionales por tipo de organización |
| V1.6 | Asistencia avanzada (ya iniciado con QR offline-first) |
| V1.7 | Pagos online (Webpay/Transbank) |
| V2.0 | Multi-organización (organizacion_id en todas las tablas) |
| V3.0 | SaaS comercial (subdominios, planes, panel global) |

---

## Decisiones técnicas relevantes

- **No cherry-pick entre v1.3-dev y cliente/calamena** — demasiado divergidas, aplicar cambios manualmente
- **No lazy loading por pestaña** — intentado jul-2026, revertido. Usar defer/async en script tags si se necesita
- **nodemailer: require defensivo** — `try { require('nodemailer') } catch` para no crashear si no está instalado
- **IndexedDB**: UUID como keyPath, nunca autoincremental. `estadoSync`: sin_evento | pendiente | sincronizado
- **Service Worker**: skipWaiting + clients.claim para toma inmediata. Versión sube con cada deploy que cambia JS

---

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `frontend/js/config.js` | Personalización visual por cliente |
| `frontend/js/offline-db.js` | IndexedDB + cola de sync |
| `frontend/sw.js` | Service Worker PWA |
| `frontend/js/asistencias.js` | Scanner QR + matching + panel sin asignar |
| `backend/config/migrations.js` | Migraciones BD con guardas |
| `backend/models/dashboardModel.js` | Query unificada del dashboard |
| `backend/services/emailService.js` | Email defensivo post-cierre evento |
