const bcrypt = require('bcryptjs');

function normalizeBcryptHash(hash) {
    if (!hash) return hash;
    return hash.replace(/^\$2y\$/, '$2a$');
}

async function verifyPassword(plainPassword, passwordHash) {
    if (!passwordHash) return false;
    return bcrypt.compare(plainPassword, normalizeBcryptHash(passwordHash));
}

module.exports = { verifyPassword };
