-- =====================================================================
-- GDC Calameña — Completar datos faltantes de integrantes
-- Preparado 2026-10-02.
-- Fuentes:
--   * Sistema:  integrantes_01-10-2026.xlsx (export del panel, 515 integrantes)
--   * Planilla: "Data GDC Junio 2026 Estatutos.xlsx", hoja consolidada Hoja9
--     (452 integrantes). Las hojas por bloque solo se usaron para apoderado
--     cuando Hoja9 lo traía vacío.
--
-- REGLA: SOLO COMPLETA CAMPOS VACÍOS. Nada que ya tenga valor se sobrescribe
-- (salvo el PASO 4b, que corrige comillas duplicadas como O''Higgins -> O'Higgins,
-- y el PASO 5 OPCIONAL de teléfonos mal formateados).
--   * Texto (email, teléfono, dirección, apoderado, RUT apoderado, observación):
--     se llena si está NULL o en blanco.
--   * Fechas y sexo: se llenan si están NULL.
--   * Bautizo / Comunión / Confirmación: solo pasan de 0 a 1 cuando la planilla
--     dice "Si". Nunca bajan de 1 a 0.
--   * NO se tocan: RUT, nombres, apellidos, bloque, estado, honorario.
--
-- Cruce: por RUT (450) y por nombre (2). Casos especiales:
--   * Alexis Jesus Vera Vera: la planilla trae 192055474-4 (typo); se usa el
--     RUT del sistema 19205547-4.
--   * Sebastian Gonzalez Segovia: sin RUT en el sistema (choque con Sayumi
--     Silva Valdivia, 24217189-6, que la planilla repite para ambos). Se cruza
--     por nombre completo y rut IS NULL; su RUT NO se modifica.
--
-- Normalización: celulares a +569XXXXXXXX, emails en minúscula sin espacios,
-- RUT apoderado a 12345678-K (solo con dígito verificador válido), fechas AAAA-MM-DD.
--
-- Cambios esperados según el export del 01-10 (el PASO 3 muestra el real):
--   bautizo           389
--   comunion          291
--   confirmacion      193
--   direccion         2
--   email             2
--   fecha_ingreso     2
--   fecha_nacimiento  2
--   nombre_apoderado  129
--   observacion       14
--   rut_apoderado     103
--   sexo              4
--   telefono          2
--
-- ANTES DE EJECUTAR:
--   1. Correr primero en PRUEBAS (u402516660_Diablada_dev) y revisar el PASO 3.
--   2. Respaldo de producción (phpMyAdmin > Exportar) antes de correrlo en
--      u402516660_Diablada_BD. El PASO 1 además guarda copia de las columnas.
--   3. Seleccionar la BD correcta en phpMyAdmin (este archivo NO trae USE a propósito).
--   4. Ejecutar por pasos, no todo de una vez.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 — Respaldo de las columnas que se van a completar
-- ---------------------------------------------------------------------
CREATE TABLE respaldo_completar_20261002_personas AS
SELECT id, apellido_paterno, email, telefono, direccion, nombre_apoderado, rut_apoderado, observacion, fecha_nacimiento, fecha_ingreso, sexo, bautizo, comunion, confirmacion
FROM personas;

SELECT COUNT(*) AS filas_respaldadas FROM respaldo_completar_20261002_personas;


-- ---------------------------------------------------------------------
-- PASO 2 — Tabla de carga con los datos de la planilla
-- (copia la estructura de personas para heredar tipos y collation)
-- ---------------------------------------------------------------------
CREATE TABLE carga_integrantes_20261002 AS
SELECT id AS persona_id, rut, nombres, apellido_paterno, apellido_materno,
       email, telefono, direccion, nombre_apoderado, rut_apoderado, observacion, fecha_nacimiento, fecha_ingreso, sexo, bautizo, comunion, confirmacion
FROM personas
WHERE 1 = 0;

ALTER TABLE carga_integrantes_20261002 MODIFY persona_id BIGINT NULL;

INSERT INTO carga_integrantes_20261002
  (rut, nombres, apellido_paterno, apellido_materno,
   email, telefono, direccion, nombre_apoderado, rut_apoderado, observacion, fecha_nacimiento, fecha_ingreso, sexo, bautizo, comunion, confirmacion)
