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
- **Vestimenta distinta y retiro sin aviso (oct-2026):** dos botones por registro en Tablas → Asistencias y en la lista "Asistentes registrados" bajo el lector QR (lista completa con scroll; `PATCH /asistencia/:id/vestimenta` y `/:id/retiro`, body `{activo}`); solo sobre presente/atrasado, al quitarla vuelve a atrasado si tiene minutos y si no a presente; recalcula el puntaje
- Matching por cercanía horaria cuando existen varias actividades el mismo día
- **Asistencia manual en actividades pasadas (oct-2026):** botón "Registrar asistencia manual" en Tablas → Asistencias, solo roles `admin`/`secretaria` exactos y soporte (`soloAdminSecretaria`). Actividades ya realizadas de la temporada vigente (también finalizadas), varios integrantes a la vez; solo completa "sin registro" o reemplaza "ausente" (borra su multa pendiente), nunca pisa otro estado ni una justificación aprobada. Estados: presente/atrasado (minutos)/vestimenta distinta/retiro sin aviso; motivo obligatorio (queda en `auditoria`); recalcula el puntaje. `GET /asistencia/manual/opciones`, `GET /asistencia/manual/:evento_id/integrantes`, `POST /asistencia/manual`
- **Revisión de asistencia (oct-2026):** al asignar un escaneo "sin actividad" se calcula presente/atrasado con la hora del escaneo y la tolerancia; la cola offline manda `escaneado_en` (queda como `fecha_registro`) y un escaneo hecho durante una actividad que se finalizó antes de sincronizar reemplaza el ausente (mismo día o hasta 12 h tras el inicio); un 401 o un 403 de trámite pendiente ya no descarta la cola. "Cuota al día" en agosto/septiembre (sin cuota) = no deber cuotas anteriores (`condicionCuotaAlDia` en `puntajeModel.js`, `MESES_SIN_CUOTA`). Eliminar una actividad borra sus puntajes. Solo las provisionales "Actividad AAAA-MM-DD" no puntúan. Datos: `database/CORRECCION_puntaje_asistencia_septiembre_20261023.sql`. Desde el 11-08-2026 (5ab5428) hasta 721470b ningún escaneo generaba puntaje (verificarCuotaAlDia tenía 7 `?` y 6 valores; solo sumaban los recalculados por pago/justificación); datos: `database/DIAGNOSTICO_puntaje_asistencia_temporada_20261023.sql`. Historial de puntaje del panel (`GET /puntaje/historial`, `obtenerHistorialTemporada`): todas las actividades ya ocurridas de la temporada (ausente / sin registro con 0) + pagos de cuota, con scroll propio
- Selector de toma de asistencia: solo actividades no finalizadas y hasta 12 h después de su inicio (`config.js` → `horasActividadSeleccionable`); el panel "Sin asignar" sigue viendo todas
- Tolerancia de atraso por actividad (oct-2026): selector en el formulario de Actividades (`eventos.tolerancia_minutos`); por defecto 15 min (`config.js` → `toleranciaMinutosAtraso`), que también usan las actividades sin margen guardado
- Categorías de actividad (oct-2026): Ensayo (`entrenamiento`), Misa (`misa`), Reunión (`reunion`), Presentación (`partido`), Otros (`otro`)
- **Justificaciones (oct-2026):** el socio envía la carta desde el Portal del Socio (actividad: Ensayo/Misa/Reunión/Presentación/Otros, donde `referencia='salida'` = Presentación; motivo `motivo_tipo`: trabajo/licencia_medica/estudio/otro, y `tipo_solicitado` = licencia_medica solo si el motivo lo es); al aprobarla en Tablas → Justificaciones la asistencia queda `justificado`/`licencia_medica`, se borra la multa y se recalcula el puntaje. **Registro manual (oct-2026):** botón "Registrar manual" en Tablas → Justificaciones para cartas que llegan fuera del Portal (correo antiguo); queda aprobada al guardar (`POST /justificaciones/manual`, `justificaciones.origen='manual'`), mismo efecto en asistencia/multa/puntaje, aviso por correo al integrante; solo actividades de la temporada vigente y de hasta un mes atrás; no pisa presente/atrasado ni duplica una carta pendiente/aprobada
- Correo saliente configurado en dev y producción (oct-2026): SMTP de Hostinger, buzones @gdcayquina.cl
- **Depósitos en Portal del Socio (oct-2026):** Documentos → "Datos para depositar" (cuenta en `backend/config/cuentaDeposito.js`) y "Enviar comprobante de depósito" (tabla `comprobantes_deposito`, archivo en `uploads/comprobantes_deposito`, correo a `EMAIL_TESORERIA` o tesoreria@gdcayquina.cl). Tesorería los ve en Tablas → Depósitos y con "Registrar pago" (o 📎 en Tablas → Pagos) el pago usa ese mismo archivo como comprobante; `comprobantes_deposito.pago_id` marca el depósito como registrado (oct-2026)
- **Temporadas (oct-2026):** la abre la actividad marcada "Inicia temporada" (`eventos.inicia_temporada`); corta ranking, selector de temporadas, formaciones, historial de puntaje del panel, Portal y reporte de cuotas (todo el puntaje se ve desde el inicio de la temporada; el puntaje de una cuota nunca queda antes del 1-oct de su temporada). 2026-2027 la abre la Misa a la Chilena del 26-09-2026. Cuotas de la temporada vigente: `periodosCuotasTemporadaVigente()` en `estatutoGdcRules.js`, calculada por fecha (hora Chile): desde octubre, oct de ese año a jul del siguiente
- **Módulo de Gastos (jul-2026):** registro, categorías, responsable, comprobante adjunto y exportación
- **Módulo de Ingresos de terceros (oct-2026):** tabla `ingresos` (sin `persona_id`) para donaciones, premios y proyectos adjudicados; Tablas → Ingresos y Formularios → Ingreso, comprobante adjunto, exportación Excel/PDF. No afecta deuda ni puntaje
- **Balance general y Total en caja (oct-2026):** `/dashboard` entrega `balance` solo a admin/tesorero = saldo año anterior + (SUM pagos + SUM ingresos) − SUM gastos, calculado en vivo; el saldo año anterior es un monto fijo editable en la tarjeta (tabla `configuracion`, clave `saldo_anio_anterior`, `PUT /dashboard/saldo-anio-anterior`); tarjeta "Total en caja" + bloque "Balance general" en Dashboard (los pagos `tipo_pago='integracion'` van en su propia línea "Pago Inscripción (Nuevo Integrante)", fuera de "Pagos de integrantes"); se refresca al guardar/eliminar pagos, gastos e ingresos
- Sesión de 20 días y continuidad offline sin cierre forzado por falta de conexión
- **Tipo de pago y comprobante (oct-2026):** `pagos.tipo_pago` (cuota/traje/chaqueta/otro) + `detalle`; solo `tipo_pago='cuota'` rebaja la deuda (vista_estado_financiero y Portal), los extras suman a caja. `pagos.comprobante_path` opcional (uploads/comprobantes), ver/adjuntar desde Tablas → Pagos
- **Meses que se pagan (oct-2026):** en Formularios → Pago se marcan a mano las cuotas pendientes (cualquier temporada). 1 mes: abono parcial permitido. Varios meses con monto menor: se pagan los más antiguos y el último queda con abono. Sin meses marcados (tipo cuota): se aplica a las pendientes más antiguas; el sobrante queda a favor. El pago anual solo toma la temporada vigente. Cuotas con pagos parciales muestran la etiqueta "Abono $X" (formulario, Tablas → Cuotas con filtro "Con abono", Portal). La deuda del Portal se calcula por cuota (abonos a cuotas de la temporada + saldo a favor de pagos de cuota de la temporada), no por fecha de pago
- **Registro de actividad (oct-2026):** tabla `auditoria`, escrita por `middleware/auditoriaMiddleware.js` (montado en server.js antes de las rutas) en cada POST/PUT/PATCH/DELETE exitoso con sesión (panel o Portal); sin claves/PIN en el detalle; GET no se registran. Botón "Actividad" en la barra → modal con pestañas por módulo, filtro usuario/fechas. Solo roles `admin` y `secretaria` exactos y cuenta de soporte (`GET /auditoria`)
- **Integrantes y Retirados (oct-2026):** Tablas → Integrantes con filtro de estado (activo/receso); Tablas → Retirados = histórico de eliminados lógicos (`GET /personas/retirados`, fecha de retiro sacada de `auditoria`, sin fecha para retiros anteriores a la auditoría). Ambas tablas ordenadas por bloque y luego alfabético por nombre mostrado; en escritorio Nombre y RUT quedan fijos al desplazar (`.tabla-columnas-fijas`)
- **Asistencia por Bloque del Dashboard (oct-2026):** asistieron (presente/atrasado/vestimenta distinta) / esperados = integrantes activos del bloque × actividades del período; "—" si no hubo actividades de ese tipo. Honorario en bloque de baile cuenta en su bloque; bloques Socios/Socios honorarios y honorarios sin bloque van en una fila "Socios" al final
- **Carta de permiso para el colegio (oct-2026):** Portal → Documentos (cuenta del alumno; colegio, director/a, curso, desde/hasta, máx. 31 días; solo integrantes `activo`). Aviso a `EMAIL_SECRETARIA` (secretaria@) con copia a `EMAIL_PRESIDENCIA` (presidencia@). Tablas → Cartas colegio, solo roles `admin`/`secretaria` exactos y soporte: aprobar emite el PDF (pdfkit, tamaño carta, texto calcado de la carta 2023, estilo del mockup) y lo envía al correo del integrante; también se descarga en el Portal y el panel. Tabla `cartas_permiso` (años e integrantes se congelan al aprobar; el PDF se regenera al descargar). QR → `/verificar.html?c=<código>` → `GET /publico/cartas-permiso/:codigo`. La firma del presidente NO se versiona: va en `<UPLOADS_DIR>/firmas/firma_presidente.png` (sin ella no se emite el PDF). Fuentes y timbre en `backend/assets`. Spec: `documentacion/carta_permiso_colegio/ESPECIFICACION.md`
- **Ficha de ingreso "Súmate a la promesa" (oct-2026):** el formulario del sitio gdcayquina.cl pide los datos de la "Ficha de actualización de datos GDC" (domicilio, ciudad, estado civil, sacramentos, condición bailarín/socio + bloque, apoderado, baile religioso anterior y firma dibujada en canvas, PNG en `solicitudes_ingreso.firma_png`). `services/fichaIngresoPdf.js` calca la ficha en papel (hoja carta, Helvetica); va adjunta al correo de la directiva (`EMAIL_SOLICITUDES_INGRESO`: presidencia, secretaría, caporales) y en copia al postulante. Panel → Tablas → Solicitudes: botón "Ver ficha PDF" (`GET /solicitudes-ingreso/:id/ficha`, se regenera: muestra fecha de ingreso al aceptar y "Pago cuota inscripción" según pago `integracion`). Al aceptar pasan a `personas` la dirección (domicilio + ciudad) y los sacramentos. `/publico` acepta JSON hasta 200kb por la firma
- Dashboard: tarjetas "Deuda proyectada" y "Total disponible" (antes Deuda / Total en caja)
- **Ficha Historial por integrante (oct-2026):** botón en Tablas → Finanzas; resumen, cuotas con abono/saldo y pagos (temporada vigente o todo), exportable a Excel/PDF. Endpoint `GET /finanzas/historial/:persona_id?alcance=temporada|todo` (reusa las consultas del Portal)
- **Saldo a favor (oct-2026):** `services/saldoFavorService.js` aplica la parte no asignada de pagos de cuota a las cuotas pendientes más antiguas del integrante; automático al generar cuotas y con botón "Aplicar saldos a favor" en Cuotas (vista previa con `simular` antes de escribir). Puntaje según la fecha del pago original (`utils/puntajeCuotas.js`)

