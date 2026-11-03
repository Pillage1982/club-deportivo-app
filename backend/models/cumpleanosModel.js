// Cumpleañeros del día para el saludo por correo. Todo se evalúa en hora de Chile
// porque la conexión MySQL fija el time_zone de Chile (ver config/db.js): CURDATE()
// y YEAR/MONTH/DAY ya son locales.
const db = require('../config/db');

function ejecutar(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) { reject(err); return; }
      resolve(result);
    });
  });
}

// Integrantes activos, con correo, que cumplen años hoy y a quienes aún no se les
// envió el saludo este año. (Un nacido el 29-02 no coincide en años no bisiestos;
// es un caso de borde conocido y no se contempla aquí.)
exports.obtenerCumpleanerosHoy = () =>
  ejecutar(`
    SELECT p.id, p.nombres, p.apellido_paterno, p.email
    FROM personas p
    WHERE p.estado = 'activo'
      AND p.email IS NOT NULL AND p.email <> ''
      AND p.fecha_nacimiento IS NOT NULL
      AND MONTH(p.fecha_nacimiento) = MONTH(CURDATE())
      AND DAY(p.fecha_nacimiento) = DAY(CURDATE())
      AND NOT EXISTS (
        SELECT 1 FROM envios_cumpleanos e
        WHERE e.persona_id = p.id AND e.anio = YEAR(CURDATE())
      )
  `);

// Marca el envío de este año. INSERT IGNORE + UNIQUE(persona_id, anio) evita el
// duplicado aunque el cron se ejecute dos veces el mismo día.
exports.marcarEnviado = personaId =>
  ejecutar(
    'INSERT IGNORE INTO envios_cumpleanos (persona_id, anio) VALUES (?, YEAR(CURDATE()))',
    [personaId]
  );
