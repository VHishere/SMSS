const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const INSECURE_JWT_SECRETS = [
    'kidcare-dev-secret-change-in-production',
    'your_jwt_secret_key_here'
];

function validateEnv() {
    const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET'];
    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        console.error(`Thiếu biến môi trường trong file .env: ${missing.join(', ')}`);
        console.error('Hãy copy backend/.env.example thành backend/.env và điền đầy đủ.');
        process.exit(1);
    }

    const jwtSecret = process.env.JWT_SECRET.trim();

    if (INSECURE_JWT_SECRETS.includes(jwtSecret) || jwtSecret.length < 16) {
        console.error('JWT_SECRET không hợp lệ.');
        console.error('Hãy đặt JWT_SECRET trong backend/.env (tối thiểu 16 ký tự, không dùng giá trị mẫu).');
        process.exit(1);
    }
}

module.exports = { validateEnv };
