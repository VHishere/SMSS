const paymentModel = require("../models/payment.model");
const zalopayService = require("../services/zalopay.service");

function handleError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);

  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  return res.status(500).json({ success: false, message: fallbackMessage });
}

function notFound(res, message = "Không tìm thấy khoản phí hoặc bạn không có quyền xem") {
  return res.status(404).json({ success: false, message });
}

const PAYABLE_PLAN_STATUSES = new Set(["PUBLISHED", "LOCKED"]);
const ZALOPAY_ORDER_TTL_MS = 15 * 60 * 1000;

function assertPositiveIntegerId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
  return id;
}

function assertPayable(assignment) {
  if (!PAYABLE_PLAN_STATUSES.has(assignment.planStatus)) {
    const error = new Error("Khoản phí này đã bị hủy hoặc chưa công bố, không thể thanh toán");
    error.statusCode = 409;
    throw error;
  }
  if (assignment.remainingAmount <= 0) {
    const error = new Error("Khoản phí này đã được thanh toán đủ");
    error.statusCode = 409;
    throw error;
  }
}

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
    const feeAssignmentId = assertPositiveIntegerId(
      req.params.feeAssignmentId,
      "Mã khoản phí không hợp lệ",
    );
    const assignment = await paymentModel.findFeeAssignmentForParent(
      req.user.userId,
      feeAssignmentId,
    );

    if (!assignment) return notFound(res);

    const payments = await paymentModel.listPaymentsForAssignment(feeAssignmentId);
    return res.json({ success: true, data: { ...assignment, payments } });
  } catch (error) {
    return handleError(res, error, "Không thể tải chi tiết khoản phí");
  }
}

async function createZaloPayOrder(req, res) {
  let appTransId = null;

  try {
    const feeAssignmentId = assertPositiveIntegerId(
      req.params.feeAssignmentId,
      "Mã khoản phí không hợp lệ",
    );
    const assignment = await paymentModel.findFeeAssignmentForParent(
      req.user.userId,
      feeAssignmentId,
    );

    if (!assignment) return notFound(res);
    assertPayable(assignment);

    const reusable = await paymentModel.findReusablePendingTransaction(feeAssignmentId);
    if (reusable && reusable.amount === assignment.remainingAmount) {
      return res.json({
        success: true,
        data: {
          appTransId: reusable.appTransId,
          amount: reusable.amount,
          orderUrl: reusable.orderUrl,
          qrCode: reusable.qrCode,
          reused: true,
        },
      });
    }

    appTransId = zalopayService.generateAppTransId();
    const order = zalopayService.buildOrder({
      appTransId,
      amount: assignment.remainingAmount,
      description: `Thanh toan hoc phi ${assignment.title} - ${assignment.studentCode}`,
      feeAssignmentId,
      userId: req.user.userId,
    });

    await paymentModel.createPaymentTransaction({
      feeAssignmentId,
      provider: "ZALOPAY",
      appTransId,
      amount: order.amount,
      rawRequest: order,
      expiredAt: new Date(Date.now() + ZALOPAY_ORDER_TTL_MS),
      createdBy: req.user.userId,
    });

    const result = await zalopayService.submitOrder(order);

    if (Number(result.return_code) !== 1) {
      await paymentModel.markPaymentTransactionStatus(appTransId, {
        status: "FAILED",
        rawResponse: result,
        errorCode: result.sub_return_code || result.return_code,
        errorMessage: result.sub_return_message || result.return_message,
      });

      return res.status(502).json({
        success: false,
        message: result.sub_return_message
          || result.return_message
          || "Không thể khởi tạo đơn thanh toán ZaloPay",
      });
    }

    await paymentModel.updatePaymentTransactionOrder(appTransId, {
      orderUrl: result.order_url,
      qrCode: result.qr_code,
      rawResponse: result,
    });

    return res.status(201).json({
      success: true,
      data: {
        appTransId,
        amount: order.amount,
        orderUrl: result.order_url,
        qrCode: result.qr_code,
        reused: false,
      },
    });
  } catch (error) {
    if (appTransId) {
      try {
        // Callback có thể đến trước khi request tạo đơn nhận được response.
        // Không ghi đè SUCCESS thành FAILED trong trường hợp đó.
        const latestTransaction = await paymentModel.findPaymentTransactionByAppTransId(appTransId);
        if (latestTransaction?.status === "SUCCESS") {
          return res.status(201).json({
            success: true,
            data: {
              appTransId,
              amount: latestTransaction.amount,
              orderUrl: latestTransaction.orderUrl,
              qrCode: latestTransaction.qrCode,
              status: "SUCCESS",
              reused: false,
            },
          });
        }

        await paymentModel.markPaymentTransactionStatus(appTransId, {
          status: "FAILED",
          errorCode: error.code || "ZALOPAY_REQUEST_ERROR",
          errorMessage: error.message,
        });
      } catch (markError) {
        console.error("Không thể cập nhật giao dịch ZaloPay lỗi:", markError);
      }
    }
    return handleError(res, error, "Không thể tạo đơn thanh toán ZaloPay");
  }
}

