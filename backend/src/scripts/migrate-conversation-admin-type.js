/*
 * One-off migration adding an ADMIN_DIRECT conversation type so admin can
 * message staff/teacher users through the same generic messaging infra used
 * by parent/student/teacher. Safe to run multiple times.
 *
 * Usage: npm run migrate:conversation-admin-type
 */
const { pool } = require("../config/db");

async function run() {
  console.log("Đang kiểm tra cột conversation_type trên bảng conversation...");

  const [[col]] = await pool.query(
    `SELECT COLUMN_TYPE AS colType FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'conversation' AND COLUMN_NAME = 'conversation_type'`,
  );

  if (col && col.colType.includes("ADMIN_DIRECT")) {
    console.log("✔ Giá trị ADMIN_DIRECT đã tồn tại, bỏ qua.");
  } else {
    await pool.query(
      `ALTER TABLE conversation
         MODIFY COLUMN conversation_type
         ENUM('PARENT_TEACHER','PARENT_SUPERVISOR','TEACHER_STUDENT','GROUP','ADMIN_DIRECT') NOT NULL`,
    );
    console.log("✔ Đã thêm giá trị ADMIN_DIRECT vào conversation_type.");
  }

  console.log("Hoàn tất migration conversation_type.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
