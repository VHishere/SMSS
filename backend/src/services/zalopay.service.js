const crypto = require("crypto");

const { zalopay } = require("../config/payment.config");

function hmacSha256(data, key) {
  return crypto.createHmac("sha256", key).update(data).digest("hex");
}

function generateAppTransId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `${yy}${mm}${dd}_${rand}`;
}

// Creates a ZaloPay order. Returns the raw response plus the app_trans_id
// used to create it (needed later to query status / correlate callbacks).
async function createOrder({ amount, description, feeAssignmentId, userId }) {
  const appTransId = generateAppTransId();
  const item = "[]";
  const embedData = JSON.stringify({ feeAssignmentId });

  const order = {
    app_id: zalopay.appId,
    app_user: `parent_${userId}`,
    app_trans_id: appTransId,
    app_time: Date.now(),
    amount: Math.round(Number(amount)),
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

  order.mac = hmacSha256(macInput, zalopay.key1);

  const response = await fetch(`${zalopay.endpoint}/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(order).toString(),
  });

  const result = await response.json();
  return { appTransId, amount: order.amount, result };
}

// Verifies the "data"/"mac" pair ZaloPay POSTs to our callback_url using key2.
function verifyCallbackMac(dataStr, receivedMac) {
  const expectedMac = hmacSha256(dataStr, zalopay.key2);
  return expectedMac === receivedMac;
}

// Actively polls order status — used as a fallback for local/dev environments
// where ZaloPay's servers can't reach our callback_url.
async function queryOrder(appTransId) {
  const macInput = [zalopay.appId, appTransId, zalopay.key1].join("|");
  const mac = hmacSha256(macInput, zalopay.key1);

  const response = await fetch(`${zalopay.endpoint}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      app_id: zalopay.appId,
      app_trans_id: appTransId,
      mac,
    }).toString(),
  });

  return response.json();
}

module.exports = {
  generateAppTransId,
  createOrder,
  verifyCallbackMac,
  queryOrder,
};
