# NexoComunidad — club-deportivo-app

## Proyecto
Sistema administrativo web para organizaciones comunitarias (marca: NexoComunidad).
Cliente activo: Gran Diablada Calameña (rama `cliente/calamena`).

## Stack
- Frontend: HTML5, Bootstrap 5, JavaScript Vanilla, Chart.js, PWA (Service Worker + IndexedDB)
- Backend: Node.js, Express.js, JWT
- Base de datos: MySQL (Hostinger)

## Ambientes
- `club.pillageweb.cl` → main (producción NexoComunidad genérico)
- `devnexo.pillageweb.cl` → v1.3-dev (desarrollo activo)
- `devclub.pillageweb.cl` → cliente/calamena (cliente Gran Diablada Calameña)
- `nexocomunidad.pillageweb.cl` → landing comercial

## Ramas
- `main` → producción estable
- `v1.3-dev` → desarrollo activo NexoComunidad
- `cliente/calamena` → personalización Gran Diablada Calameña

## Flujo de trabajo
- Cambios se hacen en `v1.3-dev` o `cliente/calamena`
- Revisar en devnexo antes de fusionar a main
- **Pedir autorización antes de commit y push**

## Estados de socios
- `activo` → participa y genera cuotas
- `receso` → pausado de asistencia y nuevas cuotas, puede hacer pagos
- `inactivo` → eliminación lógica

## Módulos (cliente/calamena)
Dashboard, Integrantes, Asistencia QR (offline-first, sin evento), Eventos, Finanzas, Pagos, Cuotas, Multas

## Estado actual cliente/calamena (jul-2026)

### Implementado y en producción (devclub.pillageweb.cl)
- PWA offline-first completa (SW v15, IndexedDB v2 con UUID)
- Scanner QR nunca se bloquea: guarda con `estadoSync: sin_evento` si no hay evento
- Matching automático al seleccionar evento (por fecha local, corregido timezone)
- Auto-matching al abrir panel "Sin asignar" (1 evento ese día → asigna solo)
- Sync automático tras matching (sincronizarManual)
- Retry backoff 30s → 60s → 300s
- Badge offline clickeable → sincronizarManual
- Panel "Sin asignar" en Tablas con asignación manual y descarte
- Notificaciones email al cerrar evento (nodemailer defensivo)
- Filtros en todas las tablas (personas, eventos, asistencias, pagos, cuotas, multas, finanzas)
- Generación masiva de cuotas con INSERT SELECT (sin N+1)
- Migraciones BD con Promise.all + INFORMATION_SCHEMA (sin ALTER TABLE ciego)
- Dashboard unificado con endpoint /api/dashboard (1 fetch)
- Cache-first con pre-fetch en main.js (evita fetch duplicado)

### Pendiente calamena
- Sistema de puntaje GDC (reemplaza multas — requiere diseño antes de código)
- Exportación Excel/PDF (SheetJS + jsPDF, client-side)
- Portal del socio (PWA separada, login por RUT + PIN)
- Cancionero (Spotify + letras)
- Despliegue en grandiabladacalameña.cl — bloqueado, cliente no entrega cPanel de BlueHosting
- EMAIL_PASS no configurado en devclub → emails de cierre de evento no se envían

### Pendiente offline (spec: prompt-asistencia-offline-sin-evento.md)
- Background Sync API (SyncManager en SW) — el fallback manual ya existe
- Creación de eventos offline (UUID temporal → ID real al sincronizar)
- Panel "Eventos duplicados" en admin
- Matching server-side (para escaneos de otros dispositivos)

### Pendiente NexoComunidad v1.3-dev
- Portar emailService genérico (sin montos hardcodeados de calamena)
- Apoderado condicional por edad
- Ordenar integrantes por bloque > alfabético
- Exportación Excel/PDF

## Roadmap general NexoComunidad
Ver `documentacion/roadmap_maestro_producto_adaptable.md`

## Hosting Hostinger — comandos clave
```bash
# Ruta del proyecto
cd ~/domains/devclub.pillageweb.cl/nodejs

# npm (no está en PATH, usar ruta completa)
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Reiniciar: hPanel → Sitios web → devclub → Node.js → Reiniciar
```
