-- Carga de las actividades de la Fiesta de Ayquina 2026, extraídas del tríptico
-- oficial "PROGRAMACIÓN FIESTA DE AYQUINA 2026" entregado por el cliente.
--
-- Criterio de tipo: el documento solo distingue Presentación (turnos de baile,
-- entrada, procesión, saludo del alba, baile de la fogata, despedida) y Misa /
-- ceremonia religiosa sin baile. El enum de `eventos.tipo` no tiene un valor
-- "misa" propio, así que Presentación -> 'partido' y Misa -> 'reunion' (igual
-- que se usa en el resto del sistema).
--
-- `fecha` usa el horario de "cierre de asistencia" de cada actividad (no el de
-- citación ni el de inicio del turno/baile/misa), por instrucción del cliente:
-- es la hora que realmente importa para el corte de asistencia QR.
--
-- El resto de los horarios (citación, inicio de turno, saludo, etc.) y el
-- detalle de vestimenta por bloque/personaje quedan en `descripcion`, porque
-- el formulario de Nueva Actividad no tiene campos separados para eso.
--
-- Excepción: "Santa Misa 'Solemnidad a la Virgen María'" (2026-09-08, Explanada)
-- no trae horario de cierre de asistencia en el tríptico -- por indicación del
-- cliente se usa su horario de inicio ("Invitación: 11:00 horas") en su lugar.
--
-- Idempotente: cada INSERT valida por (nombre, fecha) antes de insertar, así
-- que se puede correr más de una vez sin duplicar actividades.

