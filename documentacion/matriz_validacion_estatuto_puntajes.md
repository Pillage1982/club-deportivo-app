# Matriz estatutaria del puntaje y formacion GDC

Fuente primaria revisada: `Estatutos_BaileGDC.pdf`, Estatuto GDC 2016,
15 paginas, vigencia desde el 1 de enero de 2016 (art. 13.1).

Estado del resultado: **no oficial hasta completar las clasificaciones y reglas
pendientes indicadas en esta matriz**.

## Reglas confirmadas

| Articulo | Regla estatutaria | Aplicacion requerida | Estado |
|---|---|---|---|
| 2.1 D-E | Bailarines registran asistencia y deben participar en actividades programadas; representante registra a menores de 7 presentes | Mantener registro por persona y actividad | Implementado |
| 2.1 I | Receso conserva antiguedad, pero el ano de receso no suma y esta exento de pago | Excluir anos de receso del punto anual | Datos historicos de receso faltantes |
| 2.1 M-N | Deudas deben pagarse antes de Despedida de Pueblo; impago suspende actividades | Reportar elegibilidad/suspension separada del puntaje | Flujo pendiente |
| 3.2 y 5.5 | Voz/voto exige 50% de asistencia y cuotas al dia | Indicador de elegibilidad electoral | Pendiente; no altera por si solo la fila |
| 3.3 | Postulacion a directiva exige actividad, 3 anos, 50% de asistencia y pagos al dia | Indicador de elegibilidad | Pendiente fuera del ranking de fila |
| 5.1 | Caporal exige 5 anos, 75% de actividades, pagos al dia y cumplimiento por 3 anos | Indicador historico de elegibilidad | Pendiente fuera del ranking de fila |
| 6.1 e | Caporales asignan lugares segun el sistema objetivo e informatico | Ranking auditable | Parcial |
| 6.1 h-i | Caporales pueden cambiar guias y filas por capacidad, independiente del puntaje | Ajuste manual con motivo, auditoria y aprobacion de asamblea | Regla confirmada; flujo pendiente |
| 8.1 | Solo puntuan actividades citadas y definidas como puntuables | Clasificacion explicita por evento | Bloqueante: eventos provisionales sin clasificar |
| 8.4 | Presente: 10 al dia, 5 sin estar al dia | Puntaje base de asistencia | Implementado |
| 8.4 | Atraso: 7 al dia, 3 sin estar al dia | Puntaje base de atraso | Implementado |
| 8.4 | Justificacion: 5 al dia, 1 sin estar al dia | Puntaje base de justificacion | Implementado |
| 8.4 | Retiro sin aviso en actividad oficial: -3 | Puntaje negativo | Implementado |
| 8.4 | Vestimenta distinta: 3 al dia, 1 sin estar al dia | Puntaje base | Implementado |
| 8.4 | Licencia medica: 6 | Puntaje base | Implementado |
| 8.5 | Registro abre 30 minutos antes y cierra 10 minutos antes del inicio, salvo excepcion informada | Ventana de registro por evento | Pendiente; tolerancia actual no representa esta regla |
| 8.7-8.9 | Justificaciones se reciben hasta cierre y requieren respaldo/canal oficial | Fecha, medio y documento de respaldo | Pendiente |
| 9.1.1 a | Primer proceso: primer ensayo general a Despedida; cada actividad maximo 10; suma de ensayos dividida por 3 | En 2025-2026 los ensayos generales comienzan el primer sabado de junio; division con redondeo convencional | Regla de temporada confirmada |
| 9.1.1 b | Actividades de Fiesta de Ayquina valen 1 punto cada una | Excluirlas excepcionalmente del calculo 2025-2026 | Regla de temporada confirmada |
| 9.1.1 c | Antiguedad: 1 punto por ano, sin limite | Calculo descontando recesos | Pendiente por historial de recesos |
| 9.1.1 d | Sumar actividades oficiales post Ayquina hasta procesion del 8 de diciembre | Clasificar eventos y fecha de corte | Pendiente |
| 9.1.1 e | Bailarin nuevo recibe 1 punto al final | Nuevo: menos de un ano al corte o ingreso desde el 1 de septiembre que inicia la temporada | Regla confirmada; falta depurar fechas de ingreso |
| 9.1.2 | Segundo proceso adiciona actividades anteriores al primer ensayo; define lugar individual y suma por bloque/fila | Acumulado por ciclo y subtotal por bloque | Pendiente |
| 9.1.3 | Ranking alterna guias: primero sector A/impares, segundo sector B/pares y continua segun figura | Disposicion espacial de 12 puestos por fila | Pendiente; UI actual usa grupos de 8 |
| 9.2 | Puntaje se asocia al pago oportuno de cuotas y compromisos financieros definidos | Incluir conceptos puntuables explicitamente | Cuotas implementadas; otros compromisos no modelados |
| 9.3 | Cuota pagada en su mes: 10; cada mes anticipado: 10 adicional | Aplicar estrictamente la tabla: pago anual completo al inicio suma 200; oportuno 10, anticipado 20 y atrasado 0 | Implementado para cuotas importadas |
| 10.1-10.2 | Faltas y sanciones tienen reincidencia y consecuencias disciplinarias/economicas | Modulo disciplinario separado; no inventar descuento de puntaje | Pendiente; no sumar multas actuales al ranking |
| 12.2 | Ponderacion de bloque solo desempata la posicion del bloque en formacion | Ordenar bloques por suma y usar ponderacion unicamente en empate | Pendiente |
| 12.3 | Ninos, figurines y Condor quedan fuera de ponderacion; posicion ya definida | Condor mantiene puesto fijo; especiales fuera de ponderacion | Regla confirmada; falta registrar posiciones exactas |
| 13.2 | Cambios a arts. 8-10 requieren quorum simple y patrocinio estatutario | Versionar reglas y registrar acta que autoriza cambios | Pendiente de acuerdos posteriores |

