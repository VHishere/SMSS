const { pool } = require("../config/db");

const EFFECTIVE_STATUS_SQL = `
  CASE
    WHEN fa.status IN ('UNPAID', 'PARTIAL') AND fp.due_date < DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)
      THEN 'OVERDUE'
    ELSE fa.status
  END
`;

const FILTERABLE_STATUSES = new Set([
  "UNPAID",
  "PARTIAL",
  "PAID",
  "WAIVED",
  "OVERDUE",
]);

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizePaymentDate(value) {
  if (!value) return new Date();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeAssignmentRow(row) {
  const finalAmount = toNumber(row.finalAmount);
  const paidAmount = toNumber(row.paidAmount);

  return {
    ...row,
    amount: toNumber(row.amount),
    discountAmount: toNumber(row.discountAmount),
    finalAmount,
    paidAmount,
    remainingAmount: Math.max(finalAmount - paidAmount, 0),
  };
}

async function listFeeAssignmentsForParent(userId, filters = {}) {
  const conditions = [
    "ua.user_id = ?",
    "ua.status = 'ACTIVE'",
    "s.status = 'ACTIVE'",
    "fp.status <> 'DRAFT'",
  ];
  const params = [userId];

  if (filters.studentId) {
    conditions.push("s.student_id = ?");
    params.push(filters.studentId);
  }

  if (filters.status) {
    const status = String(filters.status).toUpperCase();
    if (!FILTERABLE_STATUSES.has(status)) {
      throw createHttpError("Trạng thái học phí không hợp lệ", 400);
    }
    conditions.push(`${EFFECTIVE_STATUS_SQL} = ?`);
    params.push(status);
  }

  const [rows] = await pool.query(
    `
      SELECT DISTINCT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.fee_plan_id AS feePlanId,
        fa.amount,
        fa.discount_amount AS discountAmount,
        fa.final_amount AS finalAmount,
        fa.paid_amount AS paidAmount,
        ${EFFECTIVE_STATUS_SQL} AS status,
        fa.status AS paymentStatus,
        fa.assigned_at AS assignedAt,

        fp.title,
        fc.fee_category_id AS feeCategoryId,
        fc.code AS feeCategoryCode,
        fc.name AS feeType,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.status AS planStatus,
        sy.year_name AS schoolYearName,
        sem.semester_name AS semesterName,

        s.student_id AS studentId,
        s.student_code AS studentCode,
        student_user.full_name AS studentFullName,
        sc.class_name AS className
      FROM user_account ua
      INNER JOIN parent_profile pp ON pp.user_id = ua.user_id
      INNER JOIN student_parent sp ON sp.parent_id = pp.parent_id
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      INNER JOIN fee_assignment fa ON fa.student_id = s.student_id
      INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
      INNER JOIN fee_category fc ON fc.fee_category_id = fp.fee_category_id
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY fp.due_date DESC, fa.fee_assignment_id DESC
    `,
    params,
  );

  return rows.map(normalizeAssignmentRow);
}

async function findFeeAssignmentForParent(userId, feeAssignmentId) {
  const [rows] = await pool.query(
    `
      SELECT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.fee_plan_id AS feePlanId,
        fa.amount,
        fa.discount_amount AS discountAmount,
        fa.final_amount AS finalAmount,
        fa.paid_amount AS paidAmount,
        ${EFFECTIVE_STATUS_SQL} AS status,
        fa.status AS paymentStatus,
        fa.assigned_at AS assignedAt,

        fp.title,
        fc.fee_category_id AS feeCategoryId,
        fc.code AS feeCategoryCode,
        fc.name AS feeType,
        fp.description,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.status AS planStatus,
        sy.year_name AS schoolYearName,
        sem.semester_name AS semesterName,

        s.student_id AS studentId,
        s.student_code AS studentCode,
        student_user.full_name AS studentFullName,
        sc.class_name AS className
      FROM user_account ua
      INNER JOIN parent_profile pp ON pp.user_id = ua.user_id
      INNER JOIN student_parent sp ON sp.parent_id = pp.parent_id
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      INNER JOIN fee_assignment fa ON fa.student_id = s.student_id
      INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
      INNER JOIN fee_category fc ON fc.fee_category_id = fp.fee_category_id
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE ua.user_id = ?
        AND ua.status = 'ACTIVE'
        AND s.status = 'ACTIVE'
        AND fa.fee_assignment_id = ?
      ORDER BY ce.enrollment_date DESC
      LIMIT 1
    `,
    [userId, feeAssignmentId],
  );

  if (!rows[0]) return null;
  return normalizeAssignmentRow(rows[0]);
}

async function listPaymentsForAssignment(feeAssignmentId) {
  const [rows] = await pool.query(
    `
      SELECT
        fpmt.payment_id AS paymentId,
        fpmt.payment_transaction_id AS paymentTransactionId,
        fpmt.amount,
        DATE_FORMAT(fpmt.payment_date, '%Y-%m-%d %H:%i:%s') AS paymentDate,
        fpmt.payment_method AS paymentMethod,
        fpmt.transaction_code AS transactionCode,
        fpmt.note,
        fpmt.created_at AS createdAt
      FROM fee_payment fpmt
      WHERE fpmt.fee_assignment_id = ?
      ORDER BY fpmt.payment_date DESC, fpmt.payment_id DESC
    `,
    [feeAssignmentId],
  );

  return rows.map((row) => ({ ...row, amount: toNumber(row.amount) }));
}

async function createPaymentTransaction({
  feeAssignmentId,
  provider,
  appTransId,
  amount,
  rawRequest,
  createdBy,
  expiredAt,
}) {
  const [result] = await pool.query(
    `
      INSERT INTO payment_transaction (
        fee_assignment_id,
        provider,
        app_trans_id,
        amount,
        status,
        raw_request,
        expired_at,
        created_by
      )
      VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?)
    `,
    [
      feeAssignmentId,
      provider,
      appTransId,
      toNumber(amount),
      rawRequest ? JSON.stringify(rawRequest) : null,
      expiredAt || null,
      createdBy || null,
    ],
  );

  return result.insertId;
}

async function updatePaymentTransactionOrder(appTransId, {
  orderUrl,
  qrCode,
  rawResponse,
}) {
  await pool.query(
    `
      UPDATE payment_transaction
      SET order_url = ?,
          qr_code = ?,
          raw_response = ?
      WHERE app_trans_id = ?
        AND status = 'PENDING'
    `,
    [
      orderUrl || null,
      qrCode || null,
      rawResponse ? JSON.stringify(rawResponse) : null,
      appTransId,
    ],
  );
}

async function findReusablePendingTransaction(feeAssignmentId) {
  const [rows] = await pool.query(
    `
      SELECT
        transaction_id AS transactionId,
        fee_assignment_id AS feeAssignmentId,
        app_trans_id AS appTransId,
        amount,
        order_url AS orderUrl,
        qr_code AS qrCode,
        expired_at AS expiredAt,
        created_at AS createdAt
      FROM payment_transaction
      WHERE fee_assignment_id = ?
        AND provider = 'ZALOPAY'
        AND status = 'PENDING'
        AND order_url IS NOT NULL
        AND (expired_at IS NULL OR expired_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [feeAssignmentId],
  );

  if (!rows[0]) return null;
  return { ...rows[0], amount: toNumber(rows[0].amount) };
}

async function findPaymentTransactionByAppTransId(appTransId) {
  const [rows] = await pool.query(
    `
      SELECT
        pt.transaction_id AS transactionId,
        pt.fee_assignment_id AS feeAssignmentId,
        pt.provider,
        pt.app_trans_id AS appTransId,
        pt.provider_transaction_id AS providerTransactionId,
        pt.amount,
        pt.status,
        pt.order_url AS orderUrl,
        pt.qr_code AS qrCode,
        pt.error_code AS errorCode,
        pt.error_message AS errorMessage,
        pt.expired_at AS expiredAt,
        pt.completed_at AS completedAt,
        pt.created_by AS createdBy,
        pt.created_at AS createdAt,
        pt.updated_at AS updatedAt,
        fa.fee_plan_id AS feePlanId
      FROM payment_transaction pt
      INNER JOIN fee_assignment fa
        ON fa.fee_assignment_id = pt.fee_assignment_id
      WHERE pt.provider = 'ZALOPAY'
        AND pt.app_trans_id = ?
      LIMIT 1
    `,
    [appTransId],
  );

  if (!rows[0]) return null;
  return { ...rows[0], amount: toNumber(rows[0].amount) };
}

async function listTransactionsForFeePlan(feePlanId) {
  const [rows] = await pool.query(
    `
      SELECT
        pt.transaction_id AS transactionId,
        pt.fee_assignment_id AS feeAssignmentId,
        pt.provider,
        pt.app_trans_id AS appTransId,
        pt.provider_transaction_id AS providerTransactionId,
        pt.amount,
        pt.status,
        pt.error_code AS errorCode,
        pt.error_message AS errorMessage,
        pt.completed_at AS completedAt,
        pt.created_at AS createdAt,
        pt.updated_at AS updatedAt,
        s.student_id AS studentId,
        s.student_code AS studentCode,
        student_user.full_name AS studentName
      FROM payment_transaction pt
      INNER JOIN fee_assignment fa
        ON fa.fee_assignment_id = pt.fee_assignment_id
      INNER JOIN student s ON s.student_id = fa.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      WHERE fa.fee_plan_id = ?
      ORDER BY pt.created_at DESC
    `,
    [feePlanId],
  );

  return rows.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
    // Giữ alias cũ để các màn hình admin/staff hiện tại không bị vỡ.
    zpTransId: row.providerTransactionId,
  }));
}

async function markPaymentTransactionStatus(appTransId, {
  status,
  providerTransactionId,
  rawResponse,
  errorCode,
  errorMessage,
}) {
  const completedAt = status === "SUCCESS" ? new Date() : null;

  await pool.query(
    `
      UPDATE payment_transaction
      SET status = ?,
          provider_transaction_id = COALESCE(?, provider_transaction_id),
          raw_response = COALESCE(?, raw_response),
          error_code = ?,
          error_message = ?,
          completed_at = CASE
            WHEN ? = 'SUCCESS' THEN COALESCE(completed_at, ?)
            ELSE completed_at
          END
      WHERE provider = 'ZALOPAY'
        AND app_trans_id = ?
        AND NOT EXISTS (
          SELECT 1
          FROM fee_payment fpmt
          WHERE fpmt.payment_transaction_id = payment_transaction.transaction_id
        )
    `,
    [
      status,
      providerTransactionId || null,
      rawResponse ? JSON.stringify(rawResponse) : null,
      errorCode || null,
      errorMessage || null,
      status,
      completedAt,
      appTransId,
    ],
  );
}

async function confirmZaloPayPayment({
  appTransId,
  providerTransactionId,
  amount,
  rawResponse,
  note,
  paidAt,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          pt.transaction_id AS transactionId,
          pt.fee_assignment_id AS feeAssignmentId,
          pt.provider,
          pt.app_trans_id AS appTransId,
          pt.provider_transaction_id AS providerTransactionId,
          pt.amount,
          pt.status,
          fa.final_amount AS finalAmount,
          fa.paid_amount AS paidAmount,
          fa.status AS assignmentStatus,
          existing.payment_id AS existingPaymentId
        FROM payment_transaction pt
        INNER JOIN fee_assignment fa
          ON fa.fee_assignment_id = pt.fee_assignment_id
        LEFT JOIN fee_payment existing
          ON existing.payment_transaction_id = pt.transaction_id
        WHERE pt.provider = 'ZALOPAY'
          AND pt.app_trans_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [appTransId],
    );

    const transaction = rows[0];
    if (!transaction) {
      throw createHttpError("Không tìm thấy giao dịch ZaloPay", 404);
    }

    const expectedAmount = toNumber(transaction.amount);
    const confirmedAmount = amount == null ? expectedAmount : toNumber(amount, NaN);

    if (!Number.isFinite(confirmedAmount) || confirmedAmount !== expectedAmount) {
      throw createHttpError("Số tiền ZaloPay trả về không khớp giao dịch", 409);
    }

    if (
      transaction.providerTransactionId
      && providerTransactionId
      && String(transaction.providerTransactionId) !== String(providerTransactionId)
    ) {
      throw createHttpError("Mã giao dịch ZaloPay không khớp", 409);
    }

    if (transaction.existingPaymentId) {
      if (transaction.status !== "SUCCESS") {
        throw createHttpError("Dữ liệu giao dịch đã ghi nhận nhưng trạng thái không hợp lệ", 409);
      }
      await connection.commit();
      return {
        alreadyConfirmed: true,
        transactionId: transaction.transactionId,
        feeAssignmentId: transaction.feeAssignmentId,
      };
    }

    if (["CANCELLED", "EXPIRED"].includes(transaction.status)) {
      throw createHttpError("Giao dịch đã bị hủy hoặc hết hạn", 409);
    }

    const remainingAmount = Math.max(
      toNumber(transaction.finalAmount) - toNumber(transaction.paidAmount),
      0,
    );

    if (expectedAmount > remainingAmount) {
      throw createHttpError(
        "Khoản phí đã được thanh toán bởi giao dịch khác; cần đối soát giao dịch ZaloPay này",
        409,
      );
    }

    const completedAt = normalizePaymentDate(paidAt);
    const transactionCode = providerTransactionId
      ? String(providerTransactionId)
      : appTransId;

    await connection.query(
      `
        UPDATE payment_transaction
        SET status = 'SUCCESS',
            provider_transaction_id = COALESCE(?, provider_transaction_id),
            raw_response = COALESCE(?, raw_response),
            error_code = NULL,
            error_message = NULL,
            completed_at = COALESCE(completed_at, ?)
        WHERE transaction_id = ?
      `,
      [
        providerTransactionId ? String(providerTransactionId) : null,
        rawResponse ? JSON.stringify(rawResponse) : null,
        completedAt,
        transaction.transactionId,
      ],
    );

    await connection.query(
      `
        INSERT INTO fee_payment (
          fee_assignment_id,
          payment_transaction_id,
          amount,
          payment_date,
          payment_method,
          transaction_code,
          note,
          recorded_by
        )
        VALUES (?, ?, ?, ?, 'ZALOPAY', ?, ?, NULL)
      `,
      [
        transaction.feeAssignmentId,
        transaction.transactionId,
        expectedAmount,
        completedAt,
        transactionCode,
        note || "Thanh toán trực tuyến qua ZaloPay",
      ],
    );

    await connection.commit();

    return {
      alreadyConfirmed: false,
      transactionId: transaction.transactionId,
      feeAssignmentId: transaction.feeAssignmentId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listFeeAssignmentsForParent,
  findFeeAssignmentForParent,
  listPaymentsForAssignment,
  createPaymentTransaction,
  updatePaymentTransactionOrder,
  findReusablePendingTransaction,
  findPaymentTransactionByAppTransId,
  listTransactionsForFeePlan,
  markPaymentTransactionStatus,
  confirmZaloPayPayment,
};
