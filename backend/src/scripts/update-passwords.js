const { pool, testConnection } = require('../config/db');

const DEMO_HASH = '$2b$10$.k6cSrLh3duHfDhGg.2jEuIAwDNN0dtplnMu69yL3XD8JJwYvJ6r2';

async function main() {
    try {
        await testConnection();

        const [result] = await pool.query(
            'UPDATE user_account SET password_hash = ? WHERE user_id BETWEEN 1 AND 12',
            [DEMO_HASH]
        );

        console.log(`Đã cập nhật mật khẩu cho ${result.affectedRows} tài khoản.`);
        console.log('Mật khẩu demo: Password@123');
    } catch (err) {
        console.error('Lỗi:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
