require('dotenv').config();

console.log(
  'DB_USER usado:',
  process.env.DB_USER
);

const mysql = require('mysql2');

const connection = mysql.createConnection({

  host: process.env.DB_HOST,

  user: process.env.DB_USER,

  password: process.env.DB_PASSWORD,

  database: process.env.DB_NAME,

  charset: 'utf8mb4'

});

module.exports = connection;