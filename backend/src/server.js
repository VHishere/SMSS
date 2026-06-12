const app = require('./app');
const { testConnection } = require('./config/db');
const { ensureValidPasswords } = require('./services/password-setup.service');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
    try {
        await testConnection();
        await ensureValidPasswords();

        app.listen(PORT, () => {
            console.log(`KidCare API chạy tại http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Không thể khởi động server:', err.message);
        process.exit(1);
    }
}

start();
