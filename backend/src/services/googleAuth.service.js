const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function verifyGoogleCredential(credential) {
  if (!credential) {
    const error = new Error("Thiếu Google credential");
    error.statusCode = 400;
    throw error;
  }

  if (!process.env.GOOGLE_CLIENT_ID) {
    const error = new Error("Backend chưa cấu hình GOOGLE_CLIENT_ID");
    error.statusCode = 500;
    throw error;
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload?.email) {
    const error = new Error("Không lấy được email từ Google");
    error.statusCode = 401;
    throw error;
  }

  if (!payload.email_verified) {
    const error = new Error("Email Google chưa được xác minh");
    error.statusCode = 401;
    throw error;
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    fullName: payload.name,
    avatar: payload.picture,
  };
}

module.exports = {
  verifyGoogleCredential,
};