async function applyConfirmedPayment(transaction, {
  providerTransactionId,
  amount,
  rawResponse,
  note,
  paidAt,
}) {
  return paymentModel.confirmZaloPayPayment({
    appTransId: transaction.appTransId,
    providerTransactionId,
    amount,
    rawResponse,
    note,
    paidAt,
  });
}

async function getZaloPayOrderStatus(req, res) {
  try {
    const feeAssignmentId = assertPositiveIntegerId(
      req.params.feeAssignmentId,
      "Mã khoản phí không hợp lệ",
    );
    const { appTransId } = req.params;

    const assignment = await paymentModel.findFeeAssignmentForParent(
      req.user.userId,
      feeAssignmentId,
    );
    if (!assignment) return notFound(res);

    const transaction = await paymentModel.findPaymentTransactionByAppTransId(appTransId);
    if (!transaction || transaction.feeAssignmentId !== feeAssignmentId) {
      return res.status(404).json({ success: false, message: "Không tìm thấy giao dịch" });
    }

    if (transaction.status !== "PENDING") {
      return res.json({
        success: true,
        data: {
          status: transaction.status,
          amount: transaction.amount,
          errorMessage: transaction.errorMessage || null,
        },
      });
    }

    const result = await zalopayService.queryOrder(appTransId);
    const returnCode = Number(result.return_code);

    if (returnCode === 1) {
      await applyConfirmedPayment(transaction, {
        providerTransactionId: result.zp_trans_id
          ? String(result.zp_trans_id)
          : null,
        amount: result.amount == null ? transaction.amount : Number(result.amount),
        rawResponse: result,
        note: "Thanh toán trực tuyến qua ZaloPay (tra cứu trạng thái)",
      });

      return res.json({
        success: true,
        data: { status: "SUCCESS", amount: transaction.amount },
      });
    }

    if (returnCode === 2) {
      await paymentModel.markPaymentTransactionStatus(appTransId, {
        status: "FAILED",
        rawResponse: result,
        errorCode: result.sub_return_code || result.return_code,
        errorMessage: result.sub_return_message || result.return_message,
      });

      return res.json({
        success: true,
        data: {
          status: "FAILED",
          amount: transaction.amount,
          errorMessage: result.sub_return_message || result.return_message || null,
        },
      });
    }

    return res.json({
      success: true,
      data: { status: "PENDING", amount: transaction.amount },
    });
  } catch (error) {
    return handleError(res, error, "Không thể kiểm tra trạng thái thanh toán");
  }
}

async function zalopayCallback(req, res) {
  try {
    const { data, mac } = req.body || {};

    if (!data || !mac || !zalopayService.verifyCallbackMac(data, mac)) {
      return res.json({ return_code: -1, return_message: "mac not equal" });
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (_error) {
      return res.json({ return_code: 0, return_message: "invalid data" });
    }

    if (!zalopayService.isExpectedAppId(payload.app_id)) {
      return res.json({ return_code: -1, return_message: "app_id not equal" });
    }

    const appTransId = String(payload.app_trans_id || "");
    const transaction = await paymentModel.findPaymentTransactionByAppTransId(appTransId);

    if (!transaction) {
      console.error("ZaloPay callback: unknown app_trans_id", appTransId);
      return res.json({ return_code: 0, return_message: "transaction not found" });
    }

    await applyConfirmedPayment(transaction, {
      providerTransactionId: payload.zp_trans_id
        ? String(payload.zp_trans_id)
        : null,
      amount: payload.amount == null ? transaction.amount : Number(payload.amount),
      rawResponse: payload,
      note: "Thanh toán trực tuyến qua ZaloPay (callback)",
      paidAt: payload.server_time ? new Date(Number(payload.server_time)) : new Date(),
    });

    return res.json({ return_code: 1, return_message: "success" });
  } catch (error) {
    console.error("zalopayCallback error:", error);
    return res.json({ return_code: 0, return_message: "retry" });
  }
}

module.exports = {
  getMyFees,
  getMyFeeDetail,
  createZaloPayOrder,
  getZaloPayOrderStatus,
  zalopayCallback,
};
