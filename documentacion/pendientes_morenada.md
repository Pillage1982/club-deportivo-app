# Pendientes Unión Morenada Centralista

Valores heredados de GDC que se cambian cuando la agrupación los informe.
Bitácora para revisar con el cliente al arranque del proyecto: todo cambio o valor
heredado que haya que confirmar se anota aquí.

| # | Pendiente | Dónde se cambia | Estado |
|---|-----------|-----------------|--------|
| 1 | Monto de la cuota mensual (hoy $12.000, se reimpone en cada arranque) | `backend/config/migrations.js` → `consolidarTiposCuota()` | Esperando a la agrupación |
| 2 | Reglas de puntaje y temporada (hoy Estatutos GDC 2016) | `backend/utils/estatutoGdcRules.js` y sus pruebas en `backend/tests/` | Esperando a la agrupación |
| 3 | Tolerancia de atraso por defecto en el QR (hoy 15 min, heredado de GDC; cada actividad puede elegir la suya en el formulario de Actividades) | `frontend/js/config.js` → `asistencia.toleranciaMinutosAtraso` | Esperando a la agrupación |
| 4 | Ciudad de las cartas (hoy "Calama") | `backend/config/cliente.js` → `ciudadCarta` y `frontend/socio/js/documentos.js` → `membreteCarta()` | Confirmar o cambiar |
| 5 | Membrete "Baile Religioso" | `backend/config/cliente.js` → `membrete` y `frontend/socio/js/documentos.js` → `membreteCarta()` y carta de postulación | Esperando a la agrupación |
| 6 | Variables del hosting: `FRONTEND_URL` y `EMAIL_*` (`EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_TESORERIA`, `EMAIL_JUSTIFICACIONES`, `EMAIL_CAPORALES`, `EMAIL_SOLICITUDES_INGRESO`, `EMAIL_SECRETARIA`, `EMAIL_PRESIDENCIA`) y `UPLOADS_DIR` (carpeta de archivos subidos FUERA de la app: el zip de despliegue la borra) | Panel del hosting (variables de entorno) | Al crear el hosting |

## Llegado con la actualización desde la versión base (merge 21-10-2026)

Funciones nuevas que trajo el merge con valores o reglas propias de GDC. Quedan
tal cual hasta que la agrupación entregue sus estatutos y definiciones.

| # | Pendiente | Dónde se cambia | Estado |
|---|-----------|-----------------|--------|
| 7 | **Carta de permiso para el colegio: OCULTA.** El texto es el de GDC (devoción a la Virgen de Guadalupe de Ayquina, fiesta de septiembre). Para habilitarla la agrupación debe entregar: su carta modelo, fecha de fundación (asumida 09-09-2000), firmante (nombre y cargo), firma escaneada, timbre, sitio web y quién la aprueba (hoy admin y secretaria) | `backend/config/cartaPermiso.js` (`habilitada`, datos) + `frontend/js/config.js` → `cartaPermiso.habilitada`; texto en `backend/services/cartaPermisoPdf.js` y vista previa en `frontend/socio/js/documentos.js`; timbre en `backend/assets/timbre.png`; firma en `<UPLOADS_DIR>/firmas/firma_presidente.png` | Esperando a la agrupación |
| 8 | Temporada: la abre la actividad marcada "Inicia temporada" (en GDC, la Misa a la Chilena de septiembre). Las cuotas de la temporada van de **octubre a julio** | Marcar la actividad en Actividades; meses en `backend/utils/estatutoGdcRules.js` → `periodosCuotasTemporadaVigente()` | Confirmar qué actividad abre la temporada y qué meses se cobran |
| 9 | Categorías de actividad: Ensayo, Misa, Reunión, Presentación, Otros (las de GDC) | `frontend/js/config.js` (tipos de actividad) y `REFERENCIA_POR_TIPO_EVENTO` en `backend/controllers/socioDocumentosController.js` y `justificacionController.js` | Confirmar |
| 10 | Justificaciones: se reciben hasta 10 min antes de la actividad (Art. 8.7 Estatutos GDC); motivos trabajo / licencia médica / estudio / otro. Los mensajes del Portal y del panel citan artículos de los Estatutos GDC (8.4, 8.5, 8.7) | `MINUTOS_CIERRE_ASISTENCIA` en `backend/models/justificacionModel.js`; textos en `frontend/socio/index.html`, `frontend/socio/js/documentos.js`, `frontend/js/asistencias.js`, `backend/controllers/socioDocumentosController.js` | Ajustar al reglamento de la agrupación |
| 11 | Justificación manual (cartas que llegan fuera del Portal): solo temporada en curso y hasta un mes atrás; queda aprobada al guardar | `obtenerDesdeJustificacionManual` en `backend/models/justificacionModel.js` | Confirmar el plazo |
| 12 | Puntaje de vestimenta distinta y retiro sin aviso (Art. 8.4 GDC) | `backend/utils/estatutoGdcRules.js` | Esperando estatutos |
| 13 | Cuota de integración / "Pago Inscripción (Nuevo Integrante)": $40.000 (monto de GDC); aparece en el correo de bienvenida, el Portal y su propia línea del Balance del Dashboard | `backend/config/cuotaIntegracion.js` | Confirmar monto (o si existe) |
| 14 | Selector de toma de asistencia: muestra actividades hasta 12 h después de su inicio | `frontend/js/config.js` → `asistencia.horasActividadSeleccionable` | Confirmar |
| 15 | Roles del panel: secretaria, director1-3 (sin eliminar), coordinador. Definir qué cargos tiene la directiva y quién toma asistencia; los usuarios se crean por SQL con clave `umc123` | `backend/config/roles.js` | Pedir la lista de la directiva |
| 16 | Saldo del año anterior en el Balance general (dinero heredado de la directiva anterior) | Tarjeta "Total disponible" del Dashboard (lápiz) | Pedir el monto al arranque |
| 17 | Bloques "Socios" / "Socios honorarios": no entran a formaciones y se agrupan en una fila aparte en Asistencia por Bloque; los honorarios no pagan cuota | `backend/utils/formacionRules.js`, `backend/models/cuotaModel.js` | Confirmar nombres de bloques |
| 18 | Rebaja de cuota infantil 50% para menores de 12 años (Art. 2.1.B GDC) | `backend/models/cuotaModel.js` | Esperando estatutos |

