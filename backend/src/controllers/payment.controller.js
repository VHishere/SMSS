const paymentModel = require("../models/payment.model");
const staffFeesModel = require("../models/staff/fees");
const vietqrService = require("../services/vietqr.service");
const zalopayService = require("../services/zalopay.service");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || fallbackMessage,
  });
}

function notFound(res, message = "Không tìm thấy khoản phí hoặc bạn không có quyền xem") {
  return res.status(404).json({ success: false, message });
}

const PAYABLE_PLAN_STATUSES = new Set(["PUBLISHED", "LOCKED"]);

// A cancelled (or still-draft) fee plan no longer needs to be paid — block
// online payment creation for it even if the assignment itself still shows
// a remaining balance.
function assertPayable(assignment) {
  if (!PAYABLE_PLAN_STATUSES.has(assignment.planStatus)) {
    const error = new Error("Khoản phí này đã bị hủy hoặc chưa công bố, không cần thanh toán");
    error.statusCode = 409;
    throw error;
  }
  if (assignment.remainingAmount <= 0) {
    const error = new Error("Khoản phí này đã được thanh toán đủ");
    error.statusCode = 409;
    throw error;
  }
}

// ── Parent: read-only fee views ────────────────────────────────────────────

async function getMyFees(req, res) {
  try {
    const data = await paymentModel.listFeeAssignmentsForParent(req.user.userId, {
      studentId: req.query.studentId,
      status: req.query.status,
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error, "Không thể tải danh sách học phí");
  }
}

async function getMyFeeDetail(req, res) {
  try {
    const feeAssignmentId = Number(req.params.feeAssignmentId);
    const assignment = await paymentModel.findFeeAssignmentForParent(req.user.userId, feeAssignmentId);

    if (!assignment) return notFound(res);

    const payments = await paymentModel.listPaymentsForAssignment(feeAssignmentId);

    return res.json({ success: true, data: { ...assignment, payments } });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết khoản phí");
  }
}

// ── VietQR: stateless QR generation (bank transfer, confirmed by staff) ────

async function createVietQrPayment(req, res) {
  try {
    const feeAssignmentId = Number(req.params.feeAssignmentId);
    const assignment = await paymentModel.findFeeAssignmentForParent(req.user.userId, feeAssignmentId);

    if (!assignment) return notFound(res);
    assertPayable(assignment);

    const payment = vietqrService.buildVietQrPayment({
      amount: assignment.remainingAmount,
      feeAssignmentId,
      studentCode: assignment.studentCode,
    });

    return res.json({ success: true, data: payment });
  } catch (error) {
    return handleError(res, error, "Không thể tạo mã VietQR");
  }
}

// ── ZaloPay: online order creation + status polling + webhook callback ────

async function createZaloPayOrder(req, res) {
  try {
    const feeAssignmentId = Number(req.params.feeAssignmentId);
    const assignment = await paymentModel.findFeeAssignmentForParent(req.user.userId, feeAssignmentId);

    if (!assignment) return notFound(res);
    assertPayable(assignment);

    const { appTransId, amount, result } = await zalopayService.createOrder({
      amount: assignment.remainingAmount,
      description: `Thanh toan hoc phi ${assignment.title} - ${assignment.studentCode}`,
      feeAssignmentId,
      userId: req.user.userId,
    });

    if (Number(result.return_code) !== 1) {
      return res.status(502).json({
        success: false,
        message: result.return_message || "Không thể khởi tạo đơn thanh toán ZaloPay",
      });
    }

    await paymentModel.createPaymentTransaction({
      feeAssignmentId,
      provider: "ZALOPAY",
      appTransId,
      amount,
      orderUrl: result.order_url,
      qrCode: result.qr_code,
      rawResponse: result,
      createdBy: req.user.userId,
    });

    return res.status(201).json({
      success: true,
      data: {
        appTransId,
        amount,
        orderUrl: result.order_url,
        qrCode: result.qr_code,
      },
    });
  } catch (error) {
    return handleError(res, error, "Không thể tạo đơn thanh toán ZaloPay");
  }
}

async function applyConfirmedPayment(transaction, { zpTransId, note }) {
  await staffFeesModel.recordFeePayment(
    transaction.feePlanId,
    transaction.feeAssignmentId,
    {
      amount: transaction.amount,
      paymentDate: new Date(),
      paymentMethod: "ZALOPAY",
      transactionCode: zpTransId || transaction.appTransId,
      note: note || "Thanh toán trực tuyến qua ZaloPay",
    },
    null,
  );

  await paymentModel.markPaymentTransactionStatus(transaction.appTransId, {
    status: "SUCCESS",
    zpTransId,
  });
}

async function getZaloPayOrderStatus(req, res) {
  try {
    const feeAssignmentId = Number(req.params.feeAssignmentId);
    const { appTransId } = req.params;

    const assignment = await paymentModel.findFeeAssignmentForParent(req.user.userId, feeAssignmentId);
    if (!assignment) return notFound(res);

    const transaction = await paymentModel.findPaymentTransactionByAppTransId(appTransId);
    if (!transaction || transaction.feeAssignmentId !== feeAssignmentId) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giao dịch" });
    }

    if (transaction.status !== "PENDING") {
      return res.json({ success: true, data: { status: transaction.status, amount: transaction.amount } });
    }

    // Local status is still pending — actively ask ZaloPay in case the
    // server-to-server callback never reached us (common in local/dev setups).
    const result = await zalopayService.queryOrder(appTransId);
    const returnCode = Number(result.return_code);

    if (returnCode === 1) {
      await applyConfirmedPayment(transaction, {
        zpTransId: result.zp_trans_id ? String(result.zp_trans_id) : null,
        note: "Thanh toán trực tuyến qua ZaloPay (tra cứu trạng thái)",
      });
      return res.json({ success: true, data: { status: "SUCCESS", amount: transaction.amount } });
    }

    if (returnCode === 2) {
      await paymentModel.markPaymentTransactionStatus(appTransId, { status: "FAILED", rawResponse: result });
      return res.json({ success: true, data: { status: "FAILED", amount: transaction.amount } });
    }

    return res.json({ success: true, data: { status: "PENDING", amount: transaction.amount } });
  } catch (error) {
    return handleError(res, error, "Không thể kiểm tra trạng thái thanh toán");
  }
}

// Public webhook — ZaloPay calls this server-to-server, no user auth.
async function zalopayCallback(req, res) {
  try {
    const { data, mac } = req.body || {};

    if (!data || !mac || !zalopayService.verifyCallbackMac(data, mac)) {
      return res.json({ return_code: -1, return_message: "mac not equal" });
    }

    const payload = JSON.parse(data);
    const appTransId = payload.app_trans_id;

    const transaction = await paymentModel.findPaymentTransactionByAppTransId(appTransId);

    if (!transaction) {
      console.error("ZaloPay callback: unknown app_trans_id", appTransId);
      return res.json({ return_code: 1, return_message: "success" });
    }

    if (transaction.status === "PENDING") {
      await applyConfirmedPayment(transaction, {
        zpTransId: payload.zp_trans_id ? String(payload.zp_trans_id) : null,
      });
    }

    return res.json({ return_code: 1, return_message: "success" });
  } catch (error) {
    console.error("zalopayCallback error:", error);
    return res.json({ return_code: 0, return_message: "retry" });
  }
}

module.exports = {
  getMyFees,
  getMyFeeDetail,
  createVietQrPayment,
  createZaloPayOrder,
  getZaloPayOrderStatus,
  zalopayCallback,
};