SET NAMES utf8mb4;
START TRANSACTION;

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Entrada de Pueblo 2026', 'partido', '2026-09-02 22:00:00', 'Pieza del Baile',
  'Ingreso a la Plaza 23:20 horas. Horario citación: 21:30 horas. Horario cierre asistencia: 22:00 horas. Horario inicio Saludo en Cristo: 22:20 horas. Vestimenta Gala Oficial - Damas: chaqueta institucional, beatle negro, pañuelo "Bodas de Diamante", guantes negros de cuero, falda negra oficial, pantis color piel, botas doradas oficiales, linterna oficial, peinado oficial (cola de caballo sin trenzas con colet negro), maquillaje sobrio y moderado, uso de aros oficiales (caretitas). Varones: chaqueta institucional, beatle negro, pañuelo "Bodas de Diamante", guantes negros de cuero, pantalón de vestir tela negra (no pitillo), cinturón negro, botas negras oficiales (sin cascabeles, cordones negros), espuela en bota derecha con porta espuela oficial (niños no usan espuela), linterna oficial, afeitados y si usan pelo largo tomarlo con colet negro. Notas: cancionero con código QR (permitido usar celular) o libro de canto.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Entrada de Pueblo 2026' AND fecha = '2026-09-02 22:00:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Misa Bendición de Trajes GDC 2026', 'reunion', '2026-09-03 06:15:00', 'Portal de Iglesia',
  'Misa 06:30 horas. Horario inicio citación: 06:00 horas. Horario cierre asistencia: 06:15 horas. Vestimenta: tenida formal (chaqueta, beatle, guantes, sin pañuelo, sin espuela; mujeres con pantalón negro y botas doradas). Notas: llevar parte de sus trajes (envueltos en aguayos); con Estandarte "Bodas de Diamantes"; con banda.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Misa Bendición de Trajes GDC 2026' AND fecha = '2026-09-03 06:15:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Ceremonia de la Luz', 'reunion', '2026-09-04 16:45:00', 'Pórtico de la Plaza',
  'Ceremonia 17:00 horas. Horario citación: 16:30 horas. Horario cierre asistencia: 16:45 horas. Vestimenta tenida semi formal oficial: chaqueta, polera, jeans negro y zapatillas. Notas: llevar antorchas o velas.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Ceremonia de la Luz' AND fecha = '2026-09-04 16:45:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Primer Turno Explanada', 'partido', '2026-09-05 11:45:00', 'Placita frente al Cristo',
  'Turno de 12:15 a 13:00 horas. Horario citación: 11:30 horas. Horario cierre asistencia: 11:45 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: gris, careta cuernos, peluquín negro; Perros del Infierno: gris; Chinas de Antaño: océano; Ñawpa: rojo; Chinas Supay: color; Osos: blanco; Chinas Doble Caras: Bodas de Oro; Luciferes & Waris: Gala 2 (azul); Virtudes: pleitesía; Tentaciones: color; Pecados Capitales: demonio; Diablesas: Gala Negro; Diablos: 4 Plagas; Jukumaris: color; K''acha Viuda - Yana Conciencia: naranja; Socios: jeans azules, polera negra socios, zapatillas, jockey negro. Notas: los momentos de hidratación serán terminando cada turno.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Primer Turno Explanada' AND fecha = '2026-09-05 11:45:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Segundo Turno Plaza Principal', 'partido', '2026-09-05 20:40:00', 'Cantera',
  'Turno de 21:10 a 21:40 horas. Horario citación: 20:25 horas. Horario cierre asistencia: 20:40 horas. Vestimenta: todo el baile con trajes "Bodas de Diamante"; Socios: jeans azules, beatle negro, chaqueta socio, zapatillas. Notas: entraremos danzando desde la Cantera hasta el Cementerio. Luces en caretas y en cetros según corresponda, sin linterna. Bloque Infantil: niñas con coronas con luces y ambos con linterna oficial. Con Estandarte "Bodas de Diamantes".'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Segundo Turno Plaza Principal' AND fecha = '2026-09-05 20:40:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Tercer Turno Plaza Principal', 'partido', '2026-09-06 02:30:00', 'Cantera',
  'Turno de 02:40 a 03:10 horas. Horario citación: 02:15 horas. Horario cierre asistencia: 02:30 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: Bodas de Oro; Perros del Infierno: negro; Chinas de Antaño: océano; Ñawpa: Bodas de Oro; Chinas Supay: discordia; Osos: negro; Chinas Doble Caras: centella; Luciferes & Waris: tradicional (rojo); Virtudes: color; Pecados Capitales: tradicional; Tentaciones: color; Diablesas: Bodas de Oro; Diablos: color; Jukumaris: Gala (nuevo); K''acha Viuda - Yana Conciencia: burdeo; Socios: jeans azules, beatle negro, chaqueta socio, zapatillas. Notas: luces en caretas y en cetros según corresponda, sin linterna. Bloque Infantil: niñas con coronas con luces y ambos con linterna oficial. Los momentos de hidratación serán terminando cada turno.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Tercer Turno Plaza Principal' AND fecha = '2026-09-06 02:30:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Cuarto Turno Plaza Principal', 'partido', '2026-09-06 14:40:00', 'Cantera',
  'Turno de 15:10 a 15:40 horas. Horario citación: 14:25 horas. Horario cierre asistencia: 14:40 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: negro; Perros del Infierno: gris; Chinas de Antaño: cobre; Ñawpa: negro/fucsia; Chinas Supay: tricolor; Osos: color; Chinas Doble Caras: cristal; Luciferes & Waris: Gala 1 (turquesa); Virtudes: pleitesía; Pecados Capitales: eucas; Tentaciones: multicolor; Diablesas: tradicional color; Diablos: tradicional naranja; Jukumaris: Bodas de Oro; K''acha Viuda - Yana Conciencia: tricolor; Socios: jeans azules, polera negra socios, zapatillas, jockey negro. Notas: entraremos danzando desde la Cantera hasta el Cementerio. Los momentos de hidratación serán terminando cada turno.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Cuarto Turno Plaza Principal' AND fecha = '2026-09-06 14:40:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Misa Abarsay y Ceremonia de Primera Comunión', 'reunion', '2026-09-06 19:45:00', 'Toma de asistencia por ingreso costado derecho de la iglesia',
  'Horario citación: 19:30 horas. Horario cierre asistencia: 19:45 horas. Inicio de misa: 20:00 horas. Vestimenta: tenida gala oficial, polera oficial; mujeres con falda y botas doradas, hombres con botas sin espuelín. Notas: con Estandarte "Bodas de Diamantes".'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Misa Abarsay y Ceremonia de Primera Comunión' AND fecha = '2026-09-06 19:45:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Quinto Turno Plaza Principal', 'partido', '2026-09-07 08:15:00', 'Cantera',
  'Turno de 08:35 a 09:10 horas. Horario citación: 08:00 horas. Horario cierre asistencia: 08:15 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: gris, careta cuernos, capucha; Perros del Infierno: blanco; Chinas de Antaño: océano; Ñawpa: Urus (plomo); Chinas Supay: color; Osos: negro; Chinas Doble Caras: trotamundos; Luciferes & Waris: Gala 2 (azul); Virtudes: calipso; Pecados Capitales: eucas; Tentaciones: multicolor; Diablesas: Bodas de Oro; Diablos: 4 Plagas; Jukumaris: color; K''acha Viuda - Yana Conciencia: negro/dorado; Socios: jeans azul, polera negra socio, polerón socios, zapatillas, jockey negro. Notas: los momentos de hidratación serán terminando cada turno.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Quinto Turno Plaza Principal' AND fecha = '2026-09-07 08:15:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Sexto Turno Explanada', 'partido', '2026-09-07 17:00:00', 'Placita frente al Cristo',
  'Turno de 17:30 a 18:15 horas. Horario citación: 16:45 horas. Horario cierre asistencia: 17:00 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: negro; Perros del Infierno: negro; Chinas de Antaño: océano; Ñawpa: color; Chinas Supay: tricolor; Osos: blanco; Chinas Doble Caras: cristal; Luciferes & Waris: Gala 1 (turquesa); Virtudes: color; Pecados Capitales: demonio; Tentaciones: color; Diablesas: Gala Negro; Diablos: color; Jukumaris: Bodas de Oro; K''acha Viuda - Yana Conciencia: tricolor; Socios: jeans azul, polera negra, polerón socios, zapatillas. Notas: los momentos de hidratación serán terminando cada turno.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Sexto Turno Explanada' AND fecha = '2026-09-07 17:00:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Misa de Vísperas', 'reunion', '2026-09-07 22:00:00', 'Pórtico acceso a Plaza',
  'Horario citación: 21:45 horas. Horario cierre asistencia: 22:00 horas. Vestimenta tenida semi formal oficial: chaqueta, polera, jeans negro y zapatillas.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Misa de Vísperas' AND fecha = '2026-09-07 22:00:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Saludo del Alba', 'partido', '2026-09-08 02:30:00', 'Pórtico de la Plaza (lugar de firma)',
  'Saludo de 02:42 a 03:00 horas. Horario citación: 02:15 horas. Horario cierre asistencia: 02:30 horas. Vestimenta: Gala Oficial (igual a la Entrada, mujeres con pantalones). Notas: con linterna; con Estandarte Bodas de Diamante; cancionero con código QR (permitido usar celular) o libro de canto.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Saludo del Alba' AND fecha = '2026-09-08 02:30:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Séptimo Turno Plaza Principal', 'partido', '2026-09-08 08:10:00', 'Cantera',
  'Turno de 08:30 a 09:00 horas. Horario citación: 07:50 horas. Horario cierre asistencia: 08:10 horas. Vestimenta: todo el baile con trajes "Bodas de Diamante"; Socios: jeans azul, polera blanca bodas diamante, chaqueta negra, zapatillas, jockey naranja. Notas: entraremos danzando desde la Cantera hasta el Cementerio. Con Estandarte "Bodas de Diamantes". Adornar caretas con chaya y serpentinas. Los momentos de hidratación serán terminando el turno. IMPORTANTE: este turno termina en la plaza; saliendo de ella paramos en la escuela (no hay turno en plaza de tierra).'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Séptimo Turno Plaza Principal' AND fecha = '2026-09-08 08:10:00');

