# Correccion de puntaje de cuotas — 2026-08-14

Contexto completo del script `CORRECCION_puntaje_cuotas_20260814.sql`. Ver también
[[project_sistema_puntaje_gdc]] en memoria y `documentacion/matriz_validacion_estatuto_puntajes.md`.

## Origen del problema

La carga masiva historica de agosto-2026 (`backend/scripts/generate-gdc-refresh-sql.py`)
le dio 10 puntos base a cualquier cuota pagada, sin importar si se pago atrasada.
El Art. 9.3 dice que una cuota pagada fuera de plazo no debe sumar puntos. El modelo
correcto (el mismo que usa `pagoController.calcularPuntosCuota` en vivo) es:

- pagada antes del mes de la cuota → 20 puntos (anticipado)
- pagada en el mismo mes de la cuota → 10 puntos (oportuno)
- pagada despues del mes de la cuota → 0 puntos (atrasado)

Cuando una cuota se completa con varios pagos parciales se usa el pago mas reciente
(el que la deja `pagado`) para determinar el mes real.

## Validacion contra las cuadraturas manuales

Se restauro un respaldo de produccion del 2026-08-14 en MySQL local y se comparo,
persona por persona, el recalculo contra las cuadraturas manuales que hicieron los
lideres de los bloques Diablesas, Diablos y Chinas Supay (198 integrantes en total,
archivos "Cuadratura Diablesas/Diablos/Supay.xlsx"). El script completo (Parte 1+2+3)
se probo en la copia local antes de entregarlo.

- **Solo con el modelo general (Parte 1+2, sin ajustes puntuales): 147/198 (74%)**
  coinciden exacto → confirma que la formula es correcta.
- **Con los 17 ajustes puntuales (Parte 3): 161/198 (81%) coinciden exacto en el
  TOTAL**, y **cuotas + asistencia coinciden exacto en 197/198** (todas salvo
  Urquieta, ver mas abajo). Las diferencias de total que quedan son pura y
  exclusivamente por antiguedad, mas 1 caso de error en la propia cuadratura.
- **1 caso**: el resumen de la cuadratura no coincidia con el detalle fila-por-fila
  de la misma cuadratura (Saldias Nicolle, Diablesas, RUT 17007660-5) — se confirmo
  que la base de datos ya estaba correcta (asistencia=130, suma exacta de las
  celdas de la propia planilla) y el error estaba en la celda resumen "Total
  Asistencia" que puso el lider (dice 60, deberia decir 130). No se toco nada.
- **1 caso excluido a proposito**: Urquieta Conny Alexandra (20274334-K, Chinas
  Supay). Su fila en la cuadratura tiene las columnas "Pago al dia"/"Pago
  anticipado" **en blanco** (celda vacia, no un "0" escrito) pese a tener
  $120.000 pagados — la lideresa no alcanzo a revisar sus cuotas. No se fuerza a
  0: queda con el valor de la formula general (150 puntos) hasta que se confirme
  el numero real con el bloque.
- **35 casos**: difieren solo por antiguedad (asistencia y cuotas ya cuadran
  exacto). Ver tabla abajo — **no se corrige aqui**, es un problema de
  `personas.fecha_ingreso`, no de la tabla `puntajes`.

## Antiguedad — NO corregida aqui, requiere revision de `fecha_ingreso`

Estas 35 personas (de los 3 bloques documentados) tienen una diferencia entre la
antiguedad que calcula el sistema (`TIMESTAMPDIFF(YEAR, fecha_ingreso, CURDATE())`)
y la que anoto el lider de bloque, aun despues de que cuotas y asistencia ya
coinciden exacto. Varios pares muestran un patron de intercambio entre personas con
nombres parecidos (ej. dos "Cruz Ivan ...", dos "Araya"/Panire con los numeros
cruzados), lo que sugiere errores de fila en alguna de las dos fuentes, no un bug
de formula:

