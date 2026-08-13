# Actualizacion incremental de pagos GDC — 2026-08-12

Generado a partir de comparar `Estado Financiero Cuotas GDC 2026 a julio actualizada.xlsx` (nuevo) contra `Estado Finaciero Cuotas GDC 2026.xlsx` (version ya cargada en produccion, referenciada en `backend/scripts/gdc-migration/README.md`).

## Que hace y que NO hace

- Compara ambos Excel mes a mes por RUT y calcula, con la misma lógica de asignación ya probada del proyecto (`paymentAllocation.js`), qué cuotas nuevas quedan cubiertas por los montos agregados en el archivo actualizado.
- **No reemplaza ni borra nada existente.** Solo agrega pagos/cuotas/puntajes para las combinaciones persona+mes que hoy no tienen datos. Si una cuota ya tiene un pago registrado (por esta vía o por la app en vivo), esa fila puntual se salta sola — no duplica fondos ni puntaje.
- Corrige el valor de mayo de la persona 24692998-K a $60.000 (confirmado como correcto); el archivo actualizado traía $30.000 por error de digitación. Ese mes específico **no se toca** en este script porque ya debería existir así en la base.
- El puntaje usa la misma regla que ya quedó aplicada en la consolidación del 12 de agosto (10 puntos base por cuota completada sin importar si fue atrasada, +10 de bono cuando un pago cubre más de un mes, 200 en el escenario de pago anual en octubre).

## Cómo aplicarlo

1. En phpMyAdmin, exportar un respaldo completo de la base (además de las tablas `respaldo_incremental_20260812_*` que el script crea automáticamente).
2. Ejecutar `ROLLBACK;` primero para cerrar cualquier transacción pendiente.
3. Importar `database/actualizar_pagos_incremental_20260812.sql` completo, una sola vez.
4. Revisar el resultado del `SELECT` final: `ruts_sin_match_en_personas` debe ser `0`. Si no lo es, esos RUT no encontraron persona correspondiente y no se aplicó nada para ellos (hay que revisarlos aparte, no reintentar el script tal cual).
5. Si algo sale mal antes del `COMMIT`, ejecutar `ROLLBACK;` y no reintentar sin revisar el error.

**Total: 72 personas, 501 periodos-cuota, $5.946.000 incremental, 493 periodos con puntaje nuevo (4950 puntos totales).**