-- Actividad 14: el tríptico no trae horario de cierre de asistencia para esta,
-- así que por indicación del cliente se usa el horario de inicio ("Invitación: 11:00 horas").
INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Santa Misa "Solemnidad a la Virgen María"', 'reunion', '2026-09-08 11:00:00', 'Explanada',
  'Invitación: 11:00 horas. Vestimenta tenida semi formal oficial: chaqueta, polera, jeans negro y zapatillas. Notas: bloque infantil con gorro legionario.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Santa Misa "Solemnidad a la Virgen María"' AND fecha = '2026-09-08 11:00:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Procesión Ayquina 2026', 'partido', '2026-09-08 14:55:00', 'Plaza de tierra (sector acceso cementerio)',
  'Horario de partida: 15:00 horas. Horario citación: 14:45 horas. Horario cierre asistencia: 14:55 horas. Horario de saludo: 16:30 a 16:40 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: Bodas de Oro; Perros del Infierno: gris; Chinas de Antaño: cobre; Ñawpa: rojo; Chinas Supay: discordia; Osos: color; Chinas Doble Caras: centella; Luciferes & Waris: tradicional (rojo); Virtudes: pleitesía; Pecados Capitales: eucas; Tentaciones: multicolor; Diablesas: tradicional color; Diablos: tradicional naranja; Jukumaris: Gala (nuevo); K''acha Viuda - Yana Conciencia: negro/dorado; Socios: jeans azul, polera negra socio, polerón negro socios, zapatillas, jockey negro. Notas: adornar caretas con chaya y serpentinas. Bloque infantil con gorro legionario o gorro carnavalero. Cancionero con código QR (permitido usar celular) o libro de canto.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Procesión Ayquina 2026' AND fecha = '2026-09-08 14:55:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Baile de la Fogata', 'partido', '2026-09-08 22:15:00', 'Cristo Peregrino',
  'Baile de 22:30 a 23:30 horas. Horario citación: 22:00 horas. Horario cierre asistencia: 22:15 horas. Vestimenta por personaje: Bloque Infantil igual que bloque adulto según personaje; Condenados: negro; Perros del Infierno: negro; Chinas de Antaño: océano; Ñawpa: color; Chinas Supay: color; Osos: negro; Chinas Doble Caras: cristal; Luciferes & Waris: Gala 1 (turquesa); Virtudes: color; Pecados Capitales: demonio; Tentaciones: color; Diablesas: Gala Negro; Diablos: tradicional naranja; Jukumaris: Bodas de Oro; K''acha Viuda - Yana Conciencia: naranja; Socios: jeans azul, beatle negro, chaqueta socios, zapatillas. Notas: sin caretas. Uso de linternas oficial, coronas o cetros con luces. Bloque Infantil: niñas con coronas con luces y ambos con linterna oficial.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Baile de la Fogata' AND fecha = '2026-09-08 22:15:00');

INSERT INTO eventos (nombre, tipo, fecha, ubicacion, descripcion)
SELECT 'Despedida', 'partido', '2026-09-09 19:30:00', 'Cantera',
  'Despedida de 20:00 a 20:40 horas. Horario citación: 19:15 horas. Horario cierre asistencia: 19:30 horas. Vestimenta: todo el baile con trajes "Bodas de Diamante"; Socios: tenida formal con pañuelo (mujeres pantalón negro tela). Notas: con Estandarte Bodas de Diamante. Sin careta. Cancionero con código QR (permitido usar celular) o libro de canto.'
WHERE NOT EXISTS (SELECT 1 FROM eventos WHERE nombre = 'Despedida' AND fecha = '2026-09-09 19:30:00');

-- Verificación: debe devolver 17 filas (las 17 actividades del tríptico).
SELECT id, nombre, tipo, fecha, ubicacion
FROM eventos
WHERE fecha BETWEEN '2026-09-02 00:00:00' AND '2026-09-09 23:59:59'
ORDER BY fecha;

COMMIT;
