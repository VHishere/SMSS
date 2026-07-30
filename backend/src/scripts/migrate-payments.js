/*
 * Payment schema compatibility check for the normalized fee database.
 *
 * This project now relies on:
 * - fee_plan.fee_category_id and explicit scope_* columns
 * - generated fee_assignment.final_amount/status columns
 * - payment_transaction.provider_transaction_id/completed_at
 * - fee_payment.payment_transaction_id and database payment triggers
 *
 * Usage: npm run migrate:payments
 */
const { pool } = require("../config/db");

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [table, column],
  );
  return Number(rows[0].count) > 0;
}

async function triggerExists(triggerName) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM information_schema.triggers
      WHERE trigger_schema = DATABASE()
        AND trigger_name = ?
    `,
    [triggerName],
  );
  return Number(rows[0].count) > 0;
}

async function assertColumn(table, column) {
  if (!(await columnExists(table, column))) {
    throw new Error(
      `Thiếu cột ${table}.${column}. Hãy import file DB chuẩn mới trước khi deploy backend.`,
    );
  }
}

async function run() {
  console.log("Đang kiểm tra schema học phí/thanh toán...");

  const requiredColumns = [
    ["fee_plan", "fee_category_id"],
    ["fee_plan", "scope_student_id"],
    ["fee_plan", "scope_class_id"],
    ["fee_plan", "scope_grade_id"],
    ["fee_assignment", "final_amount"],
    ["fee_assignment", "paid_amount"],
    ["fee_assignment", "status"],
    ["payment_transaction", "provider_transaction_id"],
    ["payment_transaction", "raw_request"],
    ["payment_transaction", "raw_response"],
    ["payment_transaction", "expired_at"],
    ["payment_transaction", "completed_at"],
    ["fee_payment", "payment_transaction_id"],
  ];

  for (const [table, column] of requiredColumns) {
    await assertColumn(table, column);
  }

  const requiredTriggers = [
    "trg_fee_assignment_before_insert",
    "trg_fee_assignment_paid_before_update",
    "trg_fee_payment_validate_before_insert",
    "trg_fee_payment_after_insert",
  ];

  for (const triggerName of requiredTriggers) {
    if (!(await triggerExists(triggerName))) {
      throw new Error(
        `Thiếu trigger ${triggerName}. Hãy import lại phần TUITION FEES & ONLINE PAYMENTS từ file DB chuẩn.`,
      );
    }
  }

  console.log("✔ Schema học phí/thanh toán tương thích với backend.");
  await pool.end();
}

run().catch(async (error) => {
  console.error("Kiểm tra schema thất bại:", error.message);
  try {
    await pool.end();
  } catch (_closeError) {
    // Ignore close errors after a failed connection/check.
  }
  process.exit(1);
});
