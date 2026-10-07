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
- `app.gdcayquina.cl` → cliente/calamena-produccion (producción Gran Diablada Calameña, hosting Hostinger del cliente, despliegue por zip)
- `dev.gdcayquina.cl` → cliente/calamena (ambiente de pruebas Gran Diablada Calameña, despliegue por zip)
- `devclub.pillageweb.cl` → **dado de baja (oct-2026)**, reemplazado por dev.gdcayquina.cl
- `nexocomunidad.pillageweb.cl` → landing comercial

## Ramas
- `main` → producción estable
- `v1.3-dev` → desarrollo activo NexoComunidad
- `cliente/calamena` → personalización Gran Diablada Calameña (trabajo diario, pruebas)
- `cliente/calamena-produccion` → producción Gran Diablada Calameña (se fusiona desde cliente/calamena cuando está probado)

## Flujo de trabajo
- Cambios se hacen en `v1.3-dev` o `cliente/calamena`
- Revisar en devnexo antes de fusionar a main
- **Pedir autorización antes de commit y push**

## Estados de socios
- `activo` → participa y genera cuotas
- `receso` → pausado de asistencia y nuevas cuotas, puede hacer pagos
- `inactivo` → eliminación lógica

## Módulos (cliente/calamena)
Dashboard, Integrantes, Asistencia QR (offline-first, sin evento), Eventos, Finanzas, Pagos, Cuotas, Multas, Puntaje, Gastos

## Estado actual cliente/calamena (jul-2026)

### Implementado (app.gdcayquina.cl / dev.gdcayquina.cl)
- PWA offline-first completa (SW v22, IndexedDB v2 con UUID)
- Scanner QR nunca se bloquea: guarda con `estadoSync: sin_evento` si no hay evento
- Matching automático al seleccionar evento (por fecha local, corregido timezone)
- Auto-matching al abrir panel "Sin asignar" (1 evento ese día → asigna solo)
- Sync automático tras matching (sincronizarManual)
- Retry backoff 30s → 60s → 300s
- Badge offline clickeable → sincronizarManual
- Panel "Sin asignar" en Tablas con asignación manual y descarte
- Notificaciones email al cerrar evento (nodemailer defensivo)
- Filtros en todas las tablas (personas, eventos, asistencias, pagos, cuotas, multas, finanzas, puntaje)
- Generación masiva de cuotas con INSERT SELECT (sin N+1)
- Migraciones BD con Promise.all + INFORMATION_SCHEMA (sin ALTER TABLE ciego)
- Dashboard unificado con endpoint /api/dashboard (1 fetch)
- Cache-first con pre-fetch en main.js (evita fetch duplicado)
- **Sistema de puntaje GDC — Fase 1 (jul-2026):** tabla `puntajes`, vista `vista_ranking_puntaje`, Art. 8.4 Estatutos 2016 (presente/atrasado/justificado/licencia_medica/vestimenta_distinta/retiro_sin_aviso), condicional a cuota al día, fire-and-forget sin bloquear respuesta HTTP, UNIQUE KEY evita duplicados
- **Sistema de puntaje GDC — Fase 2 (jul-2026):** pago vinculado a cuota → +20 anticipado (mes futuro) / +10 oportuno (mes actual) / 0 tardío, Art. 9.2/9.3
- **Exportación Excel/PDF (jul-2026):** SheetJS 0.18.5 + jsPDF + autoTable, 4 módulos (Integrantes, Asistencias, Deudores, Puntaje), dropdown unificado Bootstrap 5 por módulo
- **Pagos vinculados a cuotas (jul-2026):** campo `cuota_id` opcional en formulario de pago; al vincular → cuota pasa a `pagado` + dispara puntaje Fase 2
- **Multas desacopladas (jul-2026):** `deuda_actual = cuotas − pagos` (multas excluidas de la deuda); columna multas en Estado Financiero es informativa; fácil de reactivar en una línea cuando la agrupación decida cobrarlas
- Estados extendidos de asistencia: `justificado`, `licencia_medica`, `vestimenta_distinta`, `retiro_sin_aviso` (en BD y puntaje; pendiente UI manual)
- Matching por cercanía horaria cuando existen varias actividades el mismo día
- Tolerancia de atraso global en `config.js` (`toleranciaMinutosAtraso: 30`), confirmada por el cliente el 25-08-2026
- **Justificaciones (oct-2026):** el socio envía la carta desde el Portal del Socio; al aprobarla en Tablas → Justificaciones la asistencia queda `justificado`/`licencia_medica`, se borra la multa y se recalcula el puntaje
- Correo saliente configurado en dev y producción (oct-2026): SMTP de Hostinger, buzones @gdcayquina.cl
- **Depósitos en Portal del Socio (oct-2026):** Documentos → "Datos para depositar" (cuenta en `backend/config/cuentaDeposito.js`) y "Enviar comprobante de depósito" (tabla `comprobantes_deposito`, archivo en `uploads/comprobantes_deposito`, correo a `EMAIL_TESORERIA` o tesoreria@gdcayquina.cl). Solo avisa: tesorería registra el pago en el panel
- **Temporadas (oct-2026):** la abre la actividad marcada "Inicia temporada" (`eventos.inicia_temporada`); corta ranking, selector de temporadas y formaciones. 2026-2027 la abre la Misa a la Chilena del 26-09-2026. Cuotas de la temporada vigente: `PERIODOS_CUOTAS_TEMPORADA_VIGENTE` en `estatutoGdcRules.js` (oct-2026 a jul-2027)
- **Módulo de Gastos (jul-2026):** registro, categorías, responsable, comprobante adjunto y exportación
- **Módulo de Ingresos de terceros (oct-2026):** tabla `ingresos` (sin `persona_id`) para donaciones, premios y proyectos adjudicados; Tablas → Ingresos y Formularios → Ingreso, comprobante adjunto, exportación Excel/PDF. No afecta deuda ni puntaje
- Sesión de 20 días y continuidad offline sin cierre forzado por falta de conexión

### Pendiente calamena
- UI para asignar manualmente `vestimenta_distinta` y `retiro_sin_aviso` (justificado y licencia_medica ya entran por Justificaciones)
- Cancionero (Spotify + letras)

### En espera de definición del cliente
- Justificaciones: si se aprueba antes del evento y el socio igual asiste; si la Junta de disciplina necesita rol propio; folio único o separado.

### Pendiente offline (spec: prompt-asistencia-offline-sin-evento.md)
- Background Sync API (SyncManager en SW) — el fallback manual ya existe
- Creación de eventos offline (UUID temporal → ID real al sincronizar)
- Panel "Eventos duplicados" en admin
- Matching server-side (para escaneos de otros dispositivos)

### Pendiente NexoComunidad v1.3-dev
- Portar emailService genérico (sin montos hardcodeados de calamena)
- Apoderado condicional por edad
- Ordenar integrantes por bloque > alfabético
- Exportación Excel/PDF (portar desde calamena)

## Roadmap general NexoComunidad
Ver `documentacion/roadmap_maestro_producto_adaptable.md`

## Hosting Hostinger — comandos clave
```bash
# Ruta del proyecto
cd ~/domains/dev.gdcayquina.cl/nodejs   # o app.gdcayquina.cl

# npm (no está en PATH, usar ruta completa)
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Redesplegar: subir zip nuevo (git archive) en hPanel → Sitios web → <sitio> → Despliegues
```
