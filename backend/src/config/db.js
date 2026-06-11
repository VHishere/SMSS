const path = require('path');
const mysql = require('mysql2/promise');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
    console.error(`Thiếu biến môi trường trong file .env: ${missing.join(', ')}`);
    console.error('Hãy copy backend/.env.example thành backend/.env và điền thông tin MySQL.');
    process.exit(1);
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10
});

async function testConnection() {
    const connection = await pool.getConnection();
    console.log('Kết nối MySQL thành công!');
    connection.release();
}

module.exports = { pool, testConnection };
