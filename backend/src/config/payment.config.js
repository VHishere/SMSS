// ZaloPay's official publicly documented sandbox merchant credentials.
// These are meant for developer testing (no real money moves) — swap in
// real merchant credentials via env vars once the school has a ZaloPay
// merchant account.
const ZALOPAY_SANDBOX_DEFAULTS = {
  appId: "2553",
  key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  endpoint: "https://sb-openapi.zalopay.vn/v2",
};

const backendPublicUrl = process.env.BACKEND_PUBLIC_URL || "http://localhost:3000";

const zalopay = {
  appId: process.env.ZALOPAY_APP_ID || ZALOPAY_SANDBOX_DEFAULTS.appId,
  key1: process.env.ZALOPAY_KEY1 || ZALOPAY_SANDBOX_DEFAULTS.key1,
  key2: process.env.ZALOPAY_KEY2 || ZALOPAY_SANDBOX_DEFAULTS.key2,
  endpoint: process.env.ZALOPAY_ENDPOINT || ZALOPAY_SANDBOX_DEFAULTS.endpoint,
  callbackUrl: process.env.ZALOPAY_CALLBACK_URL || `${backendPublicUrl}/api/payments/zalopay/callback`,
};

// Placeholder VietQR receiving-account info. 970436 is Vietcombank's public
// bank BIN. Replace with the school's real account before going live.
const vietqr = {
  bankBin: process.env.SCHOOL_BANK_BIN || "970436",
  accountNo: process.env.SCHOOL_BANK_ACCOUNT_NO || "0123456789",
  accountName: process.env.SCHOOL_BANK_ACCOUNT_NAME || "TRUONG FPT SCHOOL",
  template: process.env.SCHOOL_BANK_TEMPLATE || "compact2",
};

module.exports = { zalopay, vietqr };
