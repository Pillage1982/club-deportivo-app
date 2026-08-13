# Desglose mes a mes — 23 integrantes con $120.000 pagados (no en octubre)

Calculado desde `Estado Financiero Cuotas GDC 2026 a julio actualizada.xlsx`, con la misma lógica de puntaje ya aplicada en la consolidación del 12 de agosto (10 pts base por cuota completada, +10 de bono por cada mes posterior al pago grande, tope 200 solo si todo se pagó en octubre).

Para verificar contra la base real, usar `database/CONSULTA_detalle_23_integrantes.sql` y comparar el total por persona. Si se necesita el detalle mes a mes real de alguno en particular:

```sql
SELECT c.anio, c.mes, c.monto, pt.puntos, pt.detalle, pt.fecha
FROM puntajes pt
JOIN cuotas c ON c.id = pt.cuota_id
JOIN personas p ON p.id = pt.persona_id
WHERE p.rut = 'AQUI_EL_RUT'
ORDER BY c.anio, c.mes;
```

---

## 20347778-3 — Carolina Andrea Aguilera Rodriguez — TOTAL: 120
Pago único: Mayo 2026, $120.000

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 | 10 | base |
| Noviembre 2025 | 10 | base |
| Diciembre 2025 | 10 | base |
| Enero 2026 | 10 | base |
| Febrero 2026 | 10 | base |
| Marzo 2026 | 10 | base |
| Abril 2026 | 10 | base |
| Mayo 2026 | 10 | base (mes del pago) |
| Junio 2026 | 20 | anticipado (posterior al pago) |
| Julio 2026 | 20 | anticipado (posterior al pago) |

## 22723843-7 — Maximiliano Jesus Aguilera Robles — TOTAL: 140
Pago único: Marzo 2026, $120.000

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 | 10 | base |
| Noviembre 2025 | 10 | base |
| Diciembre 2025 | 10 | base |
| Enero 2026 | 10 | base |
| Febrero 2026 | 10 | base |
| Marzo 2026 | 10 | base (mes del pago) |
| Abril 2026 | 20 | anticipado |
| Mayo 2026 | 20 | anticipado |
| Junio 2026 | 20 | anticipado |
| Julio 2026 | 20 | anticipado |

## 24504416-K — Isabella Cataleya Aguilera Robles — TOTAL: 140
Idéntico patrón al anterior: pago único Marzo 2026, $120.000. Mismo desglose que Maximiliano Aguilera Robles.

## 16259337-4 — Carlos Humberto Aguilera Vega — TOTAL: 140
Idéntico patrón: pago único Marzo 2026, $120.000. Mismo desglose que los dos anteriores.

## 23749198-K — Williams Daisuke Rounin Alcayaga Sotomayor — TOTAL: 110
Pagos mensuales oportunos Oct-Mayo ($12.000 c/u) + Junio $24.000 (cubre Junio + Julio)

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 – Junio 2026 (9 meses) | 10 c/u | base, cada uno pagado en su propio mes |
| Julio 2026 | 20 | anticipado (cubierto por el pago doble de junio) |

## 14596996-4 — Juan Alvaro Alfaro Robles — TOTAL: 100
Pago único: Julio 2026, $120.000 (no queda ningún mes posterior a julio, así que no hay bono)

| Mes | Puntos |
|---|---|
| Los 10 meses | 10 c/u — todos "base", ninguno anticipado |

## 23759640-4 — Santiago Alexander Anza Salvatierra — TOTAL: 100
Mismo patrón: pago único Julio 2026, $120.000. 10 pts × 10 meses.

## 22146800-7 — Oscar Ivan Aramayo León — TOTAL: 170
Pago único: Diciembre 2025, $120.000

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 | 10 | base |
| Noviembre 2025 | 10 | base |
| Diciembre 2025 | 10 | base (mes del pago) |
| Enero–Julio 2026 (7 meses) | 20 c/u | anticipado |

## 19867652-7 — Karen Alexandra Aramayo León — TOTAL: 170
Idéntico patrón al anterior (probablemente pareja/familia con Oscar Aramayo León): pago único Diciembre 2025, $120.000.

## 17093953-0 — Oscar Elias Arancibia Araya — TOTAL: 100
Pago único Julio 2026, $120.000. 10 pts × 10 meses, sin bono.

