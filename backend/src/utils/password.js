const bcrypt = require("bcryptjs");

const DEMO_PASSWORD = "Password@123";

function normalizeBcryptHash(hash) {
  if (!hash) return hash;
  return hash.replace(/^\$2y\$/, "$2a$");
}

async function verifyPassword(plainPassword, passwordHash) {
  if (!passwordHash) return false;

  if (passwordHash.startsWith("$2")) {
    return bcrypt.compare(
      plainPassword,
      normalizeBcryptHash(passwordHash),
    );
  }

  return plainPassword === passwordHash;
}

function hashPassword(plainPassword = DEMO_PASSWORD) {
  return bcrypt.hashSync(plainPassword, 10);
}

module.exports = {
  DEMO_PASSWORD,
  verifyPassword,
  hashPassword,
};
