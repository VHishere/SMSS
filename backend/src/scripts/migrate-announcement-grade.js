/*
 * One-off migration adding grade-wide targeting to announcements (admin can
 * post to a whole grade, not just a single class or a class it owns).
 * Safe to run multiple times.
 *
 * Usage: npm run migrate:announcement-grade
 */
const { pool } = require("../config/db");

async function run() {
  console.log("Đang kiểm tra cột grade_id trên bảng announcement...");

  const [existing] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'announcement' AND COLUMN_NAME = 'grade_id'`,
  );

  if (existing[0].cnt > 0) {
    console.log("✔ Cột grade_id đã tồn tại, bỏ qua.");
  } else {
    await pool.query(
      `ALTER TABLE announcement
         ADD COLUMN grade_id BIGINT NULL AFTER class_id,
         ADD CONSTRAINT fk_ann_grade FOREIGN KEY (grade_id) REFERENCES grade (grade_id)`,
    );
    console.log("✔ Đã thêm cột grade_id vào bảng announcement.");
  }

  console.log("Hoàn tất migration announcement grade_id.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