## 24277809-K — Mateo Nicolás Arancibia Cortes — TOTAL: 100
Mismo patrón: pago único Julio 2026, $120.000.

## 10241653-8 — Alejandra Cynthia Arancibia Pizarro — TOTAL: 110
Mismo patrón que Williams Alcayaga: pagos mensuales oportunos Oct-Mayo + Junio $24.000 (cubre Junio+Julio). Julio anticipado (20 pts), resto base (10 c/u).

## 20992433-1 — Alexandra Belén Araya Galleguillos — TOTAL: 100
Pago único Julio 2026, $120.000. Sin bono (no queda mes posterior a julio).

## 16785228-9 — Alejandro Ventura Araya Bautista — TOTAL: 100
Mismo patrón: pago único Julio 2026, $120.000.

## 11931043-1 — Yorka Arce Echeverria — TOTAL: 120
Pago único Mayo 2026, $120.000. Igual patrón que Carolina Aguilera Rodriguez (Jun+Jul anticipados).

## 20399143-6 — Yulian Alejandra Arevalo Araya — TOTAL: 170
Pago único Diciembre 2025, $120.000. Igual patrón que Oscar/Karen Aramayo León.

## 16564816-1 — Nicoll Alejandra Astudillo Saavedra — TOTAL: 100
Pago único Julio 2026, $120.000. Sin bono.

## 22777012-0 — Daniel Ignacio Baltra Cardenas — TOTAL: 100
Pago único Julio 2026, $120.000. Sin bono.

## 20399418-4 — Javiera Michaelle Barraza Diaz — TOTAL: 100
Marzo 2026 $12.000 (cubre Octubre, oportuno-atrasado normal) + Julio 2026 $108.000 (cubre el resto). Los 10 meses en 10 pts — el pago de julio no deja ningún mes posterior para generar bono.

## 7886094-4 — Minda Martina Barraza Milla — TOTAL: 120
Pago único Mayo 2026, $120.000. Igual patrón que Carolina Aguilera Rodriguez / Yorka Arce.

## 22297913-7 — Martina Anthonia Bastia Lacaye — TOTAL: 130
Pago único Abril 2026, $120.000

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 – Abril 2026 (7 meses) | 10 c/u | base |
| Mayo–Julio 2026 (3 meses) | 20 c/u | anticipado |

## 13633292-9 — Sixto Elias Beltran Pasten — TOTAL: 100
Pago único Julio 2026, $120.000. Sin bono.

## 21086809-7 — Nicolas Isaac Caro Muñoz — TOTAL: 110
Pago único Junio 2026, $120.000

| Mes | Puntos | Motivo |
|---|---|---|
| Octubre 2025 – Junio 2026 (9 meses) | 10 c/u | base |
| Julio 2026 | 20 | anticipado |

---

## Patrón general (para revisar rápido)

- **Pago único en Julio** (sin nada posterior que bonificar) → **100 pts**: Juan Alfaro, Santiago Anza, Oscar Arancibia Araya, Mateo Arancibia Cortes, Alexandra Araya Galleguillos, Alejandro Araya Bautista, Nicoll Astudillo, Daniel Baltra, Javiera Barraza, Sixto Beltran.
- **Pago único en Junio** (1 mes de bono: julio) → **110 pts**: Nicolas Caro. + los dos con pagos mensuales oportunos que rematan en junio (Williams Alcayaga, Alejandra Arancibia Pizarro).
- **Pago único en Mayo** (2 meses de bono: jun+jul) → **120 pts**: Carolina Aguilera Rodriguez, Yorka Arce, Minda Barraza.
- **Pago único en Abril** (3 meses de bono) → **130 pts**: Martina Bastia.
- **Pago único en Marzo** (4 meses de bono) → **140 pts**: Maximiliano Aguilera Robles, Isabella Aguilera Robles, Carlos Aguilera Vega.
- **Pago único en Diciembre** (7 meses de bono) → **170 pts**: Oscar Aramayo León, Karen Aramayo León, Yulian Arevalo Araya.

Ninguno debería mostrar 200 puntos en `puntajes`. Si alguno lo muestra, es el que hay que corregir.
