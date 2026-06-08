require('dotenv').config();

const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
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
  query
};