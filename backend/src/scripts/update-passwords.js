const { pool, testConnection } = require('../config/db');
const { ensureValidPasswords, DEMO_PASSWORD } = require('../services/password-setup.service');

async function main() {
    try {
        await testConnection();
        await ensureValidPasswords();
        console.log(`Mật khẩu demo: ${DEMO_PASSWORD}`);
    } catch (err) {
        console.error('Lỗi:', err.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

main();