## Llegado con la actualización desde la versión base (merge 23-10-2026)

| # | Pendiente | Dónde se cambia | Estado |
|---|-----------|-----------------|--------|
| 19 | **Ficha de ingreso en PDF** ("Súmate a la promesa"): calca la ficha en papel de GDC (estado civil, sacramentos, condición bailarín/socio, apoderado, baile anterior, firma, "Pago cuota inscripción"). Se quitó la marca GDC, pero el formato es el de GDC | `backend/services/fichaIngresoPdf.js`; campos en el formulario del sitio web y `backend/controllers/solicitudIngresoController.js` | Pedir la ficha propia de la agrupación |
| 20 | Etiqueta "Nuevo" en Integrantes: ingreso entre septiembre y diciembre del último septiembre (según la temporada de GDC) | `frontend/js/personas.js` y Dashboard (`backend/models/dashboardModel.js`) | Confirmar cuándo se considera "nuevo" |
| 21 | Puntaje "cuota al día": en **agosto y septiembre** (meses sin cuota en la temporada de GDC, oct-jul) basta con no deber cuotas anteriores | `MESES_SIN_CUOTA` en `backend/utils/estatutoGdcRules.js` | Ajustar junto con #8 (meses que se cobran) |
| 22 | Justificación aprobada antes de la actividad: el integrante **queda bloqueado** para esa actividad (no se registra su asistencia aunque asista). Definición de GDC | `responderAsistenciaExistente` en `backend/controllers/asistenciaController.js` | Confirmar |
| 23 | Registro manual de asistencia en actividades pasadas de la temporada: solo roles admin y secretaria (más soporte) | `ROLES_ASISTENCIA_MANUAL` en `backend/controllers/asistenciaController.js` | Confirmar quién puede hacerlo (ver #15) |

## También por recibir
- Cuenta bancaria para depósitos: `backend/config/cuentaDeposito.js` (hoy vacía; el portal muestra "datos pendientes").
- Estatutos en PDF: `backend/documentos/Estatutos.pdf` (sin archivo, el portal responde "Estatutos no disponibles").
- Lista de bloques y planilla de integrantes para la carga inicial.
- Dominio de la app.
- Logo en mejor calidad (el actual viene de una imagen de WhatsApp). Los íconos de la app (`frontend/img/icons/`) se generaron desde ese logo.
