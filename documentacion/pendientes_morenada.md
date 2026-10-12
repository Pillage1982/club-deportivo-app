# Pendientes Unión Morenada Centralista

Valores heredados de GDC que se cambian cuando la agrupación los informe.

| # | Pendiente | Dónde se cambia | Estado |
|---|-----------|-----------------|--------|
| 1 | Monto de la cuota mensual (hoy $12.000, se reimpone en cada arranque) | `backend/config/migrations.js` → `consolidarTiposCuota()` | Esperando a la agrupación |
| 2 | Reglas de puntaje y temporada (hoy Estatutos GDC 2016) | `backend/utils/estatutoGdcRules.js` y sus pruebas en `backend/tests/` | Esperando a la agrupación |
| 3 | Tolerancia de atraso en el QR (hoy 30 min) | `frontend/js/config.js` → `asistencia.toleranciaMinutosAtraso` | Esperando a la agrupación |
| 4 | Ciudad de las cartas (hoy "Calama") | `backend/config/cliente.js` → `ciudadCarta` y `frontend/socio/js/documentos.js` → `membreteCarta()` | Confirmar o cambiar |
| 5 | Membrete "Baile Religioso" | `backend/config/cliente.js` → `membrete` y `frontend/socio/js/documentos.js` → `membreteCarta()` y carta de postulación | Esperando a la agrupación |
| 6 | Variables del hosting: `FRONTEND_URL` y `EMAIL_*` (`EMAIL_USER`, `EMAIL_PASS`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_TESORERIA`, `EMAIL_JUSTIFICACIONES`, `EMAIL_CAPORALES`, `EMAIL_SOLICITUDES_INGRESO`) | Panel del hosting (variables de entorno) | Al crear el hosting |

## También por recibir
- Cuenta bancaria para depósitos: `backend/config/cuentaDeposito.js` (hoy vacía; el portal muestra "datos pendientes").
- Estatutos en PDF: `backend/documentos/Estatutos.pdf` (sin archivo, el portal responde "Estatutos no disponibles").
- Lista de bloques y planilla de integrantes para la carga inicial.
- Dominio de la app.
- Logo en mejor calidad (el actual viene de una imagen de WhatsApp).
