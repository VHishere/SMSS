const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = Number(process.env.PORT) || 3000;

async function start() {
    try {
        await testConnection();
        app.listen(PORT, () => {
            console.log(`KidCare API chạy tại http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Không thể khởi động server:', err.message);
        process.exit(1);
    }
}

start();
