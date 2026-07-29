/*
 * One-off migration for admin-managed tuition fee categories (UC-10) and
 * fee rates (UC-11). Safe to run multiple times.
 *
 * Usage: npm run migrate:fee-categories
 */
const { pool } = require("../config/db");

async function run() {
  console.log("Đang kiểm tra bảng fee_category...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fee_category (
      fee_category_id BIGINT NOT NULL AUTO_INCREMENT,
      name VARCHAR(150) NOT NULL,
      description TEXT DEFAULT NULL,
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_by BIGINT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (fee_category_id),
      UNIQUE KEY uq_fee_category_name (name),
      CONSTRAINT fk_fee_category_created_by
        FOREIGN KEY (created_by) REFERENCES user_account (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✔ Bảng fee_category sẵn sàng.");

  console.log("Đang kiểm tra bảng fee_rate...");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS fee_rate (
      fee_rate_id BIGINT NOT NULL AUTO_INCREMENT,
      fee_category_id BIGINT NOT NULL,
      school_year_id BIGINT NOT NULL,
      semester_id BIGINT DEFAULT NULL,
      grade_id BIGINT DEFAULT NULL,
      class_id BIGINT DEFAULT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      billing_cycle ENUM('ONE_TIME','MONTHLY','PER_SEMESTER','PER_YEAR') NOT NULL DEFAULT 'PER_SEMESTER',
      status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
      created_by BIGINT DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (fee_rate_id),
      KEY idx_fee_rate_category (fee_category_id),
      KEY idx_fee_rate_year (school_year_id),
      KEY idx_fee_rate_status (status),
      CONSTRAINT fk_fee_rate_category
        FOREIGN KEY (fee_category_id) REFERENCES fee_category (fee_category_id),
      CONSTRAINT fk_fee_rate_school_year
        FOREIGN KEY (school_year_id) REFERENCES school_year (school_year_id),
      CONSTRAINT fk_fee_rate_semester
        FOREIGN KEY (semester_id) REFERENCES semester (semester_id),
      CONSTRAINT fk_fee_rate_grade
        FOREIGN KEY (grade_id) REFERENCES grade (grade_id),
      CONSTRAINT fk_fee_rate_class
        FOREIGN KEY (class_id) REFERENCES school_class (class_id),
      CONSTRAINT fk_fee_rate_created_by
        FOREIGN KEY (created_by) REFERENCES user_account (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✔ Bảng fee_rate sẵn sàng.");

  console.log("Hoàn tất migration loại phí & mức thu.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
