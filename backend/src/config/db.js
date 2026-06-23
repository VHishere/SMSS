// const mysql = require('mysql2/promise');
// const { validateEnv } = require('./env');

// validateEnv();

// const pool = mysql.createPool({
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASSWORD,
//     database: process.env.DB_NAME,
//     port: Number(process.env.DB_PORT) || 3306,
//     charset: 'utf8mb4',
//     waitForConnections: true,
//     connectionLimit: 10
// });

// async function testConnection() {
//     const connection = await pool.getConnection();
//     console.log('Kết nối MySQL thành công!');
//     connection.release();
// }

// module.exports = { pool, testConnection };

const mysql = require("mysql2/promise");
const { validateEnv } = require("./env");

validateEnv();

const useSsl =
  process.env.DB_SSL === "true" ||
  process.env.NODE_ENV === "production";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,

  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,

  ssl: useSsl
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

async function testConnection() {
  const connection = await pool.getConnection();
  console.log("Kết nối MySQL thành công!");
  connection.release();
}

module.exports = { pool, testConnection };