| RUT | Nombre | Bloque | Antig. guía | Antig. BD | Diff |
|---|---|---|---|---|---|
| 10374609-4 | Fernandez Winnie Johanna | Chinas Supay | 7 | 0 | -7 |
| 10701152-8 | Cruz Ivan Ernesto | Diablos | 11 | 40 | 29 |
| 11333186-0 | Fernandez Leonor Del Carmen | Chinas Supay | 0 | 7 | 7 |
| 12348023-6 | Panire Sandra Gina | Chinas Supay | 18 | 41 | 23 |
| 12581782-3 | Panire Nelly Mercedes | Chinas Supay | 41 | 18 | -23 |
| 13356687-2 | Cruz Mabel Alejandra | Chinas Supay | 15 | 1 | -14 |
| 14532604-4 | Araya Alfredo Luis | Diablos | 0 | 36 | 36 |
| 15014945-2 | Tapia Katherine Elizabeth | Diablesas | 0 | 10 | 10 |
| 15768718-2 | Leiva Diego Armando | Diablos | 10 | 3 | -7 |
| 15801275-8 | Gallardo Francisco Antonio | Diablos | 2 | 4 | 2 |
| 15982371-7 | Anza Paulina | Chinas Supay | 15 | 1 | -14 |
| 16565345-9 | Nogales Arturo Héctor | Diablos | 0 | 7 | 7 |
| 17093783-K | Gajardo Gabriel Antonio | Diablos | 4 | 5 | 1 |
| 17133263-K | Gonzalez Marina Romane | Chinas Supay | 12 | 17 | 5 |
| 17246165-4 | Olivares Yaritza Mayleen | Chinas Supay | 14 | 21 | 7 |
| 17530471-1 | Gómez Norma Alejandra | Chinas Supay | 4 | 6 | 2 |
| 19463396-3 | Anza Valeria Camila | Chinas Supay | 1 | 15 | 14 |
| 19538925-K | Gajardo Yeral Emadiel | Diablos | 5 | 4 | -1 |
| 19539400-8 | Vera Nayaret Merani | Chinas Supay | 0 | 1 | 1 |
| 19551697-9 | Gómez Valentina Paz | Chinas Supay | 6 | 4 | -2 |
| 20094158-6 | Cruz Ivan Alejandro | Diablos | 40 | 13 | -27 |
| 21186873-2 | Cruz Daniela Emilia | Chinas Supay | 1 | 15 | 14 |
| 21333912-5 | Olivares Paloma Belen | Chinas Supay | 6 | 14 | 8 |
| 22004189-1 | Araya Yeray | Diablos | 36 | 0 | -36 |
| 22029040-9 | Gonzalez Javiera Antonia | Chinas Supay | 17 | 2 | -15 |
| 22284026-0 | Nogales Matias Ignacio | Diablos | 7 | 0 | -7 |
| 22673891-6 | Olivares Poulett Alexandra | Chinas Supay | 21 | 6 | -15 |
| 22715529-9 | Cruz Joaquin Santiago | Diablos | 13 | 11 | -2 |
| 22893704-5 | Gonzalez Camila Ivonne | Chinas Supay | 2 | 12 | 10 |
| 23088741-1 | Gallardo Tomás Benjamín | Diablos | 4 | 2 | -2 |
| 23540955-0 | Tapia Monserrat Pascal | Diablesas | 10 | 0 | -10 |
| 23807085-6 | Flores Victoria Maygret | Chinas Supay | 0 | 6 | 6 |
| 23974726-4 | Leiva Axel Antonio | Diablos | 3 | 10 | 7 |
| 24152592-9 | Vera Agustina Jensey | Chinas Supay | 1 | 0 | -1 |
| 24583223-0 | Flores Eluney Guadalupe | Chinas Supay | 6 | 0 | -6 |

**Recomendacion:** pedir a cada lider de bloque que confirme la fecha real de
ingreso de estas personas antes de tocar `personas.fecha_ingreso`. No se debe
adivinar un valor.

## Alcance de la correccion aplicada

El script corrige **cuotas de todos los bloques del club** (no solo los 3
documentados), porque el modelo general quedo validado con el 74% de coincidencia
exacta sin ningun ajuste manual, y el resto de las diferencias se explican por
causas ya identificadas (antiguedad o casos puntuales ya resueltos). En el
respaldo de referencia esto implico recalcular 1421 de 1924 filas de puntaje de
cuotas pagadas en todo el club.

No se tocó nada de los bloques sin cuadratura mas alla de la formula general de
cuotas — si aparecen casos ambiguos ahi (pagos de varios meses de una sola vez),
no hay forma de detectarlos sin una revision manual como la que hicieron los
lideres de Diablesas/Diablos/Chinas Supay.

## Prueba realizada

El script completo (partes 0 a 4) se corrio contra una copia local del respaldo de
produccion (`calamena_backup_20260814`) antes de entregarlo. Resultado: 0 cuotas y
0 asistencias sin coincidir en los 3 bloques documentados (fuera de Urquieta,
excluida a proposito); 161/198 coincidencia exacta en el total.