## Ponderacion estatutaria de bloques (art. 12.2)

| Ponderacion | Bloque/fila |
|---:|---|
| 100 | Naupas - Chinas Naupas (Satanas) |
| 90 | Huari (Luciferes) |
| 80 | Chinas Supay |
| 70 | Jukumari |
| 60 | Virtudes - Pecados |
| 50 | Tentaciones |
| 40 | Doble Cara |
| 30 | Diablesas |
| 20 | Diablos |
| 10 | K'achas viudas - Yana Conciencia |

Ninos, Figurines y Condor tienen posicion definida y no usan esta ponderacion
(art. 12.3). Para 2025-2026 se confirma que Condor conserva siempre su puesto
fijo; Oso permanece en la tabla de ponderacion del articulo 12.2.

## Datos bloqueantes para el calculo oficial

1. Los 23 eventos importados como `Actividad AAAA-MM-DD` no pueden verificarse
   y quedan fuera del calculo oficial. No se inferira su categoria.
2. Identificacion de Despedida de Pueblo y procesion del 8 de diciembre. Para
   2025-2026, el primer ensayo general es el 6 de junio de 2026 y los siguientes
   se realizan cada sabado.
3. Historial de recesos para descontar anos de antiguedad.
4. Depuracion de fechas de ingreso nulas o no confiables. La condicion de nuevo
   ya fue definida: menos de un ano al corte o ingreso desde el 1 de septiembre
   inicial de la temporada (ejemplo 2024-2025: 2024-09-01 o posterior).
5. Compromisos financieros distintos de cuotas que hayan sido definidos como
   puntuables.
6. No existen reformas posteriores vigentes. Para 2025-2026 se confirma cuota
   anual de $120.000, distribuida en 10 pagos de $12.000.
7. La division de ensayos por 3 usa redondeo convencional: primer decimal 5 o
   mayor redondea hacia arriba; 4 o inferior, hacia abajo.

Hasta completar estos datos, `database/actualizar_puntajes_asistencia_post_pagos.sql`
solo representa el puntaje base del articulo 8.4 y pagos del articulo 9.3; no
produce por si solo el ranking estatutario completo del articulo 9.
