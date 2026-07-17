/*
 * One-off migration for the parent online-payment feature (VietQR / ZaloPay).
 * Safe to run multiple times.
 *
 * Usage: npm run migrate:payments
 */
const { pool } = require("../config/db");

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS cnt
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [table, column],
  );
  return rows[0].cnt > 0;
}

async function run() {
  console.log("Đang kiểm tra bảng payment_transaction...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payment_transaction (
      transaction_id BIGINT NOT NULL AUTO_INCREMENT,
      fee_assignment_id BIGINT NOT NULL,
      provider ENUM('VIETQR','ZALOPAY') NOT NULL,
      app_trans_id VARCHAR(50) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      status ENUM('PENDING','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      zp_trans_id VARCHAR(50) DEFAULT NULL,
      order_url VARCHAR(1000) DEFAULT NULL,
      qr_code TEXT DEFAULT NULL,
      raw_response TEXT DEFAULT NULL,
      created_by BIGINT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (transaction_id),
      UNIQUE KEY uq_payment_transaction_app_trans_id (app_trans_id),
      KEY idx_payment_transaction_assignment (fee_assignment_id),
      CONSTRAINT fk_payment_transaction_assignment
        FOREIGN KEY (fee_assignment_id) REFERENCES fee_assignment (fee_assignment_id),
      CONSTRAINT fk_payment_transaction_created_by
        FOREIGN KEY (created_by) REFERENCES user_account (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✔ Bảng payment_transaction sẵn sàng.");

  console.log("Đang mở rộng fee_payment.payment_method...");
  await pool.query(`
    ALTER TABLE fee_payment
      MODIFY COLUMN payment_method ENUM('CASH','BANK_TRANSFER','CARD','ZALOPAY','OTHER')
      NOT NULL DEFAULT 'CASH';
  `);
  console.log("✔ fee_payment.payment_method đã hỗ trợ giá trị ZALOPAY.");

  const hasTransactionCode = await columnExists("payment_transaction", "transaction_id");
  if (!hasTransactionCode) {
    throw new Error("Migration payment_transaction thất bại, không tìm thấy bảng vừa tạo.");
  }

  console.log("Hoàn tất migration thanh toán trực tuyến.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
