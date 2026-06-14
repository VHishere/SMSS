const { pool } = require('../config/db');

const DEMO_PASSWORD = 'Password@123';
const VALID_BCRYPT_HASH = '$2b$10$.k6cSrLh3duHfDhGg.2jEuIAwDNN0dtplnMu69yL3XD8JJwYvJ6r2';
const DEMO_HASH_PREFIX = '$2y$10$demoHash%';

async function ensureValidPasswords() {
    const [rows] = await pool.query(
        'SELECT COUNT(*) AS invalidCount FROM user_account WHERE password_hash LIKE ?',
        [DEMO_HASH_PREFIX]
    );

    const invalidCount = Number(rows[0]?.invalidCount || 0);

    if (invalidCount === 0) {
        return;
    }

    const [result] = await pool.query(
        'UPDATE user_account SET password_hash = ? WHERE password_hash LIKE ?',
        [VALID_BCRYPT_HASH, DEMO_HASH_PREFIX]
    );

    console.log(`Đã tự động cập nhật mật khẩu cho ${result.affectedRows} tài khoản.`);
    console.log(`Mật khẩu demo: ${DEMO_PASSWORD}`);
}

module.exports = { ensureValidPasswords, VALID_BCRYPT_HASH, DEMO_PASSWORD };