### Pendiente calamena
- Cancionero (Spotify + letras)
- Guía de uso general en dos versiones: Directiva (panel) e Integrantes (Portal). Ya existen guías puntuales del Portal en `documentacion/` (primer ingreso, pagos, recuperar contraseña) e instalación de la app

### En espera de definición del cliente
- ~~Justificación aprobada antes del evento y el socio igual asiste~~ DEFINIDO oct-2026: queda bloqueado para esa actividad, no se registra su asistencia (409 `codigo: JUSTIFICACION_APROBADA`, aviso en el lector y en la sincronización offline)
- ~~Socios y honorarios al cerrar actividades~~ DEFINIDO oct-2026: se mantienen; quedan "ausente" y reciben el aviso de inasistencia como todo integrante activo (la asistencia se considera para postular a cargos)
- ~~Folio de justificaciones~~ DEFINIDO oct-2026: una sola numeración para todas las justificaciones (Portal y manual comparten `justificaciones.id`), como ya funciona; postulaciones y cartas colegio mantienen su propia numeración
- Justificaciones: si la Junta de disciplina necesita rol propio.
- Guías .pptx/.pdf de `documentacion/` fuera de git (`.gitignore`); se guardan en Google Drive → carpeta "Documentos GDC"

### Pendiente offline (spec: prompt-asistencia-offline-sin-evento.md)
- Background Sync API (SyncManager en SW) — el fallback manual ya existe
- Creación de eventos offline (UUID temporal → ID real al sincronizar)
- Panel "Eventos duplicados" en admin
- Matching server-side (para escaneos de otros dispositivos)

### NexoComunidad v1.3-dev
- HECHO 2026-10-23/24 (commits 0d6392c→ffe8c01, falta revisar en devnexo y pasar a main): emailService genérico, apoderado <18 + fix es_honorario, orden integrantes, Excel con ExcelJS, cola offline, registro de actividad, hora de Chile en MySQL, Portal con contraseña (clave inicial = RUT) + Actualizar datos, Retirados/Reintegrar, pagos vinculados a cuotas (meses, abonos, saldo a favor), tipo de pago y comprobante, UPLOADS_DIR, Balance general, Ficha historial, depósitos desde el Portal. En NexoComunidad las multas siguen sumando a la deuda
- Pendiente: llevar estas mejoras de v1.3-dev a cliente/jjvv y cliente/jjvv-test

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

# IP real detrás de los proxies de Hostinger: server.js fija 'trust proxy' (por defecto
# solo proxies locales, verificado en dev: req.ip = IP real; variable TRUST_PROXY para
# ajustar, ej. 2, no hace falta hoy).

# npm (no está en PATH, usar ruta completa)
/opt/alt/alt-nodejs22/root/usr/bin/npm install

# Redesplegar: subir zip nuevo (git archive) en hPanel → Sitios web → <sitio> → Despliegues
```