VALUES
  ('13632640-6', 'Cristian Alejandro', 'Pizarro', 'Pizarro', 'cristian.alejandro.pizarro@gmail.com', '+56982413476', 'Psje Chile 2389', NULL, NULL, NULL, '1979-03-06', '2000-09-09', 'Masculino', 1, 1, 0),
  ('24924797-9', 'Antonia Belen', 'Araya', 'Gonzalez', 'kine.mgonzalezs@gmail.com', '+56975728711', 'Pasaje vecinal 4, sitio 14. Chunchuri Alto', 'Marina Gonzalez Segovia', '17133263-K', NULL, '2015-03-09', '2021-09-09', 'Femenino', 0, 0, 0),
  ('26085332-5', 'Francisca Carolina', 'Araya', 'Mancilla', 'carolinamancilla247@gmail.com', '+56991473850', 'Arauco Oriente 3175', 'Carolina Mancilla Elgueda', NULL, NULL, '2018-01-18', '2023-09-28', 'Femenino', 0, 0, 0),
  ('25516080-K', 'Amelia Paz', 'Ayabire', 'Romero', 'cintya.romero24@gmail.com', '+56963753843', 'Escocia 2666', 'Javier Cortes Romero', '18125490-4', NULL, '2016-09-23', '2024-09-27', 'Femenino', 1, 0, 0),
  ('24692998-K', 'Constanza Catalina', 'Ayabire', 'Romero', 'cintya.romero32@gmail.com', '+56963753843', 'Escocia 2666', 'Javier Cortes Romero', '18125490-4', NULL, '2014-07-24', '2024-09-27', 'Femenino', 1, 1, 0),
  ('27044985-9', 'Abraham Oseías', 'Carvajal', 'Gonzalez', 'ecisternasaraya@gmail.com', '+56990860177', 'Los Sauces 2412', 'Suan Gonzalez', '17392847-5', NULL, '2019-10-10', '2022-09-29', 'Masculino', 1, 0, 0),
  ('24560415-7', 'Eimy Angel', 'Cepeda', 'Halis', 'i.almonte.cortes@gmail.com', '+56933842924', NULL, 'Luz Almontes', '9632104-K', NULL, '2014-03-04', '2023-09-28', 'Femenino', 0, 0, 0),
  ('24766846-2', 'Millaray Rayen', 'Corante', 'Duran', 'rcorante@gmail.com', '+56945878889', 'Linzor 2207', 'Roberto Corante', '14308581-3', NULL, '2014-10-06', '2024-09-27', 'Femenino', 1, 1, 0),
  ('25010509-6', 'Cristobal Eduardo', 'Escobar', 'Carozzi', 'mj.carozzi_bg@hotmail.com', '+56978942423', 'Peine 386', 'Maroa Jose Carozzi', '16203401-4', NULL, '2015-06-10', '2023-09-09', 'Masculino', 0, 0, 0),
  ('25678307-K', 'Thaira Belen', 'Fabian', 'Tagle', 'jtagle13@gmail.com', '+56978824683', 'Hernan Cortes 3350', 'Jocelyn Tagle Morales', '16565096-4', NULL, '2017-02-18', '2021-09-09', 'Femenino', 1, 0, 0),
  ('26696664-4', 'Mateo Camilo', 'Flores', 'Olivares', 'rolandofloresaguirre.83@gmail.com', '+56957166355', 'Jaime Guzman 2214', 'Rolando Flores', '17656869-0', NULL, '2019-02-07', '2023-09-09', 'Masculino', 1, 0, 0),
  ('24829746-8', 'Pedro Camilo', 'Flores', 'Olivares', 'ron_lando@hotmail.com', '+56957166355', 'Jaime Guzman 2214', 'Rolando Flores', '17530471-1', NULL, '2014-12-16', '2022-09-29', 'Masculino', 1, 0, 0),
  ('24903088-0', 'Agustin Ignacio', 'Gahona', 'Borquez', 'yasnnaborquez24@gmail.com', '+56983917080', 'Curico 2587', 'Yasnna Borquez', '17654884-3', NULL, '2015-02-14', '2024-09-27', 'Masculino', 0, 0, 0),
  ('24711866-7', 'Luis David Lorenzo', 'Gahona', 'Collao', 'ingrigahona28@gmail.com', '+56974772176', 'Psj Colonia Oriente 3586', 'Ingri Gahona Collao', '16565483-8', NULL, '2014-08-10', '2019-09-27', 'Femenino', 1, 1, 0),
  ('25554671-6', 'Brayton Alejandro', 'Gajardo', 'Espinosa', 'catherineespinosatobar@gmail.com', '+56931870134', 'Cobija 3707 parcela 22', 'Catherine Espinosa', '19538925-K', NULL, '2016-01-01', '2021-09-09', 'Masculino', 1, 0, 0),
  ('24279624-1', 'Cathalina Linette', 'Gallardo', 'Fuentes', 'mf1513bva@gmail.com', '+56959174661', 'Caupolican 1365', 'Marcela Fuentes', '15982740-2', NULL, '2013-05-14', '2017-11-03', 'Femenino', 1, 0, 0),
  ('25407881-6', 'Noemy Katterinne Alexandra', 'Geraldo', 'Cisterna', 'ronaldgeraldo@gmail.com', '+56975677004', '4 Oriente 2603', 'Ronald Geraldo', '14599037-8', NULL, '2016-06-07', '2024-09-27', 'Femenino', 1, 0, 0),
  ('27540211-7', 'Lia Isidora', 'Geraldo', 'Vargas', 'vivivargascortes@gmail.com', '+56993015791', 'Valdivia 979', 'Viviana Vargas', '19952628-6', NULL, '2021-05-20', '2021-05-25', 'Femenino', 0, 0, 0),
  ('24916661-8', 'Francisco Damian', 'Gonzalez', 'Araya', 'yasnaaraya324@gmail.com', '+56988820023', 'Cobija 3707', 'Yasna Araya', '16785228-9', NULL, '2015-03-02', '2023-09-09', 'Masculino', 1, 0, 0),
  ('28367836-6', 'Lucían Emiliano', 'Maya', 'Pérez', 'sylvia.jofre@gmail.com', '+56975773752', 'Psje Tiltil Norte 1129 Manuel Rodriguez', 'Sylvia Jofré', NULL, NULL, '2024-02-28', NULL, 'Masculino', 0, 0, 0),
  ('24756453-5', 'Pia Ignacia', 'Menay', 'Molina', 'imolina1210@icloud.com', '+56976159144', 'Chala 2306', 'Rodrigo Santander', '12802173-6', NULL, '2014-09-28', '2023-09-28', 'Femenino', 1, 0, 0),
  ('24676016-0', 'Maximo Alfredo', 'Mendoza', 'Guerrero', 'anamariagp2265@hotmail.com', '+56978826777', '9 Norte 1009', 'Ana Maria Guerrero', NULL, NULL, '2014-04-05', '2021-10-01', 'Masculino', 0, 0, 0),
  ('26044167-1', 'Isaías Eliam', 'Molina', 'Gómez', 'yeliangel24@yahoo.es', '+56977340509', 'Cobija 2701 Condominio Los Alerces c.23', 'Angelica Corante Ramirez', '10149031-9', NULL, '2017-12-22', '2021-09-09', 'Masculino', 1, 0, 0),
  ('24905474-7', 'Manuel Angel Matias', 'Molina', 'Gomez', 'yeliangel24@yahoo.es', '+56977340509', 'Cobija 2701 casa 23', 'Angelica Corante', '10149031-9', NULL, '2015-02-19', '2018-10-06', 'Masculino', 1, 0, 0),
  ('25968491-9', 'Agustin Moises', 'Mundaca', 'Maluenda', 'nayi.maluenda59@gmail.com', '+56956753924', 'Psj. Arica 4205', 'Nayara Maluenda', '19825028-7', NULL, '2017-11-01', '2023-09-30', 'Masculino', 0, 0, 0),
  ('24893954-0', 'Felipe Francesco', 'Muñoz', 'Salvatierra', 'elsaurquietasalva@hotmail.com', '+56971009771', 'Colombia 3064', 'Elsa Salvatierra', '17974273-K', NULL, '2015-02-07', '2019-09-27', 'Masculino', 0, 0, 0),
  ('25016245-6', 'Julian Alonso', 'Nogales', 'Saldías', 'nicolles.meneses@gmail.com', '+56934364179', 'Alonso de Ercilla 2131', 'Nicole Saldias', NULL, NULL, '2015-06-15', '2020-09-09', 'Masculino', 1, 0, 0),
  ('26389857-5', 'Valentina Sophia', 'O''''rian', 'Collao', 'liliancollao903@gmail.com', '+56984059701', 'Honduras 3885', 'Liliana Collao', NULL, NULL, '2018-07-28', '2021-09-09', 'Femenino', 1, 0, 0),
  ('25545587-7', 'Joaquin', 'Oliden', 'Panire', 'ayeletpanire@gmail.com', '+56978818229', 'Freirina 2468', 'Ayelet Panire', '20347463-6', NULL, '2016-10-22', '2024-09-27', 'Masculino', 1, 0, 0),
  ('24966740-4', 'Bastian Daniel', 'Ossandon', 'vera', 'nayaret.merani@hotmail.com', '+56974107239', 'Psj . Guillermo cabrales #1643', 'Nayaret vera Paniagua', '19539400-8', NULL, '2015-04-21', '2024-09-25', 'Masculino', 1, 0, 0),
  ('24828427-7', 'Yarela Hellen', 'Oyarce', 'Panire', 'carmennpnre@gmail.com', '+56991342232', 'Campamento Likan Tatai casa 2', 'Sandra Panire', '12348023-6', NULL, '2014-12-12', '2025-09-26', 'Femenino', 1, 1, 0),
  ('27617117-7', 'Gabriel Jesús', 'Painequeo', 'Gahona', 'ingridgahona28@gmail.com', '+56974772176', 'Los Cactus 846', 'Ingri Gahona', '9020760-1', NULL, '2017-10-30', '2023-09-28', 'Masculino', 0, 0, 0),
  ('25743573-3', 'Rayen Millaray', 'Painequeo', 'Gahona', 'ingrigahona28@gmail.com', '+56974772176', 'Colonia Oriente 3586', 'Ingri Gahona Collao', '16565483-8', NULL, '2017-04-22', '2020-09-09', 'Femenino', 1, 0, 0),
  ('26262401-3', 'Mía', 'Palacios', 'Rosas', 'imolina1210@icloud.com', '+56976159144', 'Chala 2306', 'Rodrigo Santander', NULL, NULL, '2018-05-05', '2023-09-28', 'Femenino', 0, 0, 0),
  ('25318647-K', 'Rayen Eluney', 'Pasten', 'Diaz', 'pastelardo@hotmail.com', '+56968357108', 'Coquimbo 3624', 'Marcelo Pasten', NULL, NULL, '2016-03-16', '2024-09-27', 'Femenino', 1, 0, 0),
  ('25171203-3', 'Martina Luciana', 'Pasten', 'Olivares', 'bryanpasten2@gmail.com', '+56987321751', 'Costa Rica 2893 Casa 3', 'Bryan Pasten', '16565161-8', NULL, '2015-10-23', '2020-09-09', 'Masculino', 1, 0, 0),
  ('25433878-8', 'Agustina Danae', 'Riquelme', 'Reinaga', 'tatifran05@gmail.com', '+56989104192', 'Av Argentina 3806', 'Maria Isabel Araya', '15740823-2', NULL, '2016-06-29', '2025-09-29', 'Femenino', 1, 1, 0),
  ('25638263-6', 'Victoria Stephanie Pascal', 'Romero', 'Cea', 'aceaverakichi@gmail.com', '+56950161324', 'Pasaje Tuina 1074', 'Krishna Guerra', '13417529-K', NULL, '2017-01-18', '2024-09-27', 'Femenino', 0, 0, 0),
  ('25635267-2', 'Felipe', 'Salva', 'Calderón', 'rs1379@gmail.com', '+56962070713', 'Sonetos 1771', 'Ruben Salva', NULL, NULL, '2017-01-13', '2025-09-26', 'Masculino', 0, 0, 0),
  ('28093053-9', 'Emiliano Thomas', 'Santander', 'Santander', 'nsantander991@gmail.com', '+56926370737', 'Psje 11 de Septiembre 3412', 'Nathaly Santander', '17974007-9', NULL, '2023-03-09', '2023-09-09', 'Masculino', 1, 0, 0),
  ('25572199-2', 'Cristofer Andres', 'Silva', 'Valdivia', 'jvaldiviasalva@gmail.com', '+56989130352', 'Costa Rica 2893 Casa 1', 'Joselyn Valdivia', '15017334-5', NULL, '2016-11-17', '2020-07-12', 'Masculino', 0, 0, 0),
  ('26135065-3', 'Isabella Paz', 'Soto', 'Robles', 'jocelyn_roblesdiaz@hotmail.com', '+56964960311', 'Paso de Jama 4528', 'Rene Robles', '7173905-8', NULL, '2018-02-19', '2024-09-27', 'Femenino', 1, 0, 0),
  ('25377126-7', 'Eyddan Gabriel', 'Tabilo', 'Tabilo', 'liliancollao903@gmail.com', '+56984059701', 'Colonia Oriente 3586', 'Liliana Collao', '16565483-8', NULL, '2016-05-12', '2020-09-09', 'Masculino', 1, 0, 0),
  ('24501170-9', 'Vicente Leon', 'Tallar', 'Celti', 'dominiquefernanda.vega@gmail.com', '+56934482632', 'Emiliano Zapata 14735', 'Dominique Vega', NULL, NULL, '2014-01-08', '2024-09-27', 'Masculino', 1, 1, 0),
  ('25419756-4', 'Cristobal Alonso', 'Tapia', 'Cortes', 'cbaltra_05@gmail.com', '+56942212322', 'Psj Chacra Vieja 3780', 'Nora Cortes', '19538925-K', NULL, '2016-06-20', '2023-09-28', 'Masculino', 1, 0, 0),
  ('24760969-5', 'Fiorella Ignacia', 'Tapia', 'Gac', 'vale.gac.flores@gmail.com', '+56993389470', 'Tagua 4452', 'Pablo Tapia Dubo', '19867313-7', NULL, '2014-10-06', '2025-09-26', 'Femenino', 0, 0, 0),
  ('26188319-8', 'Agustina Pascal', 'Tapia', 'Rojas', 'yesiaraceli17@gmail.com', '+56972994016', 'Bañados Espinoza 2269', 'Yesica Rojas', '18826997-4', NULL, '2018-03-26', '2021-09-09', 'Femenino', 0, 0, 0),
  ('25066742-6', 'Cristobal Nicolas', 'Tirado', 'Garramuño', 'eligarramuno05@gmail.com', '+56965137118', 'Pasaje salar agua amarga 3598', 'Elizabeth Garramuño Escobar', '17867640-7', NULL, '2016-08-05', '2021-09-09', 'Masculino', 0, 0, 0),
  ('27310337-6', 'Javiera Montserrath', 'Tirado', 'Tabilo', 'cmaite893@gmail.com', '+56932556223', 'Honduras 3885', 'Maite Tabilo Collao', NULL, NULL, '2020-07-08', '2023-09-09', 'Femenino', 1, 0, 0),
  ('24736184-8', 'Bastian', 'Toro', 'Alvarez', 'yelisse.alvarez@gmail.com', '+56987552988', 'Psj El Trauco 645', 'Yelisse Alvarez', '13529059-9', NULL, '2014-09-07', '2024-09-09', 'Masculino', 1, 0, 0),
  ('25737832-2', 'Eimy Ignacia', 'Valenzuela', 'Plaza', 'haylen.plaza.f@gmail.com', '+56973960501', 'General Salvo 2950', 'Haylen Plaza', '18183734-9', NULL, '2017-04-17', '2024-09-27', 'Femenino', 1, 1, 0),
  ('24691307-2', 'Anthonella Ignacia', 'Vallejo', 'Meruvia', 'yosselinmeruvia5@gmail.com', '+56975767283', 'Arauco 2978', 'Yosselin Meruvia', NULL, NULL, '2014-07-21', '2023-09-09', 'Femenino', 0, 0, 0),
  ('25131204-4', 'Matias Felipe', 'Vasquez', 'Tapia', 'ledatapia1@gmail.com', NULL, 'Psj Linea 77 3670', 'Rolando Flores', '17656869-0', NULL, '2015-10-09', '2024-04-01', 'Masculino', 1, 1, 0),
  ('26190477-2', 'Leandro Damian', 'Vera', 'Barrera', 'carlosbarrera_02@hotmail.com', '+56957548247', 'Cirujano Videla 1582', 'Carlos Barrera', NULL, NULL, '2018-03-23', '2022-09-09', 'Femenino', 1, 0, 0),
  ('24974578-2', 'Nicolás Rodrigo', 'Vergara', 'Vargas', 'vargascortes.carolina@gmail.com', '+56933951191', 'Valdivia 979', 'Vanessa Vargas', '17734849-K', NULL, '2015-04-29', '2019-09-27', 'Masculino', 1, 0, 0),
  ('25935949-K', 'Liam Emilio', 'Yañez', 'Paredes', 'misa.vw90@gmail.com', '+56958723280', 'Calle Antofagasta #3326', 'Misael Yañez', '19328388-8', NULL, '2017-10-08', '2022-09-29', 'Femenino', 0, 0, 0),
  ('14596996-4', 'Juan Alvaro', 'Alfaro', 'Robles', 'juan_alfa24@hotmail.com', '+56984593801', 'AV Vasco de Gama 2972 Pobl Alemania', NULL, NULL, NULL, '1980-03-10', '2017-09-09', 'Masculino', 1, 1, 1),
  ('13633292-9', 'Sixto Elias', 'Beltran', 'Pasten', 'beltran016@gmail.com', '+56961491521', 'Portezuelo del inca 4188', NULL, NULL, NULL, '1979-08-16', '2025-06-01', 'Masculino', 1, 1, 1),
  ('13972906-4', 'Andrea Paola', 'Carvajal', 'Diaz', 'andrea_carva35@hotmail.com', '+56982198848', 'AV Vasco de Gama 2972 Pobl Alemania', NULL, NULL, NULL, '1980-12-09', '2017-09-09', 'Femenino', 1, 1, 1),
  ('15982604-K', 'Romina Delicia', 'Corrales', 'Avalos', 'rominacorravalos@gmail.com', '+56979580591', 'Los Chañares 2537, Villa Los Pimientos', NULL, NULL, NULL, '1985-05-31', '2017-09-09', 'Femenino', 1, 1, 1),
  ('10164368-9', 'Ximena Madeleine', 'Cure', 'Vega', 'xcure.70@gmail.com', '+56973743355', 'Psje Santiago Río Grande 1975', NULL, NULL, NULL, '1967-05-11', '2006-09-09', 'Femenino', 1, 1, 1),
  ('11377743-5', 'Ximena Solange', 'Oyarce', 'Vargas', 'xime1414@yahoo.es', '+56962663656', 'Justo Arteaga 2839 Villa Caspana', NULL, NULL, NULL, '1968-12-14', '2017-03-01', 'Femenino', 1, 1, 1),
  ('11377839-3', 'Jorge Enrique', 'Rojas', 'Araya', 'jroja2003@gmail.com', '+56986847222', 'Justo Arteaga 2839 Villa Caspana', NULL, NULL, NULL, '1969-03-20', '2018-09-27', 'Masculino', 1, 1, 1),
  ('13356650-3', 'Marcela Andrea', 'Sanchez', 'Godoy', 'sanchezmarcela19@gmail.com', '+56977472045', 'Ascotan 1627, Villa Ayquina', NULL, NULL, NULL, '1978-02-19', '2017-09-09', 'Femenino', 1, 1, 0),
  ('11722186-5', 'Manuel Alexis', 'Santander', 'Cerezo', 'msantan05@gmail.com', '+56993690424', 'Ascotan 1627, Villa Ayquina', NULL, NULL, NULL, '1971-10-30', '1990-09-09', 'Masculino', 1, 1, 0),
  ('17974007-9', 'Nathaly Katherine Valeria', 'Santander', 'Cruz', 'nsantander991@gmail.com', '+56926370737', 'Ascotan 1627, Villa Ayquina', NULL, NULL, NULL, '1991-08-15', '1991-09-09', 'Femenino', 1, 1, 0),
  ('7837094-7', 'Mario Eduardo', 'Velasquez', 'Diaz', 'mvelasquezd@gmail.com', '+56999596997', 'AV B O''Higgins 726', NULL, NULL, NULL, '1959-02-04', '1987-09-09', 'Masculino', 1, 1, 1),
  ('9235424-5', 'Sergio Raul', 'Velasquez', 'Diaz', 'sergioraulvelasquezdiaz@gmail.com', '+56996790705', 'Psje Santiago Río Grande 1975', NULL, NULL, NULL, '1963-08-03', '2006-10-10', 'Masculino', 1, 1, 1),
  ('16565539-7', 'Daniela Su-Yen', 'Yueng', 'Pizarro', 'su-yen@hotmail.com', '+56992967980', 'Canada 2265 Pobl Independencia', NULL, NULL, NULL, '1987-03-12', '2009-09-09', 'Femenino', 1, 1, 0),
  ('20525627-K', 'Genesis Alexandra', 'Aguilar', 'Valdivia', 'genesis2808aguilar@gmail.com', '+56934084317', 'Psj Rupanco 1792', NULL, NULL, NULL, '2000-08-28', '2004-09-09', 'Femenino', 1, 1, 1),
  ('21148670-8', 'Yarella Belen', 'Aguilar', 'Valdivia', 'yarellavaldivia1102@gmail.com', '+56934339351', 'Psj Rupanco 1792', NULL, NULL, NULL, '2002-10-11', '2006-09-09', 'Femenino', 1, 1, 0),
  ('20347778-3', 'Carolina Andrea', 'Aguilera', 'Rodriguez', 'carolandrea0518@gmail.com', '+56966106767', 'Antofagasta 1291', NULL, NULL, NULL, '2000-05-05', '2024-09-27', 'Femenino', 1, 1, 1),
  ('21191501-3', 'Millaray Nicole', 'Alvarez', 'Godoy', 'millaray.mnag20022@gmail.com', '+56957157436', 'Hugo Vidal Zambrano 2757', NULL, NULL, NULL, '2002-12-09', '2022-09-29', 'Femenino', 1, 1, 1),
  ('16683254-3', 'Maria Francisca', 'Andrade', 'Jofre', 'davicitoo2767@gmail.com', '+56986913905', 'Colo Colo 2767', NULL, NULL, NULL, '1988-02-29', '1997-09-09', 'Femenino', 1, 1, 1),
  ('19463396-3', 'Valeria Camila', 'Anza', 'Anza', 'valery_anza@hotmail.com', '+56995122361', 'Aldunate 1065', NULL, NULL, NULL, '1997-11-04', '2010-09-09', 'Femenino', 1, 1, 0),
  ('15982371-7', 'Paulina', 'Anza', 'Arnes', 'paulihiker@gmail.com', '+56991824818', 'General salvo #3520', NULL, NULL, NULL, '1985-03-24', '2024-09-09', 'Femenino', 1, 1, 1),
  ('10241653-8', 'Alejandra Cynthia', 'Arancibia', 'Pizarro', 'alejandra.c.a.p19@gmail.com', '+56989394211', 'Volcan Olca 3535', NULL, NULL, NULL, '1965-01-19', '2018-09-27', 'Femenino', 1, 1, 1),
  ('23441892-0', 'Fernanda Camila', 'Araya', 'Mancilla', 'carolina.mancilla247@gmail.com', '+56991473850', 'Arauco Oriente 3175', 'Carolina Mancilla Elgueda', '15024044-1', NULL, '2010-10-02', '2023-09-28', 'Femenino', 1, 1, 0),
  ('9270984-1', 'Elsa Alejandrina', 'Avalos', 'Montejo', 'elsa.avalos66@gmail.com', '+56937424494', 'Vasco de Gama 2182', NULL, NULL, NULL, '1966-02-18', '2004-09-09', 'Femenino', 1, 1, 1),
  ('22951452-0', 'Tadish Belen Alicia', 'Avila', 'Miranda', 'tadish.avila2014@gmail.com', '+56961745452', 'Inca de Oro 4505', 'Nicolas Salvador', NULL, NULL, '2009-02-19', '2024-10-03', 'Femenino', 1, 1, 0),
  ('11505833-9', 'Magdalena Maria', 'Ayabire', 'Maraña', 'ayabiremaria07@gmail.com', '+56931743276', 'Diego Portales 1938', NULL, NULL, NULL, '1969-10-23', '2025-10-19', 'Femenino', 1, 1, 1),
  ('7886094-4', 'Minda Martina', 'Barraza', 'Milla', 'minda56barraza@gmail.com', '+56945627889', 'Pasaje Tarapaca 3626 G.le paige', NULL, NULL, NULL, '1956-11-01', NULL, 'Femenino', 1, 1, 1),
  ('15769208-9', 'Ximena Magaly', 'Borquez', 'Dubo', 'xime10@hotmail.com', '+56932595654', 'Camino San Ramon # 3922 Rancagua', NULL, NULL, NULL, '1984-04-13', '2018-04-05', 'Femenino', 1, 1, 1),
  ('24407848-6', 'Ckari', 'Caceres', 'Cabezas', 'nicole.g.c1910@gmail.com', '+56944628712', 'Av. Los Presidentes 8000, Peñalolen, Region Metropolitana', 'Nicole Godoy Cabezas', '21148989-8', NULL, '2013-09-21', '2024-09-27', 'Femenino', 1, 0, 0),
  ('22879757-K', 'Fernanda Belen', 'Carmona', 'Muñoz', 'spoiledfer17@gmail.com', '+56961938068', 'Balmaceda 4066 depto 23', 'Yaira Becerra Valdivia', '20352418-8', NULL, '2008-08-03', '2025-04-29', 'Femenino', 1, 0, 0),
  ('16203401-4', 'María José', 'Carozzi', 'Avalos', 'mj.carozzi_bg@hotmail.com', '+56978942423', 'Peine 386', NULL, NULL, NULL, '1986-03-18', '2019-09-27', 'Femenino', 1, 1, 0),
  ('24145893-8', 'Javiera Paz', 'Carvajal', 'De La Fuente', 'carlafuente.81@gmail.com', '+56981529622', 'Nueva Oriente 2840 depto 12', 'Carla de la Fuente', '14108825-4', NULL, '2012-12-18', '2017-09-09', 'Femenino', 1, 0, 0),
  ('21159646-5', 'Yahaira Denisse', 'Chepillo', 'Salazar', 'yahi.chepillo@gmail.com', '+56962533807', 'Taira #733 Villa Kamac Mayu', NULL, NULL, NULL, '2002-11-08', '2025-12-21', 'Femenino', 1, 1, 0),
  ('21473699-3', 'Antonia Jeimmy Catalina', 'Cordova', 'Meza', 'antonia.cordovameza@hotmail.com', '+56963751594', 'Rupanco interior 2258', NULL, NULL, NULL, '2003-12-28', '2023-09-28', 'Femenino', 1, 0, 0),
  ('21511132-6', 'Carla Francisca', 'Cortés Leiva', 'Leiva', 'cfcortes7@gmail.com', '+56994838369', 'Cobija 2701 casa 37', NULL, NULL, NULL, '2004-02-12', '2022-10-01', 'Femenino', 1, 1, 1),
  ('18184029-3', 'Mackarena Nicole', 'Cortes', 'Maluenda', 'mackarenanicolec@gmail.com', '+56987627597', 'Maipu 2391', NULL, NULL, NULL, '1993-01-14', '2025-09-26', 'Femenino', 1, 1, 0),
  ('23457709-3', 'Naomi Amaral', 'Cortes', 'Verdejo', 'cortesnaomi061@gmail.com', '+56962270680', 'Rio Millahue 8986 Antofagasta', 'Sebastian Verdejo', NULL, NULL, '2010-10-20', '2025-09-29', 'Femenino', 1, 0, 0),
  ('13356687-2', 'Mabel Alejandra', 'Cruz', 'Chinchilla', 'm.cruzch28@gmail.com', '+56974897802', 'Licarayen 687 Peuco V', NULL, NULL, NULL, '1978-01-28', '2024-09-27', 'Femenino', 1, 1, 0),
  ('21186873-2', 'Daniela Emilia', 'Cruz', 'Colamar', 'dany02129@gmail.com', '+56962456441', 'Psje Ciudad Heroica 3113 pobl Polanco Nuño', NULL, NULL, NULL, '2002-02-12', '2010-09-09', 'Femenino', 1, 1, 1),
  ('15013795-0', 'Pilar', 'Cuevas', 'Cuevas', 'pilarcuevascp@gmail.com', '+56998350927', 'Federico Errazuriz 2622', NULL, NULL, NULL, '1982-03-02', '2024-09-27', 'Femenino', 1, 1, 1),
  ('23483748-6', 'Antonella Ignacia', 'Diaz', 'Gacitua', 'antonella.diaz.gacitua@gmail.com', '+56932145320', 'Av. Chorrillos 1157', 'Valentina Roa', NULL, NULL, '2010-11-06', '2024-09-27', 'Femenino', 1, 1, 0),
  ('18234880-5', 'Daniela del Carmen', 'Dubos', 'Rojas', 'dannielaluna1993@gmail.com', '+56948451829', '5 norte 1253', NULL, NULL, NULL, '1993-02-19', '2025-09-26', 'Femenino', 1, 1, 1),
  ('23999180-7', 'Pia Agustina', 'Espinoza', 'Cordova', 'antonia.cordovameza@hotmail.com', '+56963751593', 'Rupanco interior 2258', 'Antonia Cordova', '21473699-3', NULL, '2012-07-02', '2023-09-28', 'Femenino', 0, 0, 0),
  ('11333186-0', 'Leonor Del Carmen', 'Fernandez', 'Galleguillos', 'lefernandez1968@gmail.com', '+56983621437', 'Antonio Varas 1915', NULL, NULL, NULL, '1968-02-12', '2018-09-27', 'Femenino', 1, 1, 1),
  ('10374609-4', 'Winnie Johanna', 'Fernandez', 'Moro', 'wfm26@hotmail.com', '+56984155148', 'Costa Rica 3077', NULL, NULL, NULL, '1970-05-26', NULL, 'Femenino', 1, 1, 1),
  ('17492274-8', 'Nicole Andrea', 'Flies', 'Moyano', 'nicolepef28@gmail.com', '+56956689962', 'Chorrillos 1376', NULL, NULL, NULL, '1990-02-06', '2025-10-26', 'Femenino', 1, 1, 1),
  ('24583223-0', 'Eluney Guadalupe', 'Flores', 'Guzmán', 'guzman.lenka@gmail.com', '+56978739196', 'Av. Prat 2128 Casa 30 Condominio Don Arturo', 'Lenka Guzman', '13357046-2', NULL, '2014-03-31', '2025-09-09', 'Femenino', 1, 1, 0),
  ('23807085-6', 'Victoria Maygret', 'Flores', 'León', 'mariacote8@gmail.com', '+56934397866', 'Maizales 3067', 'Maria José León', '15981679-6', NULL, '2011-11-28', '2019-09-27', 'Femenino', 1, 0, 0),
  ('24011854-8', 'Michelle Anelisse', 'Gahona', 'Gahona', 'erikagahona89@gmail.com', '+56959841644', 'Psje Colonia Oriente 3586', 'Marco Gahona Collao', '18826196-5', NULL, '2012-07-14', '2020-09-09', 'Femenino', 1, 0, 0),
  ('24497584-4', 'Javiera Paz', 'Gahona', 'Silva', 'marcogahonacollao@hotmail.com', '+56932421086', 'Prat 2613', 'Marco Gahona Collao', '18826196-5', NULL, '2014-01-01', '2020-09-09', 'Femenino', 1, 0, 0),
  ('15015920-2', 'Marcela Veronica', 'Gajardo', 'Peña', 'caroline_ref@hotmail.com', '+56979305683', 'Calle Nueva 2598', NULL, NULL, NULL, '1983-02-28', '1998-09-09', 'Femenino', 1, 1, 1),
  ('16549080-0', 'Nicole Monserrat', 'Gallardo', 'Rojas', 'nicolegallardo85@gmail.com', '+56944924702', 'Las Vegas 696', NULL, NULL, NULL, '1986-11-18', '1993-09-09', 'Femenino', 1, 1, 1),
  ('18124550-6', 'Francisca Soledad', 'Garcia', 'Gonzalez', 'franciscagarcia.g73@gmail.com', '+56998741188', 'Osvaldo Silva 64 Antofagasta', NULL, NULL, NULL, '1992-01-07', '2024-10-25', 'Femenino', 1, 0, 0),
  ('17530471-1', 'Norma Alejandra', 'Gómez', 'Aguirre', 'norma.gomez.ag@gmail.com', '+56984411754', 'Santiago 2249, depto 208', NULL, NULL, NULL, '1990-10-17', '2019-09-09', 'Femenino', 1, 1, 1),
  ('19551697-9', 'Valentina Paz', 'Gómez', 'Corante', 'valentiina.paz.gomez@gmail.com', '+56983772851', 'Cobija 2701 Condominio Los Alerces c.23', NULL, NULL, NULL, '1996-12-02', '2021-09-09', 'Femenino', 1, 1, 1),
  ('22029040-9', 'Javiera Antonia', 'Gonzalez', 'Aguirre', 'javiieragonzalezzz@gmail.com', '+56949056939', 'Luis Emilio Recabarren, #2351 Casa 2. Condominio Parque Las Palmas, Iquique', NULL, NULL, NULL, '2006-01-24', '2023-09-09', 'Femenino', 1, 1, 1),
  ('22893704-5', 'Camila Ivonne', 'Gonzalez', 'Gomez', 'caami.gnzalez@gmail.com', '+56938714940', 'Santiago 2249, depto 208', 'Nicole Gallardo', '16549080-0', NULL, '2008-12-11', '2013-09-09', 'Femenino', 1, 0, 0),
  ('17133263-K', 'Marina Romane', 'Gonzalez', 'Segovia', 'kine.mgonzalezs@gmail.com', '+56975628711', 'Psje Vecinal N°4 Sitio 14', NULL, NULL, NULL, '1989-06-12', '2008-09-10', 'Femenino', 1, 1, 1),
  ('18184201-6', 'Ana Maria', 'Guerrero', 'Pizarro', 'anamariagp2265@hotmail.com', '+56978826777', 'Canada 2265 Pobl Independencia', NULL, NULL, NULL, '1993-02-17', '2008-04-01', 'Femenino', 1, 1, 0),
  ('13357046-2', 'Lenka Johanna', 'Guzmán', 'Condori', 'guzman.lenka@gmail.com', '+56978739196', 'Av. Prat 2128 Casa 30 Condominio Don Arturo', NULL, NULL, NULL, '1978-08-12', '2016-09-09', 'Femenino', 1, 1, 1),
  ('23274256-9', 'Fernanda Paz', 'Henriquez', 'Rojas', 'fernanda.henriquez.5a@gmail.com', '+56992989433', 'Los Abetos 931', 'Johana Rojas Fuentes', '17724713-8', NULL, '2010-03-16', '2024-09-27', 'Femenino', 1, 1, 0),
  ('22383189-3', 'Andrea Aurora', 'Herrera', 'Corante', 'andreaherrerac72@gmail.com', '+56982506968', 'Oasis San Pedro 997', NULL, NULL, NULL, '2007-04-24', '2022-09-29', 'Femenino', 1, 1, 1),
  ('20348067-9', 'Nataly Fernanda', 'Ibaceta', 'Huerta', 'natalyibacetahuerta@gmail.com', '+56965828590', 'Chorrillos 1157', NULL, NULL, NULL, '2000-08-10', '2025-09-10', 'Femenino', 1, 1, 1),
  ('16549177-7', 'Sylvia Alejandra', 'Jofre', 'Torres', 'sylvia.jofre@gmail.com', '+56975773752', 'Psje Tiltil Norte 1129 Manuel Rodriguez', NULL, NULL, NULL, '1987-01-08', '2016-09-09', 'Femenino', 1, 1, 0),
  ('15982084-K', 'Natali Yoana', 'Leiva', 'Reyes', 'nj.leivareyes26@gmail.com', '+56949011085', 'Pje Linea Dos 1681', NULL, NULL, NULL, '1985-06-26', '2025-09-26', 'Femenino', 1, 1, 1),
  ('15981679-6', 'María José De Guadalupe', 'León', 'Nuñez', 'mariacote8@gmail.com', '+56923880284', 'Maizales 3067', NULL, NULL, NULL, '1984-12-09', '2019-09-27', 'Femenino', 1, 1, 1),
  ('15740883-6', 'Jissel Fernanda', 'Lucas', 'Berna', 'jisselfernanda77@gmail.com', '+56993504121', 'Alberto Terrazas 71', NULL, NULL, NULL, '1983-09-25', '2022-09-29', 'Femenino', 1, 1, 0),
  ('17655441-K', 'Nicole Macarena', 'Mancilla', 'Peña', 'nicole.mmancilla@gmail.com', '+56971355691', 'Pasaje Villarrica 2676', NULL, NULL, NULL, '1991-01-21', '2017-10-01', 'Femenino', 1, 1, 1),
  ('24344159-5', 'Pascal Antonia', 'Matus', 'De La Fuente', 'paola.pascal27@gmail.com', '+56964944330', 'Huillon s/n Mafil', 'Paola de la fuente Estay', NULL, NULL, '2013-07-27', '2017-09-09', 'Femenino', 1, 0, 0),
  ('22536478-8', 'Antonia Andrea', 'Mella', 'Cortes', 'antoniamella874@gmail.com', '+56978701451', '5 Norte 1253', NULL, NULL, NULL, '2007-10-25', '2024-09-27', 'Femenino', 1, 1, 1),
  ('18183083-2', 'Yosselin Macarena', 'Meruvia', 'Meruvia', 'yosselinmeruvia5@gmail.com', '+56975767283', 'Arauco 2978', NULL, NULL, NULL, '1992-06-09', '2023-09-09', 'Femenino', 1, 1, 0),
  ('23150507-5', 'Isidora Paz', 'Miranda', 'Cruz', 'isidorapazmiranda.c@gmail.com', '+56975863899', 'Baldomero Lillo 620', 'Mabel Cruz', '13356687-2', NULL, '2009-10-15', '2024-09-27', 'Femenino', 1, 0, 0),
  ('12582427-7', 'Ana Amelia', 'Mogro', 'Yere', 'amy_moyer@hotmail.com', '+56984569838', 'Av Grecia 1712', NULL, NULL, NULL, '1974-12-11', '2015-09-09', 'Femenino', 1, 1, 1),
  ('20734770-1', 'Emilin Micaela', 'Molina', 'Colamar', 'emilinmolina45@gmail.com', '+56987650669', 'Ralun 2352', NULL, NULL, NULL, '2001-06-16', '2017-09-09', 'Femenino', 1, 1, 0),
  ('23756580-0', 'Alexia Antonella Francisca', 'Morales', 'Colamar', 'alexis.magali.33@gmail.com', '+56979630227', 'Quetena Oriente 3065', 'Alexis Morales Olivares', '16259710-8', NULL, '2011-09-24', '2025-09-26', 'Femenino', 0, 0, 0),
  ('23074307-K', 'Aracely Andrea', 'Ogalde', 'Tapia', 'ts.pdonosoogalde@gmail.com', '+56957390216', 'Psj Chile 2467', 'Pedro Donoso Ogalde', '13417529-K', NULL, '2009-07-09', '2016-09-09', 'Femenino', 1, 0, 0),
  ('21333912-5', 'Paloma Belen', 'Olivares', 'Gallardo', 'palomaolivaresgallardo@gmail.com', '+56988699917', 'Las Vegas 696', NULL, NULL, NULL, '2003-06-05', '2011-09-09', 'Femenino', 1, 1, 0),
  ('22673891-6', 'Poulett Alexandra', 'Olivares', 'Gallardo', 'poulett2008@gmail.com', '+56941272839', 'Las Vegas 846', NULL, NULL, NULL, '2008-03-18', '2019-09-27', 'Femenino', 1, 0, 0),
  ('17246165-4', 'Yaritza Mayleen', 'Olivares', 'Valdivia', 'yaritzaolivares2@gmail.com', '+56971090300', 'Costa Rica 2893 Casa 1', NULL, NULL, NULL, '1989-08-10', '2004-09-09', 'Femenino', 1, 1, 1),
  ('16566093-5', 'Ingris del Carmen', 'Ordenes', 'Valenzuela', 'ingrisordenes17@gmail.com', '+56996719875', 'Lascar 4501 Casa', NULL, NULL, NULL, '1987-06-24', '2007-09-09', 'Femenino', 1, 1, 1),
  ('12581782-3', 'Nelly Mercedes', 'Panire', 'Colamar', 'panirenely@gmail.com', '+56999927326', 'Av Circunvalación 1472, Codominio Travesias del desierto casa 136', NULL, NULL, NULL, '1973-09-24', '2007-09-09', 'Femenino', 1, 1, 1),
  ('20347463-6', 'Ayelet Yendery', 'Panire', 'Meruvia', 'ayeletpanire@gmail.com', '+56978818229', 'Freirina 2468', NULL, NULL, NULL, '2000-02-09', '2023-09-09', 'Femenino', 1, 1, 0),
  ('12348023-6', 'Sandra Gina', 'Panire', 'Saire', 'sandritaa.gps@gmail.com', '+56953619666', 'Psje El Desierto 2255', NULL, NULL, NULL, '1972-11-23', '1984-09-09', 'Femenino', 1, 1, 1),
  ('19328388-8', 'Tamara Clarisa', 'Paredes', 'Mena', 'taamara.paredes@gmail.com', '+56935272133', 'Calle Antofagasta #3326', NULL, NULL, NULL, '1996-04-08', '2022-09-29', 'Femenino', 1, 0, 0),
  ('24584394-1', 'Florencia Laura', 'Pasten', 'Olivares', 'yaritzaolivares2@gmail.com', NULL, 'Costa Rica 2893 Casa 1', 'Yaritza Olivares', '17246165-4', 'Oso', '2014-04-01', '2015-09-09', 'Femenino', 0, 0, 0),
  ('21361251-4', 'Sylvia Constanza', 'Perez', 'Jofre', 'sylviaconstanzaaperez@gmail.com', '+56982478918', 'Psje Tiltil Norte 1129 Manuel Rodriguez', NULL, NULL, NULL, '2003-08-12', '2016-09-09', 'Femenino', 1, 1, 0),
  ('22773051-K', 'Agustina Andrea', 'Pineda', 'Morales', 'agustinapineda542@gmail.com', '+56963880426', 'Sotomayor 1802', 'Sylvia Perez Jofre', '21361251-4', NULL, '2008-07-15', '2024-09-27', 'Femenino', 1, 1, 0),
  ('10186349-2', 'Sara Paulina', 'Pizarro', 'Campillay', 'sarapaulinacp.64@gmail.com', '+56991934377', 'Canada 2265 Pobl Independencia', NULL, NULL, NULL, '1964-09-16', NULL, 'Femenino', 1, 1, 1),
  ('23511075-K', 'Monserrat Mariana', 'Ramirez', 'Ahumada', 'monse1900moon@gmail.com', '+56984161698', 'Quetena Piniente 3022', 'Isabel Valdivia', '9137252-5', NULL, '2010-12-20', '2024-09-27', 'Femenino', 1, 1, 1),
  ('20543769-K', 'Anissette Soraya', 'Ramos', 'Araya', 'a.ramosaraya@gmail.com', '+56933481773', 'Cobija 3130, Polanco Nuño', NULL, NULL, NULL, '2000-12-28', '2009-09-09', 'Femenino', 1, 1, 1),
  ('23631265-8', 'Antonella Zuan', 'Ramos', 'Vilte', 'ramosantonella905@gmail.com', '+56979927274', 'Psj El Sol 3433', 'Sandra Panire', '12348023-6', NULL, '2011-09-27', '2023-09-09', 'Femenino', 1, 1, 1),
  ('19826099-1', 'Scharetzza Nayarett', 'Rodriguez', 'Cuadra', 'chare.rodriguez@gmail.com', '+56987666436', 'Los Chañares 2544', NULL, NULL, NULL, '1998-08-28', '2018-09-27', 'Femenino', 1, 0, 0),
  ('22465374-3', 'Krishna Belen', 'Rojas', 'Borquez', 'twv.belen@gmail.com', '+56939344370', 'Curico 2587', NULL, NULL, NULL, '2007-07-27', '2023-09-28', 'Femenino', 1, 0, 0),
  ('21240650-3', 'Camila Andrea Alejandra', 'Rosales', 'Carvajal', 'camilacarvajal00@gmail.com', '+56956324751', 'Dinamarca 3737', NULL, NULL, NULL, '2003-02-21', '2019-09-27', 'Femenino', 1, 0, 0),
  ('16565096-4', 'Jocelyn Aylin', 'Tagle', 'Morales', 'jtagle13@gmail.com', '+56978824683', 'Hernán Cortés 3350, Condominio Quetena III, Casa 15', NULL, NULL, NULL, '1986-12-15', '2019-09-27', 'Femenino', 1, 1, 1),
  ('10477250-1', 'Patricia Sandra', 'Teran', 'Colamar', 'patyteran@gmail.com', '+56998367886', 'Tiltil Norte 1421', NULL, NULL, NULL, '1968-12-28', '1986-09-09', 'Femenino', 1, 1, 1),
  ('18362317-6', 'Maria Francisca', 'Toro', 'Villegas', 'mf.torovillegas@gmail.com', '+56967856911', 'Lago Zenteno 1450, Depto 11008, viña del mar', NULL, NULL, NULL, '1992-12-03', '2020-09-09', 'Femenino', 1, 1, 1),
  ('20274334-K', 'Conny Alexandra', 'Urquieta', 'Palma', 'c.urquieta.palma@gmail.com', '+56994362101', 'Prolongación 5 oriente 0277 Viña del Mar', NULL, NULL, NULL, '1999-06-18', '2024-09-27', 'Femenino', 1, 1, 1),
  ('22203612-7', 'Antonella Mia', 'Valdes', 'Nuñez', 'antonella.valdes.n@gmail.com', '+56996795831', 'Inca de Oro 4127', NULL, NULL, NULL, '2006-09-08', '2025-10-01', 'Femenino', 1, 1, 0),
  ('21222205-4', 'Valentina Belen', 'Varas', 'Burgos', 'valentina.belen2901@gmail.com', '+56950163531', 'Cobija 2056', NULL, NULL, NULL, '2003-01-29', '2003-09-09', 'Femenino', 1, 1, 0),
  ('17655778-8', 'Francisca Patricia', 'Velasquez', 'Nuñez', 'fran.velasquez15277@gmail.com', '+56969068436', 'Pocor 704', NULL, NULL, NULL, '1991-03-27', '2024-06-01', 'Femenino', 1, 1, 1),
  ('24152592-9', 'Agustina Jensey', 'Vera', 'Ahumada', 'ayabiremaria07@gmail.com', '+56931743276', 'Diego Portales 1938', 'Magdalena Ayabire Maraña', '24152592-9', NULL, '2012-12-26', '2025-10-19', 'Femenino', 1, 0, 0),
  ('19539400-8', 'Nayaret Merani', 'Vera', 'Paniagua', 'nayaret.merani@hotmail.com', '+56974107239', 'Psj . Guillermo cabrales #1642', NULL, NULL, NULL, '1997-08-22', '2024-09-25', 'Femenino', 1, 0, 0),
  ('24332803-9', 'Vaithyare Nicoll', 'Vergara', 'Vargas', 'vargascortes.carolina@gmail.com', '+56933951191', 'Diego Portales 1894', 'Vanessa Vargas', '17734849-K', NULL, '2013-07-12', '2017-09-09', 'Femenino', 1, 0, 0),
  ('21862448-0', 'Valentina Alexandra', 'Villalobos', 'Elías', 'valentina.alexandra.v18@gmail.com', '+56954156326', 'Av Puertas del mar 425', NULL, NULL, NULL, '2005-06-18', '2025-06-18', 'Femenino', 1, 1, 0),
  ('16867904-1', 'Viviana Stefany', 'Zamora', 'Mondaca', 'vicvoley_08-05@hotmail.com', '+56952241242', 'Sevilla 3475', NULL, NULL, NULL, '1988-11-30', '2018-09-27', 'Femenino', 1, 1, 1),
  ('24504416-K', 'Isabella Cataleya', 'Aguilera', 'Robles', NULL, '+56923950831', 'O''Higgins 2977', 'Carlos Aguilera', '16259337-4', 'Osos', '2014-01-09', '2017-09-26', 'Femenino', 1, 0, 0),
  ('22723843-7', 'Maximiliano Jesus', 'Aguilera', 'Robles', 'maxymilianoaguilera2218@gmail.com', '+56975442398', 'O''Higgins 2977', 'Carlos Aguilera', '16259337-4', 'Osos', '2008-05-17', '2014-09-08', 'Masculino', 1, 0, 0),
  ('16259337-4', 'Carlos Humberto', 'Aguilera', 'Vega', 'carlos.aguilera2218@gmail.com', '+56944378879', 'O''Higgins 2977', NULL, NULL, NULL, '1986-02-22', '1996-09-09', 'Masculino', 1, 1, 1),
  ('22146800-7', 'Oscar Ivan', 'Aramayo', 'León', 'o.aramayo.leon@gmail.com', '+56961695840', 'Av Prat 1887', NULL, NULL, NULL, '2006-06-23', '2019-09-27', 'Masculino', 1, 0, 0),
  ('20352418-8', 'Yaira Yamilet', 'Becerra', 'Valdivia', 'yaira-24@outlook.es', '+56973820637', 'Inca de Oro 4139 Villa Los Yacimientos', NULL, NULL, NULL, '2000-08-24', '2017-09-26', 'Femenino', 1, 1, 0),
  ('16189875-9', 'Mario Wildon', 'Fabian', 'Soza', 'mwfabian@hotmail.com', '+56981343897', 'Hernan Cortes 3350', NULL, NULL, NULL, '1986-03-02', '2014-09-09', 'Masculino', 1, 1, 1),
  ('23236102-6', 'Ignacio Antonio', 'Fabian', 'Tagle', 'ignaciofabian2614@gmail.com', '+56997861002', 'Hernan Cortes 3350', 'Mario Fabian', '16189875-9', NULL, '2010-01-26', '2014-09-09', 'Masculino', 1, 0, 0),
  ('24663901-9', 'Maia Belen', 'Formas', 'Tapia', 'maiaformas2614@gmail.com', '+56985953284', 'Los Angeles 2249 Corvi', 'Katherine Tapia Araya', '15014945-2', 'Osos', '2014-06-23', '2018-10-06', 'Femenino', 1, 0, 0),
  ('23923562-K', 'Vicente Nataniel Antonio', 'Gajardo', 'Araya', 'vicentegajardoaraya@gmail.com', '+56992737989', NULL, 'Leslye Cortes', '15017200-4', NULL, '2012-05-16', '2024-09-27', 'Masculino', 1, 1, 0),
  ('21926967-6', 'Sofia Veronica', 'Gonzalez', 'Graz', 'sofiagonzalezgraz@gmail.com', '+56981384891', 'Federico Errazuriz 2394', NULL, NULL, NULL, '2005-09-10', '2015-09-09', 'Femenino', 1, 1, 0),
  ('24032738-4', 'Javiera Ignacia', 'Montalban', 'Balboa', 'andreacardiokine@gmail.com', '+56942684644', 'Joaquin Prieto 1961', 'Jorge Montalban', '13216298-0', NULL, '2012-08-10', '2021-09-09', 'Femenino', 1, 1, 0),
  ('27765629-0', 'Keyra Ayleen Peñafiel Cedeño', 'Peñafiel', 'Cedeño', 'ayleenpenafiel1@gmail.com', '+56951555359', 'Luis Risopatron 2467', 'Nelly Cedeño', '25815235-2', NULL, '2013-10-28', '2023-09-09', 'Femenino', 1, 1, 0),
  ('17392473-9', 'Jessenia Jussett', 'Ahumada', 'Tapia', 'ahumadajess@gmail.com', '+56987252704', 'Psje Aymani N° 624 Kamac-Mayu', NULL, NULL, NULL, '1989-11-06', '2006-09-09', 'Femenino', 1, 1, 1),
  ('19867652-7', 'Karen Alexandra', 'Aramayo', 'León', 'xkaren.al@gmail.com', '+56996303426', 'Av Prat 1887', NULL, NULL, NULL, '1999-04-07', '2018-09-27', 'Femenino', 1, 1, 0),
  ('20992433-1', 'Alexandra Belén', 'Araya', 'Galleguillos', 'arayaalexandra26@gmail.com', '+56942772649', 'Balmaceda 1979', NULL, NULL, NULL, '2002-03-26', '2020-09-09', 'Femenino', 1, 1, 1),
  ('20399308-0', 'Catherine Gisell', 'Cárcamo', 'Gálvez', 'c.carcamo1398@gmail.com', '+56987222680', 'Avenida Iquique 4055 Antofa', NULL, NULL, NULL, '1998-10-13', '2025-09-30', 'Femenino', 1, 1, 1),
  ('21994905-7', 'Constanza Trinidad Belen', 'Chocobar', 'Toledo', 'constanza.chocobar.t@gmail.com', '+56938703991', 'Las Higueras 918', 'Marina Gonzalez Segovia', NULL, NULL, '2005-12-06', '2023-09-09', 'Femenino', 1, 1, 1),
  ('19205973-9', 'Michelle Francesca', 'Fabian', 'Aguilar', 'michellefabian.aguilar@gmail.com', '+56984785379', 'Simon Bolivar 1614', NULL, NULL, NULL, '1996-05-08', '2021-09-09', 'Femenino', 1, 1, 1),
  ('18971723-7', 'Constanza', 'Fuentes', 'Rivera', 'constanza.katryne@gmail.com', '+56977447462', 'Volcan San Pablo 871', NULL, NULL, NULL, '1995-01-06', '2018-09-27', 'Femenino', 1, 1, 0),
  ('20352620-2', 'Carolina Andrea', 'Gavia', 'Cereceda', 'carolina.andrea.gavia@gmail.com', '+56966933225', 'Paqui 732', NULL, NULL, NULL, '2001-02-01', '2004-09-09', 'Femenino', 1, 1, 0),
  ('20098976-7', 'Daniela Margarita', 'Gavia', 'Cereceda', 'daniela.gavia.c@gmail.com', '+56975195170', 'Paqui 732', NULL, NULL, NULL, '1999-09-25', '2004-09-09', 'Femenino', 1, 1, 0),
  ('16258642-4', 'Yasmin Cecilia', 'Guzman', 'Henriquez', 'y.yasmin.guzman@gmail.com', '+56926135240', 'Psj Antillanca 3137', NULL, NULL, NULL, '1985-09-13', '2023-09-28', 'Femenino', 1, 1, 1),
  ('22691904-K', 'Paz Francisca', 'Menay', 'Molina', 'pazfr.menay@gmail.com', '+56999058204', 'Chala 2306', 'Rodrigo Santander', '12802173-6', NULL, '2008-04-09', '2018-08-15', 'Femenino', 1, 0, 0),
  ('16926283-7', 'Daniela Charlot', 'Molina', 'Velasquez', 'nani.041020@gmail.com', '+56982324135', 'Vicuña Mackenna 2623', NULL, NULL, NULL, '1988-02-23', '2021-11-11', 'Femenino', 1, 1, 0),
  ('22876541-4', 'Martina Andrea', 'Pasten', 'Bruna', 'mtbf_31@hotmail.com', '+56991242286', 'Psj Las Normac 1694', 'Joan Paten', '20734900-3', NULL, '2008-11-19', '2023-09-09', 'Femenino', 1, 1, 0),
  ('20093614-0', 'Yenifer Patricia', 'Puca', 'Valdivia', 'yennifer.patricia07@gmail.com', '+56976050540', 'Psje Los Retamos 655', NULL, NULL, NULL, '1999-02-15', '2017-09-09', 'Femenino', 1, 1, 1),
  ('21198941-6', 'Valentina Francisca', 'Roa', 'Gonzalez', 'vroa36110@gmail.com', '+56926846288', 'Av Chorillos 1157', NULL, NULL, NULL, '2002-12-23', '2023-09-09', 'Femenino', 1, 1, 1),
  ('20399407-9', 'Dalia Nazareth', 'Rojas', 'Cruz', 'dalia_naz@hotmail.com', '+56991384359', 'Psje Borgoño 964 Vista Hermosa', NULL, NULL, NULL, '2000-02-29', '2010-09-09', 'Femenino', 1, 1, 1),
  ('21569385-6', 'Yelitza Araceli', 'Rojas', 'Vargas', 'araceliyelitza16@gmail.com', '+56962002275', 'Bañados Espinoza 2269', NULL, NULL, NULL, '2004-05-10', '2021-07-21', 'Femenino', 1, 1, 0),
  ('21043297-3', 'Thiare Belen', 'Saavedra', 'Cárdenas', 'tsaavedracardenas@gmail.com', '+56933055999', 'Juan Orione 1010 Pobl Bonilla Antofagasta', NULL, NULL, NULL, '2002-06-18', '2017-09-09', 'Femenino', 1, 1, 0),
  ('22154834-5', 'Katalina Alexis', 'Santander', 'Sanchez', 'kathasantander7@gmail.com', '+56961969685', 'Ascotan 1627', 'Manuel Santander', '11722186-5', NULL, '2006-07-07', '2011-09-09', 'Femenino', 1, 0, 0),
  ('22518710-K', 'Daylin Solange', 'Zambrano', 'Urquieta', 'daylinzambrano.2007@gmail.com', '+56982481378', 'San Martin 3625', NULL, NULL, NULL, '2007-10-02', '2021-09-09', 'Femenino', 1, 0, 0),
  ('14308581-3', 'Roberto Andres', 'Corante', 'Luna', 'rcorante@gmail.com', '+56945878889', 'Argentina 3972', NULL, NULL, NULL, '1975-11-30', '2022-09-29', 'Masculino', 1, 1, 1),
  ('15981894-2', 'Carlos Alberto', 'Coria', 'Gutierrez', 'carlos.coria.gutierrez@gmail.com', '+56992827090', 'Pedro de Valdivia 360 Villa las vegas', NULL, NULL, NULL, '1985-01-12', '2014-09-09', 'Masculino', 1, 1, 1),
  ('10266891-K', 'Aliro Humberto', 'Diaz', 'Pizarro', 'adiaz.pizarro2.0@gmail.com', '+56988079358', 'Av Radomiro Tomic 911 Los Yacimientos', NULL, NULL, NULL, '1966-05-30', '2015-09-09', 'Masculino', 1, 0, 0),
  ('10757202-3', 'Marco Lorenzo', 'Ferrer', 'Gonzalez', 'marcosferrergonz@icloud.com', '+56978080563', 'Ascotan 1974 Villa Ayquina', NULL, NULL, NULL, '1971-09-29', '1979-09-09', 'Masculino', 1, 1, 1),
  ('12581896-K', 'Marcos Antonio', 'Flores', 'Marin', 'marcoflo74@gmail.com', '+56985949222', 'Av Central Sur 160', NULL, NULL, NULL, '1974-06-10', '1999-09-09', 'Masculino', 1, 1, 1),
  ('10619381-9', 'Manuel David', 'Pinto', 'Coca', 'manuelpintococa01@gmail.com', '+56987640537', NULL, NULL, NULL, NULL, NULL, NULL, 'Masculino', 0, 0, 0),
  ('12802173-6', 'Rodrigo Alejandro', 'Santander', 'Cerezo', 'imolina1210@icloud.com', '+56985484908', 'Ascotan 1627, Villa Ayquina', NULL, NULL, NULL, '1975-12-23', '1993-09-09', 'Masculino', 1, 1, 1),
  ('17655485-1', 'Oscar Ignacio', 'Tirado', 'González', 'scr91@live.cl', '+56953254786', 'Salar Agua Amarga 3598', NULL, NULL, NULL, '1991-01-19', '2011-09-26', 'Masculino', 1, 1, 1),
  ('16566569-4', 'Michael Moisés', 'Vergara', 'Rojas', 'vergaramichael29@gmail.com', '+56947825068', 'Valdivia 979', NULL, NULL, NULL, '1987-09-21', '2013-09-09', 'Masculino', 1, 1, 0),
  ('15740823-2', 'Maria Isabel', 'Araya', 'Araya', 'apr.arayaaraya@gmail.com', '+56932490970', 'Cobija 3130, Polanco Nuño', NULL, NULL, NULL, '1983-10-31', '1993-09-09', 'Femenino', 1, 1, 1),
  ('17867640-7', 'Elizabeth Alexandra', 'Garranuño', 'Escobar', 'eligarramuno05@gmail.com', '+56965137118', 'Salar Agua Amarga 3598', NULL, NULL, NULL, '1991-09-19', '2010-09-09', 'Femenino', 1, 1, 0),
  ('21255420-0', 'Valery Elizabeth', 'Lazo', 'Rojas', 'valery.vgcc@gmail.com', '+56953090519', 'Andina 1063', NULL, NULL, NULL, '2003-03-12', '2021-10-27', 'Femenino', 1, 1, 1),
  ('15690666-2', 'Carolina Aurora', 'Mancilla', 'Peña', 'karomancilla@gmail.com', '+56975440109', 'Jose Miguel carrera 1017', NULL, NULL, NULL, '1983-07-12', '2017-10-01', 'Femenino', 1, 1, 1),
  ('15982332-6', 'Viviana Nayarett', 'Rojas', 'Gonzalez', 'vivianarojasg0719@gmail.com', '+56981975192', 'la pampa 869 villa los yacimientos', NULL, NULL, NULL, '1985-04-07', '2011-10-01', 'Femenino', 1, 1, 1),
  ('18125011-9', 'Karen Marlene', 'Rojas', 'Oyarce', 'karyrojas38@gmail.com', '+56945002196', 'Los cedros 919 villa los algarrobos', NULL, NULL, NULL, '1992-08-03', '2017-05-03', 'Femenino', 1, 1, 0),
  ('22197021-7', 'Karla Fernanda', 'Rojas', 'Oyarce', 'karlita.rojas0109@gmail.com', '+56942541920', 'Justo Arteaga 2839 Villa Caspana', NULL, NULL, NULL, '2006-09-11', '2017-03-01', 'Femenino', 1, 0, 0),
  ('18826997-4', 'Yesica Araceli', 'Rojas', 'Vargas', 'yesiaraceli17@gmail.com', '+56972994016', 'Bañados Espinoza 2269', NULL, NULL, NULL, '1995-05-04', '2021-09-09', 'Femenino', 1, 1, 0),
  ('13743425-3', 'Katherine de los Angeles', 'Santander', 'Cerezo', 'katherine.santander@gmail.com', '+56993061472', 'Radomiro Tomic 911', NULL, NULL, NULL, '1980-06-15', '1992-09-09', 'Femenino', 1, 1, 0),
  ('19825086-4', 'Tania Andrea', 'Zambrano', 'Zuleta', 'tania_yanela_98@hormail.com', '+56962405577', 'Vasco de Gama 2354', NULL, NULL, NULL, '1998-01-12', '2021-08-16', 'Femenino', 1, 1, 0),
  ('20399418-4', 'Javiera Michaelle', 'Barraza', 'Diaz', 'javiera.mdb@gmail.com', '+56993159131', 'Punta arenas 2468', NULL, NULL, NULL, '2000-03-07', '2023-09-28', 'Femenino', 1, 1, 1),
  ('16565483-8', 'Ingri Andrea', 'Gahona', 'Collao', 'ingrigahona28@gmail.com', '+56974772176', 'Psje Colonia Oriente 3586', NULL, NULL, NULL, '1987-01-31', '2004-10-08', 'Femenino', 1, 1, 0),
  ('18482838-3', 'Natalia Daniela', 'Gonzalez', 'Lopez', 'nataaalia.gl@gmail.com', '+56938699394', 'Avenida Grau 1419', NULL, NULL, NULL, '1993-08-19', '2008-09-09', 'Femenino', 1, 1, 0),
  ('21781118-K', 'Veronica Gabriela', 'Ponce', 'Cuellar', 'veronica.ponce.cuellar@gmail.com', '+56971319080', 'Psje Chile 2389', NULL, NULL, NULL, '1982-01-04', '2016-09-09', 'Femenino', 1, 1, 0),
  ('18579869-0', 'María', 'Salvatierra', 'Estay', 'salvatierra.mdc@gmail.com', '+56995122846', 'Grecia 3036', NULL, NULL, NULL, '1993-06-25', '2019-09-27', 'Femenino', 1, 1, 1),
  ('17974273-K', 'Elsa Alexandra', 'Urquieta', 'Salvatierra', 'elsaurquietasalva@hotmail.com', '+56971009771', 'Colombia 3064', NULL, NULL, NULL, '1991-07-15', '2018-09-27', 'Femenino', 1, 1, 0),
  ('17656117-3', 'Yesenia Margarita', 'Villagra', 'Pizarro', 'creaciones.calama@gmail.com', '+56944001279', 'Riquelme 3674', NULL, NULL, NULL, '1991-06-01', '2017-09-09', 'Femenino', 1, 1, 1),
  ('20348552-2', 'Cassey Anthony', 'Alfaro', 'Carvajal', 'cassey.alfaro@gmail.com', '+56945513955', 'Vasco de Gama 2972', NULL, NULL, NULL, '2001-01-18', '2016-09-09', 'Masculino', 1, 1, 1),
  ('20399143-6', 'Yulian Alejandra', 'Arevalo', 'Araya', 'y.arevalo@outlook.com', '+56964507438', 'Aconcagua 2459', NULL, NULL, NULL, '1999-12-10', '2016-09-09', 'Femenino', 1, 1, 1),
  ('20347711-2', 'Javiera Paz', 'Criado', 'Véliz', 'javiera.criado.veliz@gmail.com', '+56988319452', 'Balmaceda 1929', NULL, NULL, NULL, '2000-04-21', '2021-09-09', 'Femenino', 1, 1, 1),
  ('21196805-2', 'Valentina Alexandra', 'Erazo', 'Campusano', 'valentina.erazo182@gmail.com', '+56952131095', 'laguna sejar 560', NULL, NULL, NULL, '2002-12-18', '2017-09-09', 'Femenino', 1, 0, 0),
  ('20974689-1', 'Miyaray Andrea Leonila', 'Espinosa', 'Tobar', 'miyarayespinosa2602@outlook.es', '+56994322972', 'Cobija 3707 parcela 22', NULL, NULL, NULL, '2002-02-26', '2021-09-09', 'Femenino', 1, 1, 1),
  ('16203236-4', 'Alonso Gregorio', 'Maldonado', 'Troncoso', 'alonso.maldonadoipr@gmail.com', '+56977586267', 'Enrique Villigas 1811', NULL, NULL, NULL, '1986-01-06', '2016-06-09', 'Masculino', 1, 1, 1),
  ('12801555-8', 'Marcela Alondra', 'Maldonado', 'Troncoso', 'chelita_1105@hotmail.com', '+56954194757', 'Quetena 2546', NULL, NULL, NULL, '1975-03-01', '2023-09-09', 'Femenino', 1, 1, 1),
  ('18183925-2', 'Hectór Andrés', 'Montenegro', 'Lara', 'hectorandreseg@gmail.com', '+56978587365', 'Inca de Oro 4139', NULL, NULL, NULL, '1992-12-08', '2025-11-11', 'Masculino', 1, 1, 0),
  ('20093764-0', 'Jose Francisco', 'Muñoz', 'Becerra', 'jose_fmb_1999@hotmail.com', '+56978965384', 'La Cascada 1256 Villa Ascotan', NULL, NULL, NULL, '1999-03-05', '2015-09-09', 'Masculino', 1, 1, 1),
  ('22464132-K', 'Fernanda Isidora', 'Salvador', 'Salvador', 'fernanda.salvador.salvador@gmail.com', '+56933684246', 'Central sur 1601', NULL, NULL, NULL, '2007-07-28', '2022-09-29', 'Femenino', 1, 1, 0),
  ('19824757-K', 'Nicolas Ignacio', 'Salvador', 'Salvador', 'nicolas.salvador@outlook.com', '+56961097461', 'Avenida Oriente 1116', NULL, NULL, NULL, '1997-11-13', '2015-09-09', 'Masculino', 1, 1, 1),
  ('22461067-K', 'Agustin Emilio', 'Sepulveda', 'Santander', 'agustin.s.s@icloud.com', '+56998348063', 'Ascotan 1627', NULL, NULL, NULL, '2007-07-29', '2022-09-29', 'Masculino', 1, 0, 0),
  ('19952628-6', 'Viviana Patricia', 'Vargas', 'Cortes', 'vivivargascortes@gmail.com', '+56993015791', 'Valdivia 979', NULL, NULL, NULL, '1999-03-02', '2013-09-09', 'Femenino', 1, 1, 1),
  ('19205547-4', 'Alexis Jesus', 'Vera', 'Vera', 'alexis.9622.vera@gmail.com', '+56940596436', 'Pedro de Valdivia 1465', NULL, NULL, NULL, '1996-02-02', '1997-09-09', 'Masculino', 1, 1, 1),
  ('13529059-9', 'Yelisse Carolina', 'Alvarez', 'Bolados', 'yelisse.alvarez@gmail.com', '+56987552988', 'Psj El Trauco 645', NULL, NULL, NULL, '1979-01-10', '2018-09-27', 'Femenino', 1, 1, 1),
  ('23946762-8', 'Tabatha Belen', 'Antonia', 'Millas Carvajal', 'scarlet.carvajal.93@gmail.com', '+56994522059', 'Punta de Rieles 1948', 'Scarlet Carvajal', '18520729-3', NULL, '2012-05-04', '2025-09-29', 'Femenino', 0, 0, 0),
  ('14593737-K', 'Ana Maria', 'Araya', 'Bautista', 'catherineespinosa537@gmail.com', '+56934195600', 'Cobija 3707 parcela 22', NULL, NULL, NULL, '1978-10-20', '2021-09-09', 'Femenino', 1, 1, 1),
  ('11931043-1', 'Yorka', 'Arce', 'Echeverria', 'yorkaarce.1972@gmail.com', '+56966012481', 'Pje Ahumada 1614', NULL, NULL, NULL, '1972-04-19', '2025-10-26', 'Femenino', 1, 1, 1),
  ('16564816-1', 'Nicoll Alejandra', 'Astudillo', 'Saavedra', 'nicolleducadora@gmail.com', '+56962359764', 'Aysen 1186', NULL, NULL, NULL, '1986-10-26', '2021-09-09', 'Femenino', 1, 1, 1),
  ('10974306-2', 'Yasna Nevenka', 'Avalos', 'Montejo', 'yasnaavalos1971@gmail.com', '+56994291201', 'Felix Hoyos 2150 Centro', NULL, NULL, NULL, '1971-04-12', '2009-09-09', 'Femenino', 1, 0, 0),
  ('22297913-7', 'Martina Anthonia', 'Bastia', 'lacaye', 'martinalacaye@gmail.com', '+56933208407', 'Chacabuco 2908', NULL, NULL, NULL, '2007-01-07', '2023-09-09', 'Femenino', 1, 1, 1),
  ('22051053-0', 'Yanira Dayan Beatriz', 'Berna', 'Lucas', 'yanirabl2006@gmail.com', '+56932597724', 'Alberto Terrazas 71', NULL, NULL, NULL, '2006-02-15', '2022-09-29', 'Femenino', 1, 1, 0),
  ('23454852-2', 'Catalina', 'Carrillo', 'Menacho', 'catalinacarillo1610@gmail.com', '+56989333708', 'Latorre 1455', NULL, NULL, NULL, '2010-10-16', '2024-09-27', 'Femenino', 1, 1, 0),
  ('25815235-2', 'Nelly Desireé', 'Cedeño', 'Arias', 'dessykeyra26@gmail.com', '+56950132172', 'Psje Luis Risopatrón 2467', NULL, NULL, NULL, '1986-09-26', '2018-09-27', 'Femenino', 1, 1, 1),
  ('23270649-K', 'Monserrat Pascalle', 'Celti', 'Leyton', 'omcelti@gmail.com', '+56994422589', 'Alonso de Ercilla 2613', 'Dominique Vega', NULL, NULL, '2010-03-11', '2024-09-27', 'Femenino', 1, 1, 1),
  ('23768663-2', 'Antonella Pascal', 'Corante', 'Duran', 'rcorante@gmail.com', '+56945878889', 'Linzor 2207', 'Roberto Corante', '14308581-3', NULL, '2011-10-06', '2024-09-27', 'Femenino', 1, 1, 0),
  ('15711064-0', 'Paola', 'De', 'La Fuente Estay', 'paola.pascal27@gmail.com', '+56964944330', 'Pedro Lagos 2523', NULL, NULL, NULL, '1984-02-17', '2017-09-26', 'Femenino', 1, 1, 1),
  ('19205017-0', 'Katherine Priscila', 'Espinosa', 'Tobar', 'catherineespinosatobar@gmail.com', '+56931870134', 'Cobija 3707 parcela 22', NULL, NULL, NULL, '1995-10-11', '2021-09-09', 'Femenino', 1, 1, 1),
  ('22001616-1', 'Flavia del Rosario', 'Flores', 'Flores', 'sofiflores696@gmail.com', '+56978727424', 'Yareta 2367', NULL, NULL, NULL, '2005-12-15', '2019-09-27', 'Femenino', 1, 1, 0),
  ('21148989-8', 'Nicole Francisca', 'Godoy', 'Cabezas', 'nicole.g.c1910@gmail.com', '+56944628712', 'hurtado de mendoza 2601', NULL, NULL, NULL, '2002-10-19', '2024-09-27', 'Femenino', 1, 1, 1),
  ('22238767-1', 'Haylenn Guadalupe', 'Iter Miranda', 'Miranda', 'ihaylenn@gmail.com', '+56951586937', 'Cobija 3385', NULL, NULL, NULL, '2006-10-17', '2022-09-09', 'Femenino', 1, 0, 0),
  ('18124676-6', 'Dayanna Analia', 'Milla', 'Cortes', 'dayannamilla60@gmail.com', '+56921689148', 'hurtado de mendoza 2496', NULL, NULL, NULL, '1992-02-10', '2024-09-27', 'Femenino', 1, 1, 1),
  ('11467096-0', 'Silvia Isabel', 'Miranda', 'Bolados', 'silviaisabel_9@hotmail.com', '+56975118025', 'Cobija 3385', NULL, NULL, NULL, '1969-09-11', '2025-09-10', 'Femenino', 1, 1, 0),
  ('22990290-3', 'Francisca Arianna', 'Panire', 'Pasten', 'panirefrancisca0@gmail.com', '+56952274104', 'Calle Nueva #2531', NULL, NULL, NULL, '2009-04-06', '2023-09-09', 'Femenino', 1, 1, 1),
  ('24042967-5', 'Amy Sabrina', 'Peña', 'Lemos', 'apenalemos@gmail.com', '+56950000052', 'Huatiquina 1121', 'Daniel Peña', NULL, NULL, '2012-08-14', '2024-09-27', 'Femenino', 0, 0, 0),
  ('27765628-0', 'Dominica Andrea', 'Peñafiel', 'Cedeño', 'dessykeyra26@gmail.com', '+56966625858', 'Luis Risopatron 2467', 'Nelly Cedeño', '25815235-2', NULL, '2009-07-09', '2023-09-09', 'Femenino', 1, 1, 0),
  ('17392818-1', 'Priscila Pamela', 'Robles', 'Pereira', 'pilyta1989@gmail.com', '+56975442398', 'O''Higgins 2977', NULL, NULL, NULL, '1989-12-12', '2014-09-08', 'Femenino', 1, 1, 1),
  ('23540955-0', 'Monserrat Pascal', 'Tapia', 'Ardiles', 'claraardileslera@gmail.com', '+56984471610', 'Calle Osorno 1127', 'Clara Ardiles', NULL, NULL, '2011-01-21', '2026-03-15', 'Femenino', 1, 1, 0),
  ('19825356-1', 'Dominique Fernanda', 'Vega', 'Vega', 'dominiquefernanda.vega@gmail.com', '+56978772277', 'Brasilia 1499', NULL, NULL, NULL, '1998-03-20', '2023-09-09', 'Femenino', 1, 1, 1),
  ('15981746-6', 'Melissa Massiel', 'Vidal', 'Arancibia', 'melycev@gmail.com', '+56964375895', 'Fresia 2520', NULL, NULL, NULL, '1986-12-26', '2025-10-26', 'Femenino', 1, 1, 1),
  ('23749198-K', 'Williams Daisuke Rounin', 'Alcayaga', 'Sotomayor', 'germansotomayor27@hotmail.com', '+56985365392', 'Pasaje Volcan Olca 3535 Villa Los Volcanes', 'German Sotomayor', '9084008-8', NULL, '2011-09-16', '2017-09-09', 'Masculino', 1, 0, 0),
  ('21893940-6', 'Benjamin', 'Alvarado', 'Diaz', 'alvaradobenjamin2005@gmail.com', '+56971015792', 'Rupanco 3087', NULL, NULL, NULL, '2005-07-21', '2025-09-26', 'Masculino', 1, 0, 0),
  ('23759640-4', 'Santiago Alexander', 'Anza', 'Salvatierra', 'alejandro.nicolaz.munoz@gmail.com', '+56990257569', 'Colombia 3064', 'Elsa Urquieta', NULL, NULL, '2011-09-15', '2018-09-27', 'Masculino', 1, 0, 0),
  ('24277809-K', 'Mateo Nicolás', 'Arancibia', 'Cortes', 'arancibialbo@gmail.com', '+56967979074', 'Pasaje Petrohue Sur 3050', 'Oscar Elías Arancibia Araya', '17093953-0', NULL, '2013-05-14', '2015-11-01', 'Masculino', 0, 0, 0),
  ('22004189-1', 'Yeray', 'Araya', 'Araya', 'yerayaraya3@gmail.com', '+56998192804', 'Pedro Aguirre Cerda 2222', NULL, NULL, NULL, '2005-12-14', '2025-09-26', 'Masculino', 1, 1, 1),
  ('14532604-4', 'Alfredo Luis', 'Araya', 'Bautista', 'arayaluisalfredo30@gmail.com', '+56966116006', 'Cobija 3707 chunchuri Alto', NULL, NULL, NULL, '1974-08-30', '1989-09-09', 'Masculino', 1, 1, 1),
  ('20274853-8', 'Patricio', 'Araya', 'Tello', 'pato2299arte@gmail.com', '+56998773213', 'psje freí Bonn oriente 3315', NULL, NULL, NULL, '1999-10-22', '2024-09-26', 'Masculino', 1, 1, 0),
  ('22777012-0', 'Daniel Ignacio', 'Baltra', 'Cardenas', 'danielbaltra08@gmail.com', '+56926167466', 'Nueva Oriente 2878', 'Ivan Cruz Tello', NULL, NULL, '2008-07-22', '2025-09-26', 'Masculino', 1, 0, 0),
  ('24027170-2', 'Maximiliano Neyzar', 'Barria', 'Muraña', 'maxbm.0108@gmail.com', '+56984506350', 'Santiago Humberstone 2873', 'Joselyn Valdivia', '15017334-5', NULL, '2012-08-01', '2017-09-09', 'Masculino', 0, 0, 0),
  ('22761503-6', 'Angello Benjamin', 'Becerra', 'Marin', 'angello.becerra@lbdp.cl', '+56995000417', 'Avenida La Paz 1515', NULL, NULL, NULL, '2008-06-27', '2022-09-09', 'Masculino', 1, 1, 1),
  ('22011836-3', 'Sebastian Alejandro', 'Campós', 'Moyano', 'sebastiancampos0524@gmail.com', '+56934031444', 'Las parinas 1061', NULL, NULL, 'Falta confirmar bloques', '2005-12-24', '2025-10-26', 'Masculino', 1, 1, 1),
  ('24446042-9', 'Lionel David', 'Castillo', 'Alcayaga', 'marisolcastillozuleta@hotmail.com', '+56984551373', 'Coquimbo 3555', 'Marisol Castillo Zuleta', '15969657-K', NULL, '2013-11-07', '2021-07-13', 'Masculino', 1, 0, 0),
  ('10475062-1', 'Luis Alexis', 'Cerón', 'Parra', 'luisalexisceronparra04@gmail.com', '+56948160538', 'Barrio Nueva esperanza', NULL, NULL, NULL, '1965-09-05', '2025-10-26', 'Masculino', 1, 0, 0),
  ('17515282-2', 'Gerald Eduardo', 'Contreras', 'Segovia', 'geraldcontreras863@gmail.com', '+56933783838', 'Huatiquina 1446', NULL, NULL, NULL, '1991-01-08', '2024-09-09', 'Masculino', 1, 1, 1),
  ('24233057-9', 'Evans Nicolas Nan-Yao', 'Cordova', 'Ayabire', 'alynn.ayabire.flores@gmail.com', '+56982072667', 'Canada 2522', 'Alynn Ayabire Flores', '17392800-9', NULL, '2013-03-28', '2018-09-27', 'Masculino', 1, 0, 0),
  ('24492108-6', 'Carlos Maximiliano', 'Coria', 'Diaz', 'carlos.coria.gutierrez@gmail.com', '+56992827090', 'Pedro de Valdivia 360 Villa las vegas', 'Carlos Coria', '24492108-6', NULL, '2013-12-26', '2014-09-09', 'Masculino', 0, 0, 0),
  ('22262018-K', 'Javier Orlando', 'Cortés', 'Romero', 'javier.cortes.1911@gmail.com', '+56966835228', 'Escocia #2666, Pob René Schneider', NULL, NULL, NULL, '2006-11-19', '2023-09-09', 'Masculino', 1, 1, 1),
  ('20094158-6', 'Ivan Alejandro', 'Cruz', 'Cardenas', 'ivanalejandro.cruz99@gmail.com', '+56956939830', 'Nueva Oriente 2878 depto 23 Villa Exotica', NULL, NULL, NULL, '1999-06-17', '2012-09-09', 'Masculino', 1, 1, 1),
  ('22715529-9', 'Joaquin Santiago', 'Cruz', 'Colamar', 'joaquin.scruzc@hotmail.com', '+56964459142', 'Psje Ciudad Heroica 3113 pobl Polanco Nuño', 'Maria Alejandra Colamar Anza', NULL, NULL, '2008-05-07', '2015-06-09', 'Masculino', 1, 1, 0),
  ('25067086-9', 'Ivan Rodrigo', 'Cruz', 'Puca', 'ivanalejandro.cruz99@gmail.com', '+56956939830', 'Nueva Oriente 2878', 'Ivan Cruz Cardenas', '20094158-6', NULL, '2013-08-05', '2025-09-26', 'Masculino', 1, 0, 0),
  ('10701152-8', 'Ivan Ernesto', 'Cruz', 'Tello', 'ivanernesto66@gmail.com', '+56984628000', 'Nueva Oriente 2878 depto 23 Villa Exotica', NULL, NULL, NULL, '1966-01-15', '1985-09-09', 'Masculino', 1, 1, 1),
  ('19206407-4', 'Alfonso Guillermo', 'Fernández', 'Collao', 'alfonso.fernandez.collao16@gmail.com', '+56944024355', 'Alonso de ercilla 2598', NULL, NULL, NULL, '1996-08-18', '2023-09-09', 'Masculino', 1, 1, 1),
  ('21142304-8', 'César Alejandro', 'Formas', 'Tapia', 'cesar.formas14@gmail.com', '+56966422950', NULL, NULL, NULL, NULL, '2002-10-04', '2024-09-09', 'Masculino', 1, 1, 1),
  ('18826196-5', 'Marco Antonio', 'Gahona', 'Collao', 'marcogahonacollao@hotmail.com', '+56932421086', 'Paraguay 2533 Población Nueva Alemania', NULL, NULL, NULL, '1994-10-10', '2012-09-09', 'Masculino', 1, 1, 0),
  ('23581373-4', 'Lucas Ariel', 'Gahona', 'Gahona', 'lucasgahona2011@gmail.com', '+56983564558', 'Psje Colonia Oriente 3586', 'Ingri Gahona Collao', '16565483-8', NULL, '2011-03-04', '2014-09-08', 'Masculino', 1, 0, 0),
  ('13010958-6', 'Cesar Mauricio', 'Gahona', 'Ramos', 'cgahonar@gmail.com', '+56934430919', 'Pje Spence 1076', NULL, NULL, NULL, '1976-09-03', '2024-09-27', 'Masculino', 1, 1, 0),
  ('19538925-K', 'Yeral Emadiel', 'Gajardo', 'Araya', 'yeral.gajardo97@gmail.com', '+56945383907', 'Cobija 3707 parcela 22', NULL, NULL, NULL, '1997-05-28', '2021-09-09', 'Masculino', 1, 1, 1),
  ('17093783-K', 'Gabriel Antonio', 'Gajardo', 'Peña', 'gabriel.ggajardo@gmail.com', '+56957395082', 'Alonso de Ercilla 2278', NULL, NULL, NULL, '1989-03-28', '2021-08-07', 'Masculino', 1, 0, 0),
  ('15801275-8', 'Francisco Antonio', 'Gallardo', 'Ayabire', 'f30gallardo@gmail.com', '+56930505480', 'Chinchilla 1498', NULL, NULL, NULL, '1984-03-13', '2021-09-09', 'Masculino', 1, 1, 1),
  ('23088741-1', 'Tomás Benjamín', 'Gallardo', 'Fuentes', 'mf1513bv@gmail.com', '+56930561758', 'Chinchilla 1513, Villa Ascotan', NULL, NULL, NULL, '2009-08-01', '2023-09-09', 'Masculino', 1, 1, 1),
  ('19825319-7', 'Luis Eduardo', 'García', 'García', 'lucho.o.h2p@gmail.com', '+56975178935', 'Argentina 3972', NULL, NULL, NULL, '1998-03-10', '2024-09-09', 'Masculino', 1, 1, 0),
  ('10818566-K', 'Jorge Leonel', 'Gavia', 'Mondaca', 'gmleo3804@gmail.com', '+56952335838', 'Paqui 732', NULL, NULL, NULL, '1966-04-22', '1994-05-10', 'Masculino', 1, 1, 1),
  ('23827142-8', 'Joaquin Alejandro', 'Gomez', 'Ayala', 'lupe_a_01@hotmail.com', '+56978585514', 'Vicuña Mackena 2873', 'Maria Jose León', '15981679-6', NULL, '2011-12-19', '2022-09-29', 'Masculino', 1, 1, 0),
  ('19867527-K', 'Maximiliano Enrique', 'Gomez', 'Paucay', 'maxigomez1311@gmail.com', '+56979628464', 'Av tocopilla 2326', NULL, NULL, NULL, '1999-02-12', '2016-09-09', 'Masculino', 1, 1, 1),
  ('19252937-9', 'Angelo Andres', 'Gonzalez', 'Cruz', 'ang.andres.ag@gmail.com', '+56978957305', 'Luis Ling 8163', NULL, NULL, NULL, '1996-07-03', '2023-09-28', 'Masculino', 1, 1, 0),
  ('23430795-9', 'Nicolas Vicente', 'Guiterrez', 'Trincado', 'carlanga1953@gmail.com', '+56997752583', 'La cascada 1273', 'Pedro Donoso', '13417529-K', NULL, '2010-09-16', '2022-09-29', 'Masculino', 1, 0, 0),
  ('20525812-4', 'Sebastian Andres', 'Henriquez', 'Paredes', 'sebastiankrs32@gmail.com', '+56963228994', 'Teniente Merino 3405', NULL, NULL, NULL, '2000-10-17', '2024-09-27', 'Masculino', 1, 1, 1),
  ('21368676-3', 'Benjamin Orlando', 'Herrera', 'Corante', 'bohc738@gmail.com', '+56940616324', 'Psje San Pedro 997', NULL, NULL, NULL, '2003-08-17', '2013-09-09', 'Masculino', 1, 1, 0),
  ('23974726-4', 'Axel Antonio', 'Leiva', 'Butron', 'ob4897@gmail.com', '+56932585727', 'Av Grecia 1748', 'Olga Yohanna Buttron luizaga', '17392967-6', 'Diablo', '2012-06-02', '2015-09-09', 'Masculino', 1, 0, 0),
  ('15768718-2', 'Diego Armando', 'Leiva', 'Reyes', 'dleivareyes@gmail.com', '+56963493254', 'Arauco 2603', NULL, NULL, NULL, '1986-11-24', '2022-09-29', 'Masculino', 1, 1, 0),
  ('15733389-5', 'Oscar Jair', 'Maizares', 'Cruz', 'oscar.jair2483@gmail.com', '+56982017932', 'Maipu 3714', NULL, NULL, NULL, '1983-06-11', '2019-09-27', 'Masculino', 1, 0, 0),
  ('22108706-K', 'Shaiel', 'Massida', 'Flores', NULL, '+56949751150', 'Laguna Tebinquiche 1420', NULL, NULL, NULL, '2006-05-02', '2024-09-27', 'Masculino', 1, 1, 0),
  ('23196427-4', 'Ignacio Andres', 'Mella', 'Cortes', 'imellacortes@gmail.com', '+56934698754', '5 Norte 1253', 'Lelye Cortes', '15017200-4', NULL, '2009-12-09', '2024-09-27', 'Masculino', 1, 1, 0),
  ('15972189-2', 'Jonathan Andres', 'Mella', 'Dubos', 'jonathanmellad@gmail.com', '+56932307029', '5 Norte 1253', NULL, NULL, NULL, '1985-03-15', '2024-09-27', 'Masculino', 1, 1, 1),
  ('23717371-6', 'Bastián Vladimir', 'Miranda', 'Palta', 'hmira006@gmail.com', '+56951940619', 'Psj Irma 964', 'Carlos Barrera', '10208436-5', 'Diablo', '2011-08-12', '2018-09-27', 'Masculino', 1, 0, 0),
  ('18124901-3', 'Ignacio David', 'Mondaca', 'Muñoz', 'ignaciomondaca.03@gmail.com', '+56995306980', 'Av. Antilhue 1250', NULL, NULL, NULL, '1992-06-03', '2025-09-26', 'Masculino', 1, 1, 1),
  ('22777575-0', 'Vicente Alejandro', 'Montalban', 'Balboa', 'vichomontalban08@gmail.com', '+56933273238', 'Joaquin Prieto 1961', 'Jorge Montalban', '13216298-0', 'Diablo', '2008-07-24', '2015-09-09', 'Masculino', 1, 1, 0),
  ('20622178-K', 'Alexis Danilo', 'Montecinos', 'Hermosilla', 'alexis.dhv20@gmail.com', '+56948446861', 'Sector yalquincha parcela 2', NULL, NULL, NULL, '2000-09-20', '2023-09-09', 'Masculino', 1, 1, 1),
  ('19826111-4', 'Sebastian Ronald', 'Mundaca', 'Rojas', 'smundacarojas@gmail.com', '+56941464421', 'Psj Arica 4205', NULL, NULL, NULL, '1998-09-01', '2023-09-28', 'Masculino', 1, 0, 0),
  ('19551836-K', 'Francisco Marcelo', 'Navea', 'Veliz', 'marcelonaveaveliz@gmail.com', '+56984069712', 'Pasaje Los Cedros 937 Villa Los Algarrobos', NULL, NULL, NULL, '1997-01-27', '2012-09-09', 'Masculino', 1, 0, 0),
  ('16565345-9', 'Arturo Héctor', 'Nogales', 'Roco', 'arturo.nogales87@gmail.com', '+56940137792', 'Alonso de Ercilla 2131', NULL, NULL, NULL, '1987-02-01', '2018-09-27', 'Masculino', 1, 1, 0),
  ('22284026-0', 'Matias Ignacio', 'Nogales', 'Saldias', 'matayas.ns@gmail.com', '+56973783446', 'Alonso de Ercilla 2131', NULL, NULL, NULL, '2006-12-13', '2025-09-29', 'Masculino', 1, 1, 1),
  ('23740513-7', 'Benjamin', 'Olate', 'Criado', 'javiera.criado.veliz@gmail.com', '+56984663330', 'Balmaceda 1929', 'Javiera Criado Véliz', '20347711-2', NULL, '2011-09-07', '2021-09-09', 'Masculino', 1, 0, 0),
  ('17392013-K', 'Juan Carlos', 'Orellana', 'Rubina', 'juanor714@gmail.com', '+56998136206', 'Ejército 3849', NULL, NULL, NULL, '1989-08-08', '2019-09-09', 'Masculino', 1, 1, 1),
  ('20348262-0', 'Bastian Alejandro', 'Ortiz', 'Ortiz', 'pathito.ortiz@gmail.com', '+56961247406', 'Alfalfares 35b, La Serena', NULL, NULL, NULL, '2000-10-20', '2023-09-09', 'Masculino', 1, 1, 1),
  ('22685026-0', 'Sebastian', 'Panire', 'Cruz', 'sebastianpanire4@gmail.com', '+56932018168', 'Psje. Toko Llamo', 'Alexis Panire', '13632490-K', NULL, '2008-03-27', '2023-09-28', 'Masculino', 1, 0, 0),
  ('17393423-8', 'Michel Antonio', 'Pasten', 'Araya', 'procolorcalama@gmail.com', '+56982548296', 'Riquelme 3674', NULL, NULL, NULL, '1990-05-25', '2015-09-09', 'Masculino', 1, 1, 1),
  ('16565161-8', 'Bryan Cristian', 'Pasten', 'Muñoz', 'bryanpasten2@gmail.com', '+56987321751', 'Costa Rica 2893 Casa 1', NULL, NULL, NULL, '1986-12-26', '2015-09-09', 'Masculino', 1, 0, 0),
  ('23384198-6', 'Matias Benjamin Ernesto', 'Pasten', 'Olivares', 'matiaspasten885@gmail.com', '+56963998162', 'Costa Rica 2893 Casa 1', 'Bryan Pasten', '16565161-8', 'Diablo', '2010-07-20', '2012-09-09', 'Masculino', 1, 0, 0),
  ('24290211-4', 'Matias Nicolas', 'Plaza', 'Plaza', 'haylen.plaza.f@gmail.com', '+56973960501', 'General Salvo 2950', 'Haylen Plaza', '18183734-9', NULL, '2013-05-31', '2024-09-27', 'Femenino', 1, 1, 0),
  ('18189868-6', 'Luis Miguel', 'Puca', 'Gavia', 'pucaluis1212@gmail.com', '+56944815501', NULL, NULL, NULL, NULL, '1985-04-18', '2018-09-27', 'Masculino', 1, 1, 1),
  ('23407800-3', 'Martin Amaro', 'Quintullanca', 'Riaño', 'roquintullanca@gmail.com', '+56993031883', 'Hector Enriquez 9760 Antof', 'Rodrigo David Quintullanca Vera', '15904794-6', NULL, '2010-08-17', '2025-10-13', 'Masculino', 0, 0, 0),
  ('22270540-9', 'Rodrigo Sebastian', 'Riquelme', 'Manrriquez', 'sebitas.riquelme.m@gmail.com', '+56934271712', 'Las Vegas 978', NULL, NULL, NULL, '2006-11-24', '2023-09-28', 'Masculino', 1, 1, 1),
  ('23304536-5', 'Diego Jesús', 'Rodriguez', 'Morales', 'moralesmedranocyndia@gmail.com', '+56982105662', 'Andres Bello 3320', 'Sebastian Lara', '21024804-8', NULL, '2010-04-21', '2021-11-11', 'Masculino', 1, 1, 0),
  ('21452001-K', 'Miguel Orlando', 'Salva', 'Diaz', 'miguelsalva06@gmail.com', '+56934147563', 'Colombia 3234', NULL, NULL, NULL, '2003-11-25', '2015-09-09', 'Masculino', 1, 1, 1),
  ('7665110-8', 'Eleuterio Erasmo', 'Sandon', 'Rojas', 'esandon94@gmail.com', '+56995474560', 'Costa Rica 2978', NULL, NULL, NULL, '1961-03-16', '2020-09-09', 'Masculino', 1, 1, 1),
  ('23632381-1', 'Oscar Manuel', 'Santader', 'Molina', 'oscar.santander@icloud.com', '+56974779176', 'Chala 2306', 'Rodrigo Santander', '12802173-6', NULL, '2011-04-27', '2015-09-09', 'Masculino', 1, 1, 0),
  ('9084008-8', 'German Andres', 'Sotomayor', 'Galleguillos', 'germansotomayor27@hotmail.com', '+56985365392', 'Pasaje Volcan Olca 3535 Villa Los Volcanes', NULL, NULL, NULL, '1963-03-26', '2016-09-09', 'Masculino', 1, 1, 1),
  ('20099054-4', 'Alejandro Antonio', 'Taipe', 'Gajardo', 'alejandro_taipe20@hotmail.com', '+56975892434', 'calle nueva 2598', NULL, NULL, NULL, '1999-01-12', NULL, 'Masculino', 1, 1, 1),
  ('19538288-3', 'Juan Ernesto', 'Valdivia', 'Parra', 'valdiviajuan1997@gmail.com', '+56978038748', 'El Loa 2429', NULL, NULL, NULL, '1997-02-03', '2018-09-27', 'Masculino', 1, 1, 0),
  ('18183768-3', 'Cristopher Andres', 'Vallejo', 'Diaz', 'cri.vallejo25@gmail.com', '+56952323156', 'Arauco 3056', NULL, NULL, NULL, '1992-11-11', '2025-06-06', 'Masculino', 1, 1, 1),
  ('10865909-2', 'Benito Manuel', 'Varas', 'Tapia', 'benito.varas@gmail.com', '+56961205952', 'Cobija 2056', NULL, NULL, NULL, '1966-11-19', '1985-09-09', 'Masculino', 1, 1, 1),
  ('23772049-0', 'Matias Ignacio', 'Vasquez', 'Barrera', 'matiasignaciov@gmail.com', '+56927600828', 'Calafquen #3533', 'Patricia Barrera Cortes', NULL, NULL, '2011-10-13', '2024-12-14', 'Masculino', 1, 1, 0),
  ('18826418-2', 'Sebastián Rodolfo', 'Verdejo', 'Piña', 'tomas.verdejo2021@gmail.com', '+56975961313', 'Don Oriones 1108', NULL, NULL, NULL, '1994-11-07', '2018-09-27', 'Masculino', 1, 0, 0),
  ('13216063-5', 'Carlos Armando', 'Villagra', 'Pizarro', 'carvillagra11@gmail.com', '+56957757220', 'Riquelme 3674', NULL, NULL, NULL, '1977-01-11', '2017-10-13', 'Masculino', 1, 1, 1),
  ('18482923-1', 'Misael Ariel', 'Yañez', 'Diaz', 'misa.vw90@gmail.com', '+56958723280', 'Calle Antofagasta #3326', NULL, NULL, NULL, '1993-08-28', '2022-09-29', 'Masculino', 1, 1, 0),
  ('23581986-4', 'Damian Nicolas', 'Zambrano', 'Urquieta', 'dz9849705@gmail.com', '+56990257569', 'San Martin 3625', 'Tania Zambrano', '19825086-4', NULL, '2011-03-04', '2024-09-27', 'Masculino', 0, 0, 0),
  ('22104492-4', 'Benjamin Rafael', 'Argandoña', 'Gonzalez', 'benjaxdd.2706@gmail.com', '+56978908574', 'Malleco 2428', NULL, NULL, NULL, '2006-04-27', '2024-09-27', 'Masculino', 1, 0, 0),
  ('19537367-3', 'Benjamin Ignacio', 'Campusano', 'Campusano', 'benjacampusano19@gmail.com', '+56959262625', 'Laguna Cejar 560', NULL, NULL, NULL, '1996-11-03', '2023-09-09', 'Masculino', 1, 1, 1),
  ('21086809-7', 'Nicolas Isaac', 'Caro', 'Muñoz', 'nicolascaromunoz@gmail.com', '+56974533976', 'Héctor Pumarino Soto 662', NULL, NULL, NULL, '2002-08-06', '2015-09-09', 'Masculino', 1, 1, 1),
  ('21200106-6', 'Yeremy Ivan', 'Gallardo', 'Fuentes', 'yxrxmx.15@gmail.com', '+56920064492', 'Chinchilla 1513', NULL, NULL, NULL, '2002-11-26', '2025-09-26', 'Masculino', 1, 0, 0),
  ('19552326-6', 'Sebastián Alejandro', 'Lara', 'Rodriguez', 's.97.lara@gmail.com', '+56968487181', 'José Joaquin Prieto 2037', NULL, NULL, NULL, '1997-09-29', '2020-09-09', 'Masculino', 1, 1, 1),
  ('20274748-5', 'Catalina Rosa', 'Lincopi', 'Gonzalez', 'clincopig@icloud.com', '+56993169499', 'Los Robles 1747', NULL, NULL, NULL, '1999-10-03', '2024-09-27', 'Femenino', 1, 1, 1),
  ('21958927-1', 'Millaray Yubinza', 'Lincopi', 'Gonzalez', 'millaray.ylg@gmail.com', '+56979668124', 'Los Robles 1747', NULL, NULL, NULL, '2005-10-22', '2024-09-27', 'Femenino', 1, 0, 0),
  ('18362574-8', 'Nicole Patricia', 'Magna', 'Magna', 'nicole.magna.magna@gmail.com', '+56920213258', 'Carlos Condell 1880', NULL, NULL, NULL, '1993-03-10', '2025-09-26', 'Femenino', 1, 1, 1),
  ('21005219-4', 'Tomas', 'Montoya', 'Cruz', 'tomas_2515@icloud.com', '+56942716745', 'Puritama 363', NULL, NULL, NULL, '2002-04-25', '2022-09-29', 'Masculino', 1, 0, 0),
  ('23366139-2', 'Crhistobal Dimittri', 'Paniagua', 'Paredes', 'misa.vw90@gmail.com', '+56958723280', 'Calle Antofagasta #3326', 'Tamara Paredes', '19328388-8', NULL, '2010-07-05', '2024-09-10', 'Masculino', 1, 1, 1),
  ('24217189-6', 'Sayumi Ayanami', 'Silva', 'Valdivia', 'jvaldiviasalva@gmail.com', '+56989130352', 'Costa Rica 2893 Casa 1', 'Joselyn Valdivia', '15017334-5', 'Osos', '2013-03-12', '2013-09-09', 'Femenino', 1, 0, 0),
  ('10347824-3', 'Marianela Susana', 'Valdivia', 'Salva', 'marianelavaldivia876@gmail.com', '+56975871750', 'Psj Rupanco 1792', NULL, NULL, NULL, '1967-08-11', '2010-09-09', 'Femenino', 1, 1, 1),
  ('20936686-K', 'Almendra Belen', 'Castillo', 'Puca', 'pucalmendra11@gmail.com', '+56982811524', 'Chala 2532', NULL, NULL, NULL, '2001-12-06', '2022-09-29', 'Femenino', 1, 1, 1),
  ('19824554-2', 'Saska Priscila', 'Donoso', 'Rojas', 'saska.donoso.rojas@gmail.com', '+56998168075', 'Finlandia 2325', NULL, NULL, NULL, '1997-09-30', '2001-09-09', 'Femenino', 1, 1, 1),
  ('23348756-2', 'Antonella Michelle', 'Espinoza', 'Rojas', 'karyrojas38@gmail.com', '+56945002196', 'Los cedros 919 villa los algarrobos', 'Karen Rojas Oyarce', '18125011-9', 'Virtud', '2010-06-13', '2018-09-27', 'Femenino', 1, 0, 0),
  ('15982740-2', 'Marcela Alejandra', 'Fuentes', 'Maizares', 'mf1513bva@gmail.com', '+56930561758', 'Caupolican 1365', NULL, NULL, NULL, '1985-06-23', '2013-12-01', 'Femenino', 1, 1, 1),
  ('17392847-5', 'Suam King', 'González', 'Lucero', 'ecisternasaraya@gmail.com', '+56990860177', 'Los Sauces 2412', NULL, NULL, NULL, '1990-02-09', '2020-09-09', 'Femenino', 1, 1, 1),
  ('18183734-9', 'Haylen Nicole', 'Plaza', 'Fuentes', 'haylen.plaza.f@gmail.com', '+56973960501', 'General Salvo 2950', NULL, NULL, NULL, '1992-10-19', '2024-09-27', 'Femenino', 1, 1, 1),
  ('22708633-5', 'Holly Anais', 'Ramos', 'Araya', 'hollyramos.04@gmail.com', '+56998757231', 'Cobija 3130, Polanco Nuño', 'Maria Isabel Araya', '15740823-2', 'Tentaciones', '2008-04-21', '2009-09-09', 'Femenino', 1, 1, 0),
  ('21086497-0', 'Natalya Noemi', 'Tapia', 'Maldonado', 'natalyatapia924@gmail.com', '+56926039807', 'Enrique Villegas 1811', NULL, NULL, NULL, '2002-08-07', '2018-09-27', 'Femenino', 1, 1, 1),
  ('20415628-K', 'Naska Pia Fernanda', 'Valenzuela', 'Robles', 'naskapiafernanda@gmail.com', '+56985692792', 'Hernan Cortes 3055 Poblacion Rene Schneider', NULL, NULL, NULL, '2000-05-19', '2015-09-25', 'Femenino', 1, 1, 1),
  ('17655249-2', 'Rodrigo', 'Chavez', 'Ramirez', 'rodrigo.ch.ramirez@gmail.com', '+56966490594', 'Rio Negro 3823', NULL, NULL, NULL, '1990-12-13', '2018-03-01', 'Masculino', 1, 1, 1),
  ('13417529-K', 'Pedro Hugo', 'Donoso', 'Ogalde', 'ts.pdonosoogalde@gmail.com', '+56957390216', 'Psje Chile 2467', NULL, NULL, NULL, '1978-06-29', '1980-09-09', 'Masculino', 1, 1, 0),
  ('17655896-2', 'Jordan Raul', 'Magna', 'Salazar', 'jordanmagna63@gmail.com', '+56995443042', 'David silverman 4654 Tucnar Huasi', NULL, NULL, NULL, '1991-04-18', '1993-09-09', 'Masculino', 1, 0, 0),
  ('20352601-6', 'Williams Sebastian', 'Muñoz', 'Villalobos', 'wlmuozv@gmail.com', '+56991619450', 'Topater 2243', NULL, NULL, NULL, '2000-12-31', '2015-09-09', 'Masculino', 1, 1, 0),
  ('20094018-0', 'Nicolás Ignacio', 'Puca', 'Mamani', 'nicolaspuca99@gmail.com', '+56981861458', 'Salar del Carmen 4583', NULL, NULL, NULL, '1999-01-05', '2020-09-09', 'Masculino', 1, 0, 0),
  ('17974328-0', 'Oscar Edwin', 'Puca', 'Mamani', 'oscarpuca2@gmail.com', '+56956913047', 'Salar del Carmen 4583', NULL, NULL, NULL, '1991-08-28', '2020-09-09', 'Masculino', 1, 1, 0),
  ('16785228-9', 'Alejandro Ventura', 'Araya', 'Bautista', 'venturaraya.b@gmail.com', '+56962160780', 'Psje Vecinal N°4 Sitio 14', NULL, NULL, NULL, '1987-11-08', '2001-09-10', 'Masculino', 1, 0, 0),
  ('18654834-5', 'Jairo Eder', 'Becerra', 'Valdivia', 'jairo.becerra.94@gmail.com', '+56992230373', 'Inca de Oro 4139 Villa Los Yacimientos', NULL, NULL, NULL, '1994-06-10', '2005-09-09', 'Masculino', 1, 0, 0),
  ('16203470-7', 'Felipe Andres', 'Carvajal', 'Pereira', 'carvajalfelipe1@gmail.com', '+56991285248', 'Paniri 2053 Villa Caspana', NULL, NULL, NULL, '1986-05-28', '1998-09-09', 'Masculino', 1, 1, 1),
  (NULL, 'Sebastian', 'Gonzalez', 'Segovia', 'segoviasebastian187@gmail.com', '+56938830285', 'Psje Vecinal N°4 Sitio 14', NULL, NULL, NULL, '1995-03-01', '2008-09-09', 'Masculino', 1, 1, 1),
  ('18400220-5', 'Francisco Javier', 'Luza', 'Pizarro', 'franciscoluzapizarro@gmail.com', '+56949885284', 'Anibal Pinto 1985 centro', NULL, NULL, NULL, '1993-01-14', '2006-09-09', 'Masculino', 1, 1, 1),
  ('18183070-0', 'Roberto Salvador', 'Mella', 'Salazar', 'robertosalvador.ms92@gmail.com', '+56931928689', 'México 3202 Villa Alborada', NULL, NULL, NULL, '1992-06-05', '2011-09-09', 'Masculino', 1, 1, 1),
  ('21495793-0', 'Fernando Nicolas', 'Muñoz', 'Thieme', 'fernandomunozthieme@gmail.com', '+56961789152', 'Federico Errazuriz 2157 pob Prat', NULL, NULL, NULL, '2004-01-29', '2007-09-09', 'Masculino', 1, 1, 0),
  ('11931690-1', 'Oscar Javier', 'Aramayo', 'Antezana', 'oscar_aramayo@hotmail.com', '+56968322400', 'Avenida Arturo Prat 1887', NULL, NULL, NULL, '1972-10-19', '2021-07-21', 'Masculino', 1, 1, 1),
  ('11506379-0', 'Clara Evangelina', 'Ardiles', 'Lera', 'claraardileslera@gmail.com', '+56984471610', 'Calle Osorno 1127', NULL, NULL, NULL, '1970-11-05', '2026-03-15', 'Femenino', 1, 1, 1),
  ('13743766-K', 'Andrea Javiera', 'Balboa', 'Lafuente', 'andreacardiokine@gmail.com', '+56996329674', 'Joaquin Prieto 1961', NULL, NULL, NULL, '1980-11-02', '2018-09-27', 'Femenino', 1, 1, 1),
  ('10208436-5', 'Carlos Ibar', 'Barrera', 'Godoy', 'carlosbarrera_02@hotmail.com', '+56957548247', 'Quemazon 3050', NULL, NULL, NULL, '1964-08-02', '2002-09-09', 'Masculino', 1, 1, 1),
  ('17392967-6', 'Olga Yohanna', 'Butron', 'Luizaga', 'butrono980@gmail.com', '+56932585727', 'Alonso Ercilla 2524', 'Axel Leiva Butron', NULL, NULL, '1990-03-08', '2021-09-09', 'Femenino', 0, 0, 0),
  ('15015909-1', 'Maria Jose', 'Campillay', 'Vargas', 'cote.campillay@gmail.com', '+56954948713', 'Aldunate 940', NULL, NULL, NULL, '1982-11-18', '2024-09-27', 'Femenino', 1, 1, 0),
  ('18520729-3', 'Scarlet Francisca', 'Carvajal', 'Rojas', 'scarlet.carvajal.93@gmail.com', '+56994522059', 'Punta de Rieles 1948', NULL, NULL, NULL, '1993-08-21', '2025-09-29', 'Femenino', 1, 1, 1),
  ('9810831-9', 'Soledad del Carmen', 'Castillo', 'Avilés', 'walterbimboii@gmail.com', '+56987418588', 'Huatiquina 1037', NULL, NULL, NULL, '1965-02-12', '2013-09-09', 'Femenino', 1, 1, 1),
  ('8874579-5', 'Margarita Domitila', 'Cereceda', 'Carvajal', 'm.cereceda.carvajal@gmail.com', '+56966023630', 'Paqui 732', NULL, NULL, NULL, '1963-07-06', '2014-09-09', 'Femenino', 1, 1, 1),
  ('11720300-K', 'Teresa Cecilia', 'Colamar', 'Colamar', 'teresacolamar1516@gmail.com', '+56979719169', 'San Fernando 1238', NULL, NULL, NULL, '1970-10-15', '2020-09-09', 'Femenino', 1, 1, 1),
  ('13417400-5', 'Liliana Leticia', 'Collao', 'Adaros', 'lilianacollao903@gmail.com', '+56984059701', NULL, 'eyddan gabriel tabilo tabilo y valentina sophia o''rian collao', NULL, NULL, NULL, NULL, 'Femenino', 0, 0, 0),
  ('3116200-9', 'Angel Edmundo', 'Corante', 'Agüero', 'yeliangel24@yahoo.es', '+56977340509', 'Lascar 346 San Pedro', NULL, NULL, NULL, '1932-11-16', '2024-09-27', 'Masculino', 1, 1, 1),
  ('10149031-9', 'Angelica Del Carmen', 'Corante', 'Ramirez', 'yeliangel24@yahoo.es', '+56977340509', 'Lascar 346 San Pedro', NULL, NULL, NULL, '1965-06-24', '2013-09-09', 'Femenino', 1, 1, 1),
  ('9778766-2', 'Irene Aurora', 'Corante', 'Ramirez', 'icora23@hotmail.com', '+56994759341', 'Cobija 2701 casa 23', NULL, NULL, NULL, '1963-10-10', '2024-09-27', 'Femenino', 1, 1, 1),
  ('14455768-9', 'Marcela Elena', 'Corante', 'Ramirez', 'marcelaelena997@gmail.com', '+56984374633', 'Oasis San Pedro 997', NULL, NULL, NULL, '1972-08-18', '2024-09-27', 'Femenino', 1, 1, 1),
  ('15017200-4', 'Leslye Andrea', 'Cortes', 'Segovia', 'aechi29@gmail.com', '+56968201284', '5 Norte 1253', NULL, NULL, NULL, '1982-04-29', '2024-09-27', 'Femenino', 1, 1, 1),
  ('11721393-5', 'Rosa Maria', 'Diaz', 'Ortiz', 'rosamar_71@hotmail.com', '+56950872506', 'Calle Antofagasta #3326', NULL, NULL, NULL, '1971-10-29', '2022-09-29', 'Femenino', 1, 1, 1),
  ('12423696-7', 'Beatriz Irene', 'Diaz', 'Reales', 'bdiazra2@gmail.com', '+56987488643', 'Colombia 3234', NULL, NULL, NULL, '1973-06-28', '2015-09-09', 'Femenino', 1, 1, 1),
  ('13357196-5', 'Cristian Hugo', 'Donoso', 'Pinto', 'cdonoso2678@gmail.com', '+56997738491', 'Topater 2778', NULL, NULL, NULL, '1978-10-26', '2022-09-09', 'Masculino', 1, 1, 1),
  ('6919066-9', 'Soledad Del Carmen', 'Dubos', 'Cáceres', 'dannielaluna1993@gmail.com', '+56978936179', '5 norte 1253 villa exótica', NULL, NULL, NULL, '1952-05-29', '2026-04-20', 'Femenino', 1, 1, 1),
  ('11932294-4', 'Ilenia del Carmen', 'Ferrer', 'Ferrer', 'iferrer@municipalidadcalama.cl', '+56997952512', 'Vicuña Mackena 1976', NULL, NULL, NULL, '1972-07-16', '2022-09-29', 'Femenino', 1, 1, 1),
  ('17656869-0', 'Rolando Alberto', 'Flores', 'Olivares', 'ron_lando@hotmail.com', '+56957166355', 'Jaime Guzman 4300', NULL, NULL, NULL, '1983-03-06', '2023-09-09', 'Masculino', 1, 1, 0),
  ('11506625-0', 'Juan Enrique', 'Gomez', 'Morales', 'jugomezna@hotmail.com', '+56995705204', 'Colorado 2352', NULL, NULL, NULL, '1970-07-05', '2001-06-01', 'Masculino', 1, 1, 0),
  ('9148503-6', 'Patricio Ivan', 'Gonzalez', 'Escalera', 'gonzalezescalera@gmail.com', '+56981594592', 'Federico Errazuriz 2394', NULL, NULL, NULL, '1961-03-22', '2015-09-09', 'Masculino', 1, 1, 1),
  ('10345615-8', 'Iris Verónica', 'Graz', 'Velásquez', 'igrazv@gmail.com', '+56981384893', 'Federico Errazuriz 2394', NULL, NULL, NULL, '1965-12-29', '2018-09-27', 'Femenino', 1, 1, 1),
  ('11720981-4', 'Orlando Alberto', 'Herrera', 'Perez', 'ohp1971@gmail.com', '+56998941124', 'Oasis San Pedro 997', NULL, NULL, NULL, '1971-08-17', '2024-09-27', 'Masculino', 1, 1, 1),
  ('11505783-9', 'Liliana Isabel', 'Irribarren', 'Bustamante', 'l.irribarrenbustamante@gmail.com', '+56982484275', 'Latorre 1250', NULL, NULL, NULL, '1970-03-06', '2014-09-19', 'Femenino', 1, 1, 1),
  ('5815011-8', 'Nelly del Carmen', 'Jofre', 'Jopia', 'davicitoo2767@gmail.com', '+56977531649', 'Colo Colo 2767', NULL, NULL, NULL, '1948-09-13', '1998-09-09', 'Femenino', 1, 1, 1),
  ('15768705-0', 'Oscar Alfredo', 'Lemus', 'Suarez', 'oscar.lemus3101@gmail.com', '+56989378262', 'Vasco de Gama 3336', NULL, NULL, NULL, '1974-01-31', '2023-09-09', 'Masculino', 1, 1, 0),
  ('10861370-K', 'Doris del Carmen', 'León', 'Rojas', 'oscar_aramayo@hotmail.com', '+56992291555', 'Avenida Arturo Prat 1887', NULL, NULL, NULL, '1970-02-25', '2021-07-21', 'Femenino', 1, 1, 1),
  ('13216298-0', 'Jorge Luis', 'Montalban', 'Cofre', 'montalbancofre@gmail.com', '+56942684644', 'Joaquin Prieto 1961', NULL, NULL, NULL, '1977-02-21', '2015-09-09', 'Masculino', 1, 1, 1),
  ('16259710-8', 'Alexis', 'Morales', 'Olivares', 'alexis.magali.33@gmail.com', '+56979630227', 'Quetena Oriente 3065', NULL, NULL, NULL, '1986-05-04', '2025-09-26', 'Masculino', 1, 0, 0),
  ('9057451-5', 'Ana Marina', 'Moro', 'Alvarez', 'anamoro1961@yahoo.es', '+56973864428', 'Chuquin 979 Villa Los Yacimientos', NULL, NULL, NULL, '1961-09-11', '2014-09-09', 'Femenino', 1, 1, 1),
  ('18655114-1', 'Camila Victoria', 'Muñoz', 'Becerra', 'cami.mb1256@gmail.com', '+56969025095', 'La Cascada 1256 Villa Ascotan', NULL, NULL, NULL, '1994-11-01', '2015-09-09', 'Femenino', 1, 1, 1),
  ('10068071-8', 'Wilson Leonel', 'Muñoz', 'Contreras', 'wilsonlmc65@gmail.com', '+56968374002', 'Topater 2243', NULL, NULL, NULL, '1965-02-03', '2015-09-09', 'Masculino', 1, 0, 0),
  ('14486524-3', 'Juan Carlos', 'Ogalde', 'Valdivia', 'pedrodono@hotmail.com', '+56944040219', 'Psj Chile 2467', NULL, NULL, NULL, '1976-11-25', '2018-08-01', 'Femenino', 1, 1, 1),
  ('13632490-K', 'Alexis Nicolas', 'Panire', 'Rodriguez', 'alexiapanire@hotmail.com', '+56990752369', 'Pueblo Ayquina', NULL, NULL, NULL, '1977-09-10', '2023-09-28', 'Masculino', 1, 1, 1),
  ('15016244-0', 'Daniel Rodrigo', 'Peña', 'Vera', 'apenalemos@gmail.com', '+56950000052', 'Huatiquina 1121', NULL, NULL, NULL, '1983-04-12', '2024-09-27', 'Masculino', 1, 0, 0),
  ('14575946-3', 'Mario Guillermo', 'Perez', 'Avila', 'marioperez1980@hotmail.com', '+56965891593', 'Psje Tiltil Norte 1129', NULL, NULL, NULL, '1980-09-08', '2017-06-01', 'Masculino', 1, 1, 0),
  ('8135760-9', 'Janette del Rosario', 'Pizarro', 'Narea', 'creaciones.calama@gmail.com', '+56934090872', 'Riquelme 3674', NULL, NULL, NULL, '1959-10-31', '2017-10-13', 'Femenino', 1, 1, 1),
  ('17656503-9', 'José Eduardo', 'Pulgar', 'Marin', 'pulgarjose91@gmail.com', '+56982824473', 'Jhon Bradford 1879', NULL, NULL, NULL, '1991-02-26', '2023-09-28', 'Masculino', 1, 1, 1),
  ('15904794-6', 'Rodrigo David', 'Quintullanca', 'Vera', 'roquintullanca@gmail.com', '+56993031883', 'Hector Enriquez 9760 Antof', NULL, NULL, NULL, '1985-04-24', '2025-10-13', 'Masculino', 1, 0, 0),
  ('7173905-8', 'Rene Arnoldo', 'Robles', 'Araya', 'r.robles.a@hotmail.com', '+56974785778', 'Paso de Jama 4528 km', NULL, NULL, NULL, '1954-06-27', '2004-09-09', 'Masculino', 1, 1, 1),
  ('12093244-6', 'Fabiola Noemí', 'Robles', 'Bugueño', 'fabinoemi.72@gmail.com', '+56984071297', 'Hernan Cortes 3055', NULL, NULL, NULL, '1972-06-24', '2015-09-09', 'Femenino', 1, 1, 1),
  ('4681364-2', 'Ernesto', 'Valdivia', 'Coronel', 'jvaldiviasalva@gmail.com', '+56989130352', 'Andres Bello 3297 Pobl Prat', NULL, NULL, 'Lucifer Niño', '1943-11-07', '2015-09-09', 'Masculino', 1, 1, 1),
  ('11507727-9', 'Wilma', 'Valdivia', 'Gonzalez', 'wmaribelvaldivia@gmail.com', '+56933839299', 'Inca de oro 4139 villa los yacimientos', NULL, NULL, NULL, '1970-06-16', '2016-09-09', 'Femenino', 1, 1, 1),
  ('15017334-5', 'Jocelyn Carolina', 'Valdivia', 'Salva', 'jvaldiviasalva@gmail.com', '+56989130352', 'Costa Rica 2893 Casa 1', NULL, NULL, NULL, '1982-06-10', '2013-09-09', 'Femenino', 1, 1, 1),
  ('11720563-0', 'Sandra Fernanda', 'Vargas', 'Cortes', 'ch.ann.y@hotmail.com', '+56984079327', 'Bañados Espinoza 2269', NULL, NULL, NULL, '1971-05-27', '2021-07-21', 'Femenino', 1, 1, 1),
  ('17734849-K', 'Vanessa', 'Vargas', 'Cortes', 'vargascortes.carolina@gmail.com', '+56978002940', 'Valdivia 979', NULL, NULL, NULL, '1990-10-03', '2019-09-27', 'Femenino', 1, 0, 0),
  ('6330132-9', 'Maximiliana Erika', 'Zuleta', 'Mondaca', NULL, '+56963605736', 'Canada 2334', NULL, NULL, NULL, '1953-07-03', '2019-09-27', 'Femenino', 1, 1, 1),
  ('18972072-6', 'Andres Elias', 'Lobera', 'Mogro', 'andres_lobera9518@hotmail.cl', '+56979638207', 'Av Grecia 1712', NULL, NULL, NULL, '1995-09-06', '2011-09-09', 'Masculino', 1, 1, 1),
  ('24271958-1', 'Mariam Yamai', 'Ramos', 'Vilte', 'jacquelinesairepanire@gmail.com', '+56938818309', 'El Sol 3433', 'Sandra Panire', '12348023-6', 'Falta confirmar bloques', '2013-05-03', '2025-09-26', 'Femenino', 1, 1, 0);

-- Resolver persona_id: por RUT, y por nombre completo para quien no tiene RUT
UPDATE carga_integrantes_20261002 c
JOIN personas p ON UPPER(p.rut) = UPPER(c.rut)
SET c.persona_id = p.id
WHERE c.rut IS NOT NULL;

UPDATE carga_integrantes_20261002 c
JOIN personas p
  ON p.rut IS NULL
 AND p.nombres = c.nombres
 AND p.apellido_paterno = c.apellido_paterno
 AND p.apellido_materno = c.apellido_materno
SET c.persona_id = p.id
WHERE c.rut IS NULL;

-- Verificación: debe dar 422 cargadas y 0 sin_persona
SELECT COUNT(*) AS cargadas, SUM(persona_id IS NULL) AS sin_persona
FROM carga_integrantes_20261002;

-- Si sin_persona > 0, revisar quiénes son antes de seguir:
SELECT * FROM carga_integrantes_20261002 WHERE persona_id IS NULL;


-- ---------------------------------------------------------------------
-- PASO 3 — Vista previa: cada campo que se va a completar
-- ---------------------------------------------------------------------
-- 3a. Resumen por campo
SELECT campo, COUNT(*) AS cambios FROM (
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'email' AS campo, CAST(p.email AS CHAR) AS valor_actual, CAST(c.email AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.email), '') IS NULL AND c.email IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'telefono' AS campo, CAST(p.telefono AS CHAR) AS valor_actual, CAST(c.telefono AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.telefono), '') IS NULL AND c.telefono IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'direccion' AS campo, CAST(p.direccion AS CHAR) AS valor_actual, CAST(c.direccion AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.direccion), '') IS NULL AND c.direccion IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'nombre_apoderado' AS campo, CAST(p.nombre_apoderado AS CHAR) AS valor_actual, CAST(c.nombre_apoderado AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.nombre_apoderado), '') IS NULL AND c.nombre_apoderado IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'rut_apoderado' AS campo, CAST(p.rut_apoderado AS CHAR) AS valor_actual, CAST(c.rut_apoderado AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.rut_apoderado), '') IS NULL AND c.rut_apoderado IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'observacion' AS campo, CAST(p.observacion AS CHAR) AS valor_actual, CAST(c.observacion AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.observacion), '') IS NULL AND c.observacion IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'fecha_nacimiento' AS campo, CAST(p.fecha_nacimiento AS CHAR) AS valor_actual, CAST(c.fecha_nacimiento AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.fecha_nacimiento IS NULL AND c.fecha_nacimiento IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'fecha_ingreso' AS campo, CAST(p.fecha_ingreso AS CHAR) AS valor_actual, CAST(c.fecha_ingreso AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.fecha_ingreso IS NULL AND c.fecha_ingreso IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'sexo' AS campo, CAST(p.sexo AS CHAR) AS valor_actual, CAST(c.sexo AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.sexo IS NULL AND c.sexo IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'bautizo', CAST(p.bautizo AS CHAR), CAST(c.bautizo AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.bautizo = 0 AND c.bautizo = 1
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'comunion', CAST(p.comunion AS CHAR), CAST(c.comunion AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.comunion = 0 AND c.comunion = 1
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'confirmacion', CAST(p.confirmacion AS CHAR), CAST(c.confirmacion AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.confirmacion = 0 AND c.confirmacion = 1
) x GROUP BY campo ORDER BY campo;

-- 3b. Detalle (antes / después)
SELECT * FROM (
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'email' AS campo, CAST(p.email AS CHAR) AS valor_actual, CAST(c.email AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.email), '') IS NULL AND c.email IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'telefono' AS campo, CAST(p.telefono AS CHAR) AS valor_actual, CAST(c.telefono AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.telefono), '') IS NULL AND c.telefono IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'direccion' AS campo, CAST(p.direccion AS CHAR) AS valor_actual, CAST(c.direccion AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.direccion), '') IS NULL AND c.direccion IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'nombre_apoderado' AS campo, CAST(p.nombre_apoderado AS CHAR) AS valor_actual, CAST(c.nombre_apoderado AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.nombre_apoderado), '') IS NULL AND c.nombre_apoderado IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'rut_apoderado' AS campo, CAST(p.rut_apoderado AS CHAR) AS valor_actual, CAST(c.rut_apoderado AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.rut_apoderado), '') IS NULL AND c.rut_apoderado IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'observacion' AS campo, CAST(p.observacion AS CHAR) AS valor_actual, CAST(c.observacion AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE NULLIF(TRIM(p.observacion), '') IS NULL AND c.observacion IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'fecha_nacimiento' AS campo, CAST(p.fecha_nacimiento AS CHAR) AS valor_actual, CAST(c.fecha_nacimiento AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.fecha_nacimiento IS NULL AND c.fecha_nacimiento IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'fecha_ingreso' AS campo, CAST(p.fecha_ingreso AS CHAR) AS valor_actual, CAST(c.fecha_ingreso AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.fecha_ingreso IS NULL AND c.fecha_ingreso IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'sexo' AS campo, CAST(p.sexo AS CHAR) AS valor_actual, CAST(c.sexo AS CHAR) AS valor_nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.sexo IS NULL AND c.sexo IS NOT NULL
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'bautizo', CAST(p.bautizo AS CHAR), CAST(c.bautizo AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.bautizo = 0 AND c.bautizo = 1
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'comunion', CAST(p.comunion AS CHAR), CAST(c.comunion AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.comunion = 0 AND c.comunion = 1
UNION ALL
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, 'confirmacion', CAST(p.confirmacion AS CHAR), CAST(c.confirmacion AS CHAR)
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE p.confirmacion = 0 AND c.confirmacion = 1
) x ORDER BY apellido_paterno, nombres, campo;


-- ---------------------------------------------------------------------
-- PASO 4 — Completar campos vacíos
-- ---------------------------------------------------------------------
START TRANSACTION;

UPDATE personas p
JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
SET
  p.email            = IF(NULLIF(TRIM(p.email), '') IS NULL AND c.email IS NOT NULL, c.email, p.email),
  p.telefono         = IF(NULLIF(TRIM(p.telefono), '') IS NULL AND c.telefono IS NOT NULL, c.telefono, p.telefono),
  p.direccion        = IF(NULLIF(TRIM(p.direccion), '') IS NULL AND c.direccion IS NOT NULL, c.direccion, p.direccion),
  p.nombre_apoderado = IF(NULLIF(TRIM(p.nombre_apoderado), '') IS NULL AND c.nombre_apoderado IS NOT NULL, c.nombre_apoderado, p.nombre_apoderado),
  p.rut_apoderado    = IF(NULLIF(TRIM(p.rut_apoderado), '') IS NULL AND c.rut_apoderado IS NOT NULL, c.rut_apoderado, p.rut_apoderado),
  p.observacion      = IF(NULLIF(TRIM(p.observacion), '') IS NULL AND c.observacion IS NOT NULL, c.observacion, p.observacion),
  p.fecha_nacimiento = IF(p.fecha_nacimiento IS NULL AND c.fecha_nacimiento IS NOT NULL, c.fecha_nacimiento, p.fecha_nacimiento),
  p.fecha_ingreso    = IF(p.fecha_ingreso IS NULL AND c.fecha_ingreso IS NOT NULL, c.fecha_ingreso, p.fecha_ingreso),
  p.sexo             = IF(p.sexo IS NULL AND c.sexo IS NOT NULL, c.sexo, p.sexo),
  p.bautizo          = GREATEST(p.bautizo, c.bautizo),
  p.comunion         = GREATEST(p.comunion, c.comunion),
  p.confirmacion     = GREATEST(p.confirmacion, c.confirmacion);

-- Revisar "filas afectadas" y luego:
COMMIT;
-- (o ROLLBACK; si algo no cuadra)


-- ---------------------------------------------------------------------
-- PASO 4b — Corregir comillas duplicadas (carga anterior) y O'Higgins mal escrito
-- (la palabra correcta es O'Higgins). Cada UPDATE exige el valor erróneo
-- actual, así que si ya fue corregido a mano no hace nada.
-- ---------------------------------------------------------------------
SELECT id, rut, nombres, apellido_paterno, direccion
FROM personas
WHERE direccion LIKE '%''''%' OR direccion LIKE '%higgins%' OR apellido_paterno LIKE '%''''%'
   OR apellido_materno LIKE '%''''%' OR nombres LIKE '%''''%';

START TRANSACTION;

-- 27068946-9 Yulietha Karoline Aynara Molina
UPDATE personas SET direccion = 'Pasaje Ahumada 1614, Población O''Higgins'
WHERE rut = '27068946-9' AND direccion = 'Pasaje Ahumada 1614, Población Ohiggins';

-- 26389857-5 Valentina Sophia O''rian
UPDATE personas SET apellido_paterno = 'O''rian'
WHERE rut = '26389857-5' AND apellido_paterno = 'O''''rian';

-- 7837094-7 Mario Eduardo Velasquez
UPDATE personas SET direccion = 'AV B O''Higgins 726'
WHERE rut = '7837094-7' AND direccion = 'AV B O''''Higgins 726';

-- 21456731-8 Estephania Alejandra Zamora
UPDATE personas SET direccion = 'Avda.O''Higgins 857'
WHERE rut = '21456731-8' AND direccion = 'Avda.Ohiggins 857';

-- 24504416-K Isabella Cataleya Aguilera
UPDATE personas SET direccion = 'O''Higgins 2977'
WHERE rut = '24504416-K' AND direccion = 'O''''higgins 2977';

-- 22723843-7 Maximiliano Jesus Aguilera
UPDATE personas SET direccion = 'O''Higgins 2977'
WHERE rut = '22723843-7' AND direccion = 'O''''higgins 2977';

-- 16259337-4 Carlos Humberto Aguilera
UPDATE personas SET direccion = 'O''Higgins 2977'
WHERE rut = '16259337-4' AND direccion = 'O''''higgins 2977';

-- 17392818-1 Priscila Pamela Robles
UPDATE personas SET direccion = 'O''Higgins 2977'
WHERE rut = '17392818-1' AND direccion = 'O''''higgins 2977';

-- 23420525-0 Andy Alejandro de Jesús Argandoña
UPDATE personas SET direccion = 'Pasaje Ahumada 1614, Población O''Higgins'
WHERE rut = '23420525-0' AND direccion = 'Pasaje Ahumada 1614, Población Ohiggins';

-- Deben ser 9 filas afectadas en total; luego:
COMMIT;


-- ---------------------------------------------------------------------
-- PASO 5 — OPCIONAL: reemplazar teléfonos mal formateados del sistema por
-- el celular válido de la planilla (8 casos). Solo toca filas cuyo
-- teléfono actual NO está en formato +569XXXXXXXX:
--   21926967-6 Sofia Veronica Gonzalez Graz | sistema «981384891 - 55292581» -> «+56981384891»
--   24277809-K Mateo Nicolás Arancibia Cortes | sistema «967979074 - 55234706» -> «+56967979074»
--   23407800-3 Martin Amaro Quintullanca Riaño | sistema «93031883» -> «+56993031883»
--   14455768-9 Marcela Elena Corante Ramirez | sistema «9984374633» -> «+56984374633»
--   11506625-0 Juan Enrique Gomez Morales | sistema «552312218 - 99570520» -> «+56995705204»
--   14575946-3 Mario Guillermo Perez Avila | sistema «965891593 - 55233141» -> «+56965891593»
--   15904794-6 Rodrigo David Quintullanca Vera | sistema «93031883» -> «+56993031883»
--   11507727-9 Wilma Valdivia Gonzalez | sistema «33839299» -> «+56933839299»
-- ---------------------------------------------------------------------
SELECT p.id, p.rut, p.nombres, p.apellido_paterno, p.telefono AS actual, c.telefono AS nuevo
FROM personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
WHERE c.telefono IS NOT NULL
  AND NULLIF(TRIM(p.telefono), '') IS NOT NULL
  AND p.telefono NOT REGEXP '^\\+569[0-9]{8}$'
  AND p.telefono <> c.telefono;

-- START TRANSACTION;
-- UPDATE personas p JOIN carga_integrantes_20261002 c ON c.persona_id = p.id
-- SET p.telefono = c.telefono
-- WHERE c.telefono IS NOT NULL
--   AND NULLIF(TRIM(p.telefono), '') IS NOT NULL
--   AND p.telefono NOT REGEXP '^\\+569[0-9]{8}$'
--   AND p.telefono <> c.telefono;
-- COMMIT;


-- ---------------------------------------------------------------------
-- PASO 6 — Verificación posterior: integrantes vigentes con campos vacíos
-- ---------------------------------------------------------------------
SELECT
  COUNT(*)                                  AS vigentes,
  SUM(NULLIF(TRIM(email), '') IS NULL)      AS sin_email,
  SUM(NULLIF(TRIM(telefono), '') IS NULL)   AS sin_telefono,
  SUM(NULLIF(TRIM(direccion), '') IS NULL)  AS sin_direccion,
  SUM(fecha_nacimiento IS NULL)             AS sin_fecha_nacimiento,
  SUM(fecha_ingreso IS NULL)                AS sin_fecha_ingreso,
  SUM(sexo IS NULL)                         AS sin_sexo,
  SUM(bautizo = 1)                          AS con_bautizo,
  SUM(comunion = 1)                         AS con_comunion,
  SUM(confirmacion = 1)                     AS con_confirmacion
FROM personas
WHERE estado <> 'inactivo';


-- ---------------------------------------------------------------------
-- PASO 7 — REVERSA (solo si hay que deshacer los PASOS 4, 4b y 5)
-- ---------------------------------------------------------------------
-- START TRANSACTION;
-- UPDATE personas p
-- JOIN respaldo_completar_20261002_personas r ON r.id = p.id
-- SET
--   p.apellido_paterno = r.apellido_paterno,
--   p.email = r.email,
--   p.telefono = r.telefono,
--   p.direccion = r.direccion,
--   p.nombre_apoderado = r.nombre_apoderado,
--   p.rut_apoderado = r.rut_apoderado,
--   p.observacion = r.observacion,
--   p.fecha_nacimiento = r.fecha_nacimiento,
--   p.fecha_ingreso = r.fecha_ingreso,
--   p.sexo = r.sexo,
--   p.bautizo = r.bautizo,
--   p.comunion = r.comunion,
--   p.confirmacion = r.confirmacion;
-- COMMIT;


-- ---------------------------------------------------------------------
-- PASO 8 — Limpieza (cuando todo esté validado, días después)
-- ---------------------------------------------------------------------
-- DROP TABLE carga_integrantes_20261002;
-- DROP TABLE respaldo_completar_20261002_personas;


-- =====================================================================
-- ANEXO A — Valores de la planilla NO cargados por inválidos (16).
-- Corregir en el panel o pedirlos a la directiva.
--   25131204-4 Matias Felipe Vasquez Tapia | telefono: «94893977»
--   23457709-3 Naomi Amaral Cortes Verdejo | rut_apoderado: «18816418-2»
--   10374609-4 Winnie Johanna Fernandez Moro | fecha_ingreso: «,»
--   24584394-1 Florencia Laura Pasten Olivares | telefono: «552362905»
--   24504416-K Isabella Cataleya Aguilera Robles | email: «isabellacataleya14gmail.com»
--   21994905-7 Constanza Trinidad Belen Chocobar Toledo | rut_apoderado: «17133963-k»
--   24042967-5 Amy Sabrina Peña Lemos | rut_apoderado: «15016266-0»
--   22644907-8 Nayarett Asiara Escarlett Rojas Quililongo | telefono: «50990681»
--   23540955-0 Monserrat Pascal Tapia Ardiles | rut_apoderado: «115063709-0»
--   22777012-0 Daniel Ignacio Baltra Cardenas | rut_apoderado: «10701152-6»
--   22715529-9 Joaquin Santiago Cruz Colamar | rut_apoderado: «10998982-2»
--   20099054-4 Alejandro Antonio Taipe Gajardo | fecha_ingreso: «Sin Informacion»
--   11566248-1 Patricio Caro Vera | telefono: «8516 6099»
--   5119576-0 Manuel Santander | email: «No lo envio»
--   6330132-9 Maximiliana Erika Zuleta Mondaca | email: «No lo envio»
--   4317643-9 Adriana Del Carmen Montejo Chacc | telefono: «553205888»
--
-- ANEXO B — El sistema ya tiene un valor distinto (2). NO se tocan;
-- revisar con la directiva cuál es el correcto.
--   18482182-6 Jose Miguel Carvajal Sotomayor | confirmacion: sistema «Sí» / planilla «No»
--   13357196-5 Cristian Hugo Donoso Pinto | telefono: sistema «+56977381491» / planilla «+56997738491»
--
-- ANEXO C — Estado distinto entre sistema (oct) y planilla (jun) (4).
-- NO se toca: el sistema es más reciente.
--   13529059-9 Yelisse Carolina Alvarez Bolados | sistema receso / planilla Activo
--   20525812-4 Sebastian Andres Henriquez Paredes | sistema inactivo / planilla Retiro
--   15768705-0 Oscar Alfredo Lemus Suarez | sistema receso / planilla Activo
--   14108825-4 Carla Macarena De La Fuente Estay | sistema activo / planilla Honorario
--
-- ANEXO D — 63 integrantes del sistema no están en la planilla de junio
-- (altas posteriores, socios y honorarios). No reciben cambios.
-- =====================================================================