| RUT | Nombre | Bloque | Fila Excel | Periodos nuevos | Monto nuevo | Puntaje nuevo |
|---|---|---|---|---|---|---|
| 20992433-1 | Alexandra Belén Araya Galleguillos | Chinas Doble Cara | 5 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24583223-0 | Eluney Guadalupe Flores Guzmán | Chinas Supay | 51 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24497584-4 | Javiera Paz Gahona Silva | Chinas Supay | 64 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 23511075-K | Monserrat Mariana Ramirez Ahumada | Chinas Supay | 83 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 17655441-K | Nicole Macarena Mancilla Peña | Chinas Supay | 91 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 110 |
| 10186349-2 | Sara Paulina Pizarro Campillay | Chinas Supay | 103 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 21222205-4 | Valentina Belen Varas Burgos | Chinas Supay | 112 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 16564816-1 | Nicoll Alejandra Astudillo Saavedra | Diablesas | 142 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 23717371-6 | Bastián Vladimir  Miranda Palta | Diablos | 162 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 10865909-2 | Benito Manuel Varas Tapia | Diablos | 163 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 22777012-0 | Daniel Ignacio Baltra Cardenas | Diablos | 174 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24233057-9 | Evans Nicolas Nan-Yao  Cordova Ayabire | Diablos | 178 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 10701152-8 | Ivan Ernesto Cruz Tello | Diablos | 188 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 22262018-K | Javier Orlando Cortés Romero | Diablos | 191 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 19538288-3 | Juan Ernesto Valdivia Parra | Diablos | 197 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 18189868-6 | Luis Miguel Puca Gavia | Diablos | 203 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24277809-K | Mateo Nicolás  Arancibia Cortes | Diablos | 206 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 21452001-K | Miguel Orlando Salva Diaz | Diablos | 214 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 23759640-4 | Santiago Alexander  Anza Salvatierra | Diablos | 221 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24893954-0 | Felipe Francesco  Muñoz Salvatierra | Infantil | 261 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 10347824-3 | Marianela Susana Valdivia Salva | Jukumaris | 301 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 21086809-7 | Nicolas Isaac Caro Muñoz | Jukumaris | 303 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 110 |
| 12581896-K | Marcos Antonio Flores Marin | Luciferes | 323 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 14596996-4 | Juan Alvaro Alfaro Robles | Ñawpas Hombre | 330 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 17093953-0 | Oscar Elias Arancibia Araya | Ñawpas Hombre | 333 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 13633292-9 | Sixto Elias Beltran Pasten | Ñawpas Hombre | 335 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 15982604-K | Romina Delicia Corrales Avalos | Ñawpas Mujer | 340 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 22464132-K | Fernanda Isidora Salvador Salvador | Tentaciones | 441 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 17974273-K | Elsa Alexandra Urquieta Salvatierra | Virtudes | 448 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 21255420-0 | Valery Elizabeth Lazo Rojas | Waris | 463 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $120.000 | 100 |
| 24584394-1 | Florencia Laura  Pasten Olivares | Chinas Supay | 56 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $110.000 | 90 |
| 17246165-4 | Yaritza Mayleen Olivares Valdivia | Chinas Supay | 121 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $110.000 | 90 |
| 16549080-0 | Nicole Monserrat Gallardo Rojas | Chinas Supay | 92 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $108.000 | 90 |
| 21333912-5 | Paloma Belen Olivares Gallardo | Chinas Supay | 94 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $108.000 | 90 |
| 22673891-6 | Poulett Alexandra  Olivares Gallardo | Chinas Supay | 100 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $108.000 | 90 |
| 18826196-5 | Marco Antonio Gahona Collao | Diablos | 204 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $108.000 | 90 |
| 20399418-4 | Javiera Michaelle Barraza Diaz | Virtudes | 450 | 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $108.000 | 90 |
| 16867904-1 | Viviana Stefany Zamora Mondaca | Chinas Supay | 116 | 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $84.000 | 70 |
| 21569385-6 | Yelitza Araceli Rojas Vargas | Chinas Doble Cara | 24 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03, 2026-04 | $80.000 | 60 |
| 21994905-7 | Constanza Trinidad Belen Chocobar Toledo | Chinas Doble Cara | 9 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03 | $72.000 | 60 |
| 18826997-4 | Yesica Araceli Rojas Vargas | Waris | 465 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02, 2026-03 | $70.000 | 50 |
| 16258642-4 | Yasmin Cecilia Guzman Henriquez | Chinas Doble Cara | 23 | 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $60.000 | 50 |
| 13357046-2 | Lenka Johanna Guzmán Condori | Chinas Supay | 69 | 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $60.000 | 50 |
| 26188319-8 | Agustina Pascal Tapia Rojas | Infantil | 243 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 25516080-K | Amelia Paz Ayabire Romero | Infantil | 244 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 25377126-7 | Eyddan Gabriel Tabilo Tabilo | Infantil | 259 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 27310337-6 | Javiera Montserrath Tirado Tabilo | Infantil | 268 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 20415628-K | Naska Pia Fernanda Valenzuela Robles | K'acha viuda | 315 | 2026-03, 2026-04, 2026-05, 2026-06, 2026-07 | $60.000 | 50 |
| 12423696-7 | Beatriz Irene Diaz Reales | Socios | 368 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 12093244-6 | Fabiola Noemí Robles Bugueño | Socios | 379 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 11932294-4 | Ilenia del Carmen Ferrer Ferrer | Socios | 382 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 8135760-9 | Janette del Rosario Pizarro Narea | Socios | 385 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 13417400-5 | Liliana Leticia Collao Adaros | Socios | 394 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 19538012-0 | Maite Constanza Tabilo Collao | Socios | 395 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 14455768-9 | Marcela Elena Corante Ramirez | Socios | 397 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 11720981-4 | Orlando Alberto Herrera Perez | Socios | 408 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 11566248-1 | Patricio Caro Vera | Socios | 412 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 7823254-4 | Rodolfo Rojas | Socios | 415 | 2025-10, 2025-11, 2025-12, 2026-01, 2026-02 | $60.000 | 50 |
| 18971723-7 | Constanza Fuentes Rivera | Chinas Doble Cara | 8 | 2025-10, 2025-11, 2025-12 | $32.000 | 20 |
| 24692998-K | Constanza Catalina Ayabire Romero | Infantil | 251 | 2026-03, 2026-04, 2026-05 | $30.000 | 20 |
| 13972906-4 | Andrea Paola Carvajal Diaz | Ñawpas Mujer | 336 | 2026-05, 2026-06, 2026-07 | $30.000 | 30 |
| 19463396-3 | Valeria Camila Anza Anza | Chinas Supay | 114 | 2026-04, 2026-05 | $24.000 | 20 |
| 15769208-9 | Ximena Magaly Borquez Dubo | Chinas Supay | 118 | 2025-10, 2025-11 | $20.000 | 10 |
| 22644907-8 | Nayarett Asiara Escarlett Rojas Quililongo | Diablesas | 139 | 2026-03, 2026-04 | $20.000 | 10 |
| 22715529-9 | Joaquin Santiago  Cruz Colamar | Diablos | 193 | 2026-06, 2026-07 | $20.000 | 20 |
| 15016244-0 | Daniel Rodrigo Peña Vera | Socios | 375 | 2026-01, 2026-02 | $18.000 | 20 |
| 22383189-3 | Andrea Aurora Herrera Corante | Chinas Supay | 32 | 2026-07 | $12.000 | 10 |
| 24042967-5 | Amy Sabrina Peña Lemos | Diablesas | 124 | 2026-07 | $12.000 | 10 |
| 22051053-0 | Yanira Dayan Beatriz Berna Lucas | Diablesas | 148 | 2026-05 | $12.000 | 10 |
| 21368676-3 | Benjamin Orlando Herrera Corante | Diablos | 166 | 2026-07 | $12.000 | 10 |
| 13010958-6 | Cesar Mauricio  Gahona Ramos | Diablos | 171 | 2026-07 | $12.000 | 10 |
| 6919066-9 | Soledad Del Carmen Dubos Cáceres | Socios | 423 | 2025-11 | $6.000 | 10 |
