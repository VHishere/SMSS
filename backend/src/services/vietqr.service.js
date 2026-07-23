const { vietqr } = require("../config/payment.config");

// VietQR's "addInfo" (transfer content) only accepts unaccented alphanumerics.
function sanitizeAddInfo(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function buildVietQrPayment({ amount, feeAssignmentId, studentCode }) {
  const amountValue = Math.max(0, Math.round(Number(amount) || 0));
  const addInfo = sanitizeAddInfo(`HOCPHI ${studentCode || ""} ${feeAssignmentId}`);

  const qrImageUrl =
    `https://img.vietqr.io/image/${vietqr.bankBin}-${vietqr.accountNo}-${vietqr.template}.png` +
    `?amount=${amountValue}&addInfo=${encodeURIComponent(addInfo)}&accountName=${encodeURIComponent(vietqr.accountName)}`;

  return {
    bankBin: vietqr.bankBin,
    accountNo: vietqr.accountNo,
    accountName: vietqr.accountName,
    amount: amountValue,
    addInfo,
    qrImageUrl,
  };
}

module.exports = { buildVietQrPayment };
