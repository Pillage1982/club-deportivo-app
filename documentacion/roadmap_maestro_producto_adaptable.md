# Roadmap Maestro — NexoComunidad

Plataforma adaptable para administrar organizaciones: agrupaciones, clubes, academias, comunidades.

**Frase guía:** Una misma base técnica, configurable para cualquier organización, que ordena integrantes, actividades, asistencias y finanzas sin depender de planillas dispersas.

---

## Versiones completadas

### V1.0 — Base estable (main)
Login JWT, roles, integrantes, eventos, asistencias, multas, pagos, cuotas, estado financiero, dashboard, validaciones, permisos backend y frontend, despliegue Hostinger.

### V1.1 — Personalización por cliente
`config.js` con APP_CONFIG (nombre, logo, colores, etiquetas, tipos de actividad). La misma base funciona para agrupación religiosa, club deportivo u otro tipo de organización sin editar HTML.

### V1.2 — Usabilidad operativa
Filtros en todas las tablas, botones compactos, carga condicional por rol en main.js, funciones utilitarias centralizadas en utils.js.

### V1.3 (parcial) — calamena
- PWA offline-first: scanner QR sin evento ni red, IndexedDB, matching automático, retry backoff
- Email al cerrar evento (nodemailer defensivo)
- Generación masiva de cuotas (INSERT SELECT)
- Migraciones BD con guardas (INFORMATION_SCHEMA)
- Dashboard con endpoint único
- Exportación Excel/PDF para integrantes, asistencias, deudores y puntaje
- Sistema de puntaje GDC fases 1 y 2
- Pagos vinculados a cuotas
- Módulo de gastos con comprobantes
- Matching de actividades por cercanía horaria

---

## Próximas versiones

### V1.3 (completo) — Reportes y exportación
**Objetivo:** Entregar información lista para reuniones, directiva o rendición.

Reportes:
- Lista de deudores (cuotas + multas pendientes por integrante)
- Asistencias por evento o rango de fechas
- Cuotas del mes (pagadas / pendientes)
- Integrantes (lista completa con estado y contacto)
- Resumen financiero general

Implementación:
- **Excel**: SheetJS (CDN, client-side) — genera .xlsx desde datos en memoria
- **PDF**: jsPDF (CDN, client-side) — tablas simples, sin backend extra
- Botones de exportación en cada tabla existente

Estado en `cliente/calamena`: **implementado parcialmente** para integrantes, asistencias, deudores y puntaje. Pendiente portar al producto genérico y ampliar otros reportes cuando se prioricen.

---

### V1.4 — Portal de integrantes
Cada integrante accede a su propia ficha desde el celular.

- PWA separada (URL propia: `/socio/` o subdominio)
- Login por RUT + PIN auto-generado al enrolar
- Primer login obliga a cambiar PIN
- PIN enviado por email al enrolar
- Datos: bloque, estado, historial de asistencia, cuotas, pagos, deuda
- Solo lectura — no puede modificar nada

Estado: **pendiente** (implementar después de resolver despliegue en BlueHosting)

---

### V1.5 — Módulos opcionales por tipo de organización

| Organización | Módulos posibles |
|---|---|
| Agrupación religiosa | Vestimenta/trajes, instrumentos, viajes, aportes extraordinarios |
| Club deportivo | Categorías, partidos, convocatorias, estadísticas |
| Academia / taller | Cursos, horarios, matrículas, mensualidades |
| Comunidad / junta | Reuniones, actas, beneficios |

Estado: **no iniciado**

---

### V1.6 — Asistencia avanzada (offline completado en calamena)
Módulo offline-first ya implementado en `cliente/calamena`. Pendiente para nexo genérico:
- Background Sync API (SyncManager Chromium)
- Creación de eventos offline
- Matching server-side (multi-dispositivo)
- Panel eventos duplicados

---

### V1.7 — Pagos online
Integración Webpay/Transbank. No abordar antes de estabilizar V1.4 y V1.5.

---

### V2.0 — Multi-organización
Columna `organizacion_id` en tablas principales (personas, eventos, asistencias, cuotas, pagos, multas, usuarios). Cada cliente ve solo sus datos.

---

### V3.0 — SaaS comercial
Panel administrador global, planes de suscripción, módulos activables, subdominios por cliente, monitoreo, backup automático, auditoría.

---

## Sistema de puntaje GDC (módulo específico calamena)

Reemplaza el módulo de multas. Basado en Estatutos GDC 2016 (Art. 8-9).

Puntajes por asistencia:

| Ítem | Puntos |
|------|--------|
| Asistencia + cuota al día | +10 |
| Asistencia sin cuota al día | +5 |
| Atraso + cuota al día | +7 |
| Atraso sin cuota al día | +3 |
| Justificación + cuota al día | +5 |
| Licencia médica | +6 |
| Retiro sin aviso | -3 |

Puntaje por cuotas: +10 por mes pagado en plazo, +10 adicional si es anticipado.

Estado: **fases 1 y 2 implementadas** en `cliente/calamena`. Pendiente la interfaz para asignar manualmente los estados extendidos de asistencia.

---

## Definición pendiente del cliente — tolerancia QR

Existe una configuración global de tolerancia en `config.js`, actualmente en `0`. Cualquier ampliación queda en espera de que el cliente confirme:

- si desea aplicar tolerancia;
- cuántos minutos;
- si será global o configurable por actividad;
- cómo afectará el estado de asistencia y el puntaje.

No implementar valores ni cambios adicionales antes de recibir esa definición.

---

## Prioridad inmediata (jul-2026)

1. Configurar EMAIL_PASS en Hostinger devclub
2. Interfaz para estados especiales de asistencia
3. Validación funcional de los módulos recientes en devclub
4. Portal del socio — después de resolver despliegue BlueHosting

La tolerancia QR no entra en la prioridad de desarrollo hasta que el cliente entregue su definición.
