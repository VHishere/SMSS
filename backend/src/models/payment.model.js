const { pool } = require("../config/db");

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

// Every fee assignment belonging to any student linked to this parent account.
async function listFeeAssignmentsForParent(userId, filters = {}) {
  const conditions = [
    "ua.user_id = ?",
    "ua.status = 'ACTIVE'",
    "fp.status != 'DRAFT'",
  ];
  const params = [userId];

  if (filters.studentId) {
    conditions.push("s.student_id = ?");
    params.push(filters.studentId);
  }

  if (filters.status) {
    conditions.push("fa.status = ?");
    params.push(filters.status);
  }

  const [rows] = await pool.query(
    `
      SELECT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.fee_plan_id       AS feePlanId,
        fa.amount,
        fa.discount_amount   AS discountAmount,
        fa.final_amount      AS finalAmount,
        fa.paid_amount       AS paidAmount,
        fa.status,
        fa.assigned_at       AS assignedAt,

        fp.title,
        fp.fee_type          AS feeType,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.status             AS planStatus,
        sy.year_name          AS schoolYearName,
        sem.semester_name     AS semesterName,

        s.student_id          AS studentId,
        s.student_code        AS studentCode,
        student_user.full_name AS studentFullName,
        sc.class_name          AS className

      FROM user_account ua
      INNER JOIN parent_profile pp ON pp.user_id = ua.user_id
      INNER JOIN student_parent sp ON sp.parent_id = pp.parent_id
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      INNER JOIN fee_assignment fa ON fa.student_id = s.student_id
      INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY fp.due_date DESC, fa.fee_assignment_id DESC
    `,
    params,
  );

  return rows.map(normalizeAssignmentRow);
}

// Ownership-checked lookup: only returns a row if the assignment belongs to
// a student linked to this parent account.
async function findFeeAssignmentForParent(userId, feeAssignmentId) {
  const [rows] = await pool.query(
    `
      SELECT
        fa.fee_assignment_id AS feeAssignmentId,
        fa.fee_plan_id       AS feePlanId,
        fa.amount,
        fa.discount_amount   AS discountAmount,
        fa.final_amount      AS finalAmount,
        fa.paid_amount       AS paidAmount,
        fa.status,
        fa.assigned_at       AS assignedAt,

        fp.title,
        fp.fee_type          AS feeType,
        fp.description,
        DATE_FORMAT(fp.due_date, '%Y-%m-%d') AS dueDate,
        fp.status             AS planStatus,
        sy.year_name          AS schoolYearName,
        sem.semester_name     AS semesterName,

        s.student_id          AS studentId,
        s.student_code        AS studentCode,
        student_user.full_name AS studentFullName,
        sc.class_name          AS className

      FROM user_account ua
      INNER JOIN parent_profile pp ON pp.user_id = ua.user_id
      INNER JOIN student_parent sp ON sp.parent_id = pp.parent_id
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account student_user ON student_user.user_id = s.user_id
      INNER JOIN fee_assignment fa ON fa.student_id = s.student_id
      INNER JOIN fee_plan fp ON fp.fee_plan_id = fa.fee_plan_id
      INNER JOIN school_year sy ON sy.school_year_id = fp.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = fp.semester_id
      LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE ua.user_id = ?
        AND ua.status = 'ACTIVE'
        AND fa.fee_assignment_id = ?
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
        fpmt.amount,
        DATE_FORMAT(fpmt.payment_date, '%Y-%m-%d') AS paymentDate,
        fpmt.payment_method AS paymentMethod,
        fpmt.transaction_code AS transactionCode,
        fpmt.note,
        fpmt.created_at AS createdAt
      FROM fee_payment fpmt
      WHERE fpmt.fee_assignment_id = ?
      ORDER BY fpmt.created_at DESC
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
  orderUrl,
  qrCode,
  rawResponse,
  createdBy,
}) {
  await pool.query(
    `
      INSERT INTO payment_transaction (
        fee_assignment_id, provider, app_trans_id, amount,
        status, order_url, qr_code, raw_response, created_by
      )
      VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)
    `,
    [
      feeAssignmentId,
      provider,
      appTransId,
      toNumber(amount),
      orderUrl || null,
      qrCode || null,
      rawResponse ? JSON.stringify(rawResponse) : null,
      createdBy || null,
    ],
  );
}

async function findPaymentTransactionByAppTransId(appTransId) {
  const [rows] = await pool.query(
    `
      SELECT
        pt.transaction_id AS transactionId,
        pt.fee_assignment_id AS feeAssignmentId,
        pt.provider,
        pt.app_trans_id AS appTransId,
        pt.amount,
        pt.status,
        pt.zp_trans_id AS zpTransId,
        pt.order_url AS orderUrl,
        pt.qr_code AS qrCode,
        pt.created_by AS createdBy,
        fa.fee_plan_id AS feePlanId
      FROM payment_transaction pt
      INNER JOIN fee_assignment fa ON fa.fee_assignment_id = pt.fee_assignment_id
      WHERE pt.app_trans_id = ?
      LIMIT 1
    `,
    [appTransId],
  );

  if (!rows[0]) return null;
  return { ...rows[0], amount: toNumber(rows[0].amount) };
}

async function markPaymentTransactionStatus(appTransId, { status, zpTransId, rawResponse }) {
  await pool.query(
    `
      UPDATE payment_transaction
      SET status = ?,
          zp_trans_id = COALESCE(?, zp_trans_id),
          raw_response = COALESCE(?, raw_response)
      WHERE app_trans_id = ?
    `,
    [
      status,
      zpTransId || null,
      rawResponse ? JSON.stringify(rawResponse) : null,
      appTransId,
    ],
  );
}

module.exports = {
  listFeeAssignmentsForParent,
  findFeeAssignmentForParent,
  listPaymentsForAssignment,
  createPaymentTransaction,
  findPaymentTransactionByAppTransId,
  markPaymentTransactionStatus,
};
