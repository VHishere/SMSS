const ZALOPAY_SANDBOX_DEFAULTS = {
  appId: "2553",
  key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  endpoint: "https://sb-openapi.zalopay.vn/v2",
};

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

const backendPublicUrl = trimTrailingSlash(
  process.env.BACKEND_PUBLIC_URL || "http://localhost:3000",
);

const zalopay = {
  appId: process.env.ZALOPAY_APP_ID || ZALOPAY_SANDBOX_DEFAULTS.appId,
  key1: process.env.ZALOPAY_KEY1 || ZALOPAY_SANDBOX_DEFAULTS.key1,
  key2: process.env.ZALOPAY_KEY2 || ZALOPAY_SANDBOX_DEFAULTS.key2,
  endpoint: trimTrailingSlash(
    process.env.ZALOPAY_ENDPOINT || ZALOPAY_SANDBOX_DEFAULTS.endpoint,
  ),
  callbackUrl:
    process.env.ZALOPAY_CALLBACK_URL
    || `${backendPublicUrl}/api/payments/zalopay/callback`,
};

module.exports = { zalopay };
