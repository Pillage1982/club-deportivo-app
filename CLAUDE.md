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

## Roles del panel
`backend/config/roles.js`: cada rol hereda permisos de un rol base y puede o no eliminar (roleMiddleware bloquea DELETE). `admin`, `tesorero`, `entrenador` (base); `secretaria` = admin; `director1` = admin sin eliminar; `director2` = tesorero sin eliminar; `director3` = entrenador sin eliminar; `coordinador` = entrenador sin eliminar. El panel usa `rol_base` (obtenerRolActual) y oculta botones de borrar con `body.sin-eliminar`. Usuarios se crean por SQL con clave `gdc123` (cambio obligatorio en el primer ingreso).

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
- Estados extendidos de asistencia: `justificado`, `licencia_medica`, `vestimenta_distinta`, `retiro_sin_aviso` (en BD y puntaje)
- **Vestimenta distinta (oct-2026):** botón por registro en Tablas → Asistencias y en Últimos registros del escáner (`PATCH /asistencia/:id/vestimenta`); solo sobre presente/atrasado, al quitarla vuelve a atrasado si tiene minutos y si no a presente; recalcula el puntaje
- Matching por cercanía horaria cuando existen varias actividades el mismo día
- Tolerancia de atraso por actividad (oct-2026): selector en el formulario de Actividades (`eventos.tolerancia_minutos`); por defecto 15 min (`config.js` → `toleranciaMinutosAtraso`), que también usan las actividades sin margen guardado
- Categorías de actividad (oct-2026): Ensayo (`entrenamiento`), Misa (`misa`), Reunión (`reunion`), Presentación (`partido`), Otros (`otro`)
- **Justificaciones (oct-2026):** el socio envía la carta desde el Portal del Socio; al aprobarla en Tablas → Justificaciones la asistencia queda `justificado`/`licencia_medica`, se borra la multa y se recalcula el puntaje
- Correo saliente configurado en dev y producción (oct-2026): SMTP de Hostinger, buzones @gdcayquina.cl
- **Depósitos en Portal del Socio (oct-2026):** Documentos → "Datos para depositar" (cuenta en `backend/config/cuentaDeposito.js`) y "Enviar comprobante de depósito" (tabla `comprobantes_deposito`, archivo en `uploads/comprobantes_deposito`, correo a `EMAIL_TESORERIA` o tesoreria@gdcayquina.cl). Tesorería los ve en Tablas → Depósitos y con "Registrar pago" (o 📎 en Tablas → Pagos) el pago usa ese mismo archivo como comprobante; `comprobantes_deposito.pago_id` marca el depósito como registrado (oct-2026)
- **Temporadas (oct-2026):** la abre la actividad marcada "Inicia temporada" (`eventos.inicia_temporada`); corta ranking, selector de temporadas, formaciones, historial de puntaje del panel, Portal y reporte de cuotas (todo el puntaje se ve desde el inicio de la temporada; el puntaje de una cuota nunca queda antes del 1-oct de su temporada). 2026-2027 la abre la Misa a la Chilena del 26-09-2026. Cuotas de la temporada vigente: `periodosCuotasTemporadaVigente()` en `estatutoGdcRules.js`, calculada por fecha (hora Chile): desde octubre, oct de ese año a jul del siguiente
- **Módulo de Gastos (jul-2026):** registro, categorías, responsable, comprobante adjunto y exportación
- **Módulo de Ingresos de terceros (oct-2026):** tabla `ingresos` (sin `persona_id`) para donaciones, premios y proyectos adjudicados; Tablas → Ingresos y Formularios → Ingreso, comprobante adjunto, exportación Excel/PDF. No afecta deuda ni puntaje
- **Balance general y Total en caja (oct-2026):** `/dashboard` entrega `balance` solo a admin/tesorero = (SUM pagos + SUM ingresos) − SUM gastos, calculado en vivo; tarjeta "Total en caja" + bloque "Balance general" en Dashboard; se refresca al guardar/eliminar pagos, gastos e ingresos
- Sesión de 20 días y continuidad offline sin cierre forzado por falta de conexión
- **Tipo de pago y comprobante (oct-2026):** `pagos.tipo_pago` (cuota/traje/chaqueta/otro) + `detalle`; solo `tipo_pago='cuota'` rebaja la deuda (vista_estado_financiero y Portal), los extras suman a caja. `pagos.comprobante_path` opcional (uploads/comprobantes), ver/adjuntar desde Tablas → Pagos
- **Meses que se pagan (oct-2026):** en Formularios → Pago se marcan a mano las cuotas pendientes (cualquier temporada). 1 mes: abono parcial permitido. Varios meses con monto menor: se pagan los más antiguos y el último queda con abono. Sin meses marcados (tipo cuota): se aplica a las pendientes más antiguas; el sobrante queda a favor. El pago anual solo toma la temporada vigente. Cuotas con pagos parciales muestran la etiqueta "Abono $X" (formulario, Tablas → Cuotas con filtro "Con abono", Portal). La deuda del Portal se calcula por cuota (abonos a cuotas de la temporada + saldo a favor de pagos de cuota de la temporada), no por fecha de pago
- **Registro de actividad (oct-2026):** tabla `auditoria`, escrita por `middleware/auditoriaMiddleware.js` (montado en server.js antes de las rutas) en cada POST/PUT/PATCH/DELETE exitoso con sesión (panel o Portal); sin claves/PIN en el detalle; GET no se registran. Botón "Actividad" en la barra → modal con pestañas por módulo, filtro usuario/fechas. Solo rol `admin` exacto y cuenta de soporte (`GET /auditoria`)
- Dashboard: tarjetas "Deuda proyectada" y "Total disponible" (antes Deuda / Total en caja)
- **Ficha Historial por integrante (oct-2026):** botón en Tablas → Finanzas; resumen, cuotas con abono/saldo y pagos (temporada vigente o todo), exportable a Excel/PDF. Endpoint `GET /finanzas/historial/:persona_id?alcance=temporada|todo` (reusa las consultas del Portal)
- **Saldo a favor (oct-2026):** `services/saldoFavorService.js` aplica la parte no asignada de pagos de cuota a las cuotas pendientes más antiguas del integrante; automático al generar cuotas y con botón "Aplicar saldos a favor" en Cuotas (vista previa con `simular` antes de escribir). Puntaje según la fecha del pago original (`utils/puntajeCuotas.js`)

### Pendiente calamena
- UI para asignar manualmente `retiro_sin_aviso` (`vestimenta_distinta` ya se marca desde Tablas → Asistencias y Últimos registros; justificado y licencia_medica entran por Justificaciones)
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
# SSH (cuenta del cliente): ssh -p 65002 u402516660@45.152.44.96
# Ruta del proyecto (cada despliegue crea hbuilds/versions/<uuid>; solo queda la activa)
cd ~/domains/dev.gdcayquina.cl/hbuilds/current/nodejs   # o app.gdcayquina.cl

# Archivos subidos: FUERA de la app (el zip reemplaza la versión y borraría uploads).
# Variable de entorno UPLOADS_DIR en hPanel → sitio → Variables de entorno:
#   dev: /home/u402516660/uploads_gdc/dev   prod: /home/u402516660/uploads_gdc/app

# npm (no está en PATH, usar ruta completa)
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Redesplegar: subir zip nuevo (git archive) en hPanel → Sitios web → <sitio> → Despliegues
```
