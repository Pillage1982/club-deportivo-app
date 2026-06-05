require('dotenv').config();

const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
});

connection.connect((err) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
    return;
  }

  console.log('Conexion MySQL correcta');
});

connection.on('error', (err) => {
  console.error('Error MySQL:', err.message);
});

module.exports = connection;