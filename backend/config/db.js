// Conexión compartida a MySQL mediante pool; todos los modelos importan este módulo para ejecutar consultas.
require('dotenv').config();

const mysql = require('mysql2');

// Offset horario de Chile (America/Santiago) vigente en este momento, calculado
// con Intl para que se ajuste solo en el cambio de horario de verano/invierno.
// Se usa para fijar la zona horaria de cada sesion MySQL: sin esto, CURRENT_TIMESTAMP
// y NOW() quedan en UTC (default del servidor en Hostinger) y todo lo que dependa
// de esos defaults (fecha_registro, fecha, created_at en varias tablas) se guarda
// desfasado respecto a la hora real de Chile.
function offsetChileActual() {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Santiago',
      timeZoneName: 'longOffset'
    }).formatToParts(new Date());

    const tz = partes.find(p => p.type === 'timeZoneName')?.value || '';
    const match = tz.match(/GMT([+-]\d{2}:\d{2})/);

    return match ? match[1] : '-04:00';
  } catch (err) {
    console.warn('No se pudo calcular el offset horario de Chile, se usa -04:00 por defecto', err);
    return '-04:00';
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// Cada conexion fisica nueva del pool queda fijada en hora de Chile para su sesion.
// Asi CURRENT_TIMESTAMP/NOW() se evaluan en hora local, no en UTC. No requiere que
// el servidor tenga cargadas las tablas de zonas horarias con nombre (offset fijo).
pool.on('connection', connection => {
  connection.query('SET time_zone = ?', [offsetChileActual()], err => {
    if (err) {
      console.warn('No se pudo fijar la zona horaria de la sesion MySQL a Chile', err.message);
    }
  });
});

function query(sql, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = [];
  }

  const run = (attempt = 0) => {
    pool.getConnection((err, connection) => {
      if (err) {
        return callback(err);
      }

      connection.query(sql, params, (queryErr, results, fields) => {
        if (queryErr) {
          const shouldRetry =
            attempt === 0 &&
            (
              queryErr.fatal ||
              queryErr.code === 'ECONNRESET' ||
              queryErr.code === 'PROTOCOL_CONNECTION_LOST' ||
              queryErr.message.includes('closed state')
            );

          connection.destroy();

          if (shouldRetry) {
            return run(1);
          }

          return callback(queryErr);
        }

        connection.release();
        callback(null, results, fields);
      });
    });
  };

  run();
}

pool.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
    return;
  }

  console.log('Conexion MySQL correcta');
  connection.release();
});

module.exports = {
  query,
  getConnection: callback => pool.getConnection(callback)
};
