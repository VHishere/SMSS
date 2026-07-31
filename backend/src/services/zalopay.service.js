const crypto = require("crypto");

const { zalopay } = require("../config/payment.config");

const REQUEST_TIMEOUT_MS = 15_000;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

function hmacSha256(data, key) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

function getVietnamDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function generateAppTransId() {
  const { year, month, day } = getVietnamDateParts();
  const yy = String(year).slice(-2);
  const timestampPart = String(Date.now()).slice(-8);
  const randomPart = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  return `${yy}${month}${day}_${timestampPart}${randomPart}`;
}

function normalizeAmount(amount) {
  const normalized = Math.round(Number(amount));
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    const error = new Error("Số tiền ZaloPay không hợp lệ");
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function buildOrder({
  appTransId = generateAppTransId(),
  amount,
  description,
  feeAssignmentId,
  userId,
}) {
  const item = "[]";
  const embedData = JSON.stringify({ feeAssignmentId });

  const order = {
    app_id: zalopay.appId,
    app_user: `parent_${userId}`,
    app_trans_id: appTransId,
    app_time: Date.now(),
    amount: normalizeAmount(amount),
    item,
    embed_data: embedData,
    description: description || `Thanh toan hoc phi #${feeAssignmentId}`,
    callback_url: zalopay.callbackUrl,
  };

  const macInput = [
    order.app_id,
    order.app_trans_id,
    order.app_user,
    order.amount,
    order.app_time,
    order.embed_data,
    order.item,
  ].join("|");

  return {
    ...order,
    mac: hmacSha256(macInput, zalopay.key1),
  };
}

async function postForm(url, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(
        Object.fromEntries(
          Object.entries(payload).map(([key, value]) => [key, String(value)]),
        ),
      ).toString(),
      signal: controller.signal,
    });

    const text = await response.text();
    let result;

    try {
      result = JSON.parse(text);
    } catch (_error) {
      const error = new Error("ZaloPay trả về dữ liệu không hợp lệ");
      error.statusCode = 502;
      error.details = text.slice(0, 500);
      throw error;
    }

    if (!response.ok) {
      const error = new Error(result.return_message || `ZaloPay HTTP ${response.status}`);
      error.statusCode = 502;
      error.details = result;
      throw error;
    }

    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("Kết nối ZaloPay quá thời gian chờ");
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function submitOrder(order) {
  return postForm(`${zalopay.endpoint}/create`, order);
}

async function createOrder(input) {
  const order = buildOrder(input);
  const result = await submitOrder(order);
  return {
    appTransId: order.app_trans_id,
    amount: order.amount,
    order,
    result,
  };
}

function verifyCallbackMac(dataStr, receivedMac) {
  if (typeof dataStr !== "string" || typeof receivedMac !== "string") {
    return false;
  }

  const expectedMac = hmacSha256(dataStr, zalopay.key2);
  const expectedBuffer = Buffer.from(expectedMac, "utf8");
  const receivedBuffer = Buffer.from(receivedMac, "utf8");

  return expectedBuffer.length === receivedBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function isExpectedAppId(appId) {
  return String(appId) === String(zalopay.appId);
}

async function queryOrder(appTransId) {
  const macInput = [zalopay.appId, appTransId, zalopay.key1].join("|");
  const mac = hmacSha256(macInput, zalopay.key1);

  return postForm(`${zalopay.endpoint}/query`, {
    app_id: zalopay.appId,
    app_trans_id: appTransId,
    mac,
  });
}

module.exports = {
  generateAppTransId,
  buildOrder,
  submitOrder,
  createOrder,
  verifyCallbackMac,
  isExpectedAppId,
  queryOrder,
};
