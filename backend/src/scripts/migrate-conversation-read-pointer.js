/*
 * One-off migration chuyển trạng thái "đã đọc" từ mốc thời gian sang con trỏ
 * message_id.
 *
 * Trước đây số tin chưa đọc được tính bằng `sent_at > last_read_at`. Cách này
 * phụ thuộc đồng hồ: chỉ cần một tin nhắn có sent_at ở tương lai (lệch giờ giữa
 * app và DB, hoặc dữ liệu nhập sẵn) là nó vĩnh viễn "chưa đọc" — người dùng bấm
 * vào thấy đã đọc, rồi lần tải lại danh sách kế tiếp nó lại hiện chưa đọc.
 *
 * message_id là AUTO_INCREMENT nên luôn tăng dần, không phụ thuộc đồng hồ.
 *
 *   1. Thêm cột last_read_message_id vào conversation_participant.
 *   2. Backfill từ last_read_at: tin cuối cùng đã gửi trước mốc đã đọc.
 *
 * Chỉ thêm cột và ghi giá trị, không xóa gì. Xem trước bằng:
 *
 *   npm run migrate:conversation-read-pointer -- --dry-run
 *   npm run migrate:conversation-read-pointer
 *
 * An toàn khi chạy lại nhiều lần.
 */
const { pool } = require("../config/db");

const DRY_RUN = process.argv.includes("--dry-run");

async function hasColumn() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'conversation_participant'
       AND COLUMN_NAME = 'last_read_message_id'`,
  );
  return row.cnt > 0;
}

async function addColumn() {
  if (await hasColumn()) {
    console.log("✔ Cột last_read_message_id đã tồn tại, bỏ qua.");
    return;
  }

  await pool.query(
    `ALTER TABLE conversation_participant
       ADD COLUMN last_read_message_id BIGINT NULL
         COMMENT 'Tin nhắn cuối cùng người dùng đã đọc trong hội thoại'
         AFTER last_read_at`,
  );
  console.log("✔ Đã thêm cột last_read_message_id.");
}

async function backfill() {
  // Giữ nguyên trạng thái hiện tại: ai đang có tin chưa đọc thì vẫn còn chưa
  // đọc, ai đã đọc hết tới mốc last_read_at thì con trỏ nhảy tới đó.
  const preview = `
    SELECT COUNT(*) AS cnt
    FROM conversation_participant cp
    WHERE cp.last_read_at IS NOT NULL
      AND cp.last_read_message_id IS NULL
  `;

  if (DRY_RUN) {
    if (!(await hasColumn())) {
      console.log("  ⚠ Chưa có cột. Chạy thật một lần trước để xem được backfill.");
      return;
    }
    const [[{ cnt }]] = await pool.query(preview);
    console.log(`  → sẽ gắn con trỏ cho ${cnt} dòng thành viên`);
    return;
  }

  const [result] = await pool.query(`
    UPDATE conversation_participant cp
    SET cp.last_read_message_id = (
      SELECT MAX(m.message_id)
      FROM conversation_message m
      WHERE m.conversation_id = cp.conversation_id
        AND m.sent_at <= cp.last_read_at
    )
    WHERE cp.last_read_at IS NOT NULL
      AND cp.last_read_message_id IS NULL
  `);

  console.log(`✔ Đã gắn con trỏ đã đọc cho ${result.affectedRows} dòng thành viên.`);

  const [[{ stuck }]] = await pool.query(`
    SELECT COUNT(*) AS stuck
    FROM conversation_participant cp
    INNER JOIN conversation_message m
      ON m.conversation_id = cp.conversation_id
      AND m.sender_id <> cp.user_id
      AND m.is_deleted = FALSE
      AND m.sent_at > NOW()
      AND m.message_id > COALESCE(cp.last_read_message_id, 0)
  `);

  if (stuck > 0) {
    console.log(
      `ℹ ${stuck} tin nhắn có sent_at ở tương lai vẫn đang tính là chưa đọc — chúng sẽ hết chưa đọc ngay khi người dùng mở hội thoại (trước đây thì không).`,
    );
  }
}

async function run() {
  if (DRY_RUN) {
    console.log("── CHẾ ĐỘ THỬ (--dry-run): không ghi thay đổi nào ──\n");
  }

  console.log("1/2 Kiểm tra cột last_read_message_id...");
  if (!DRY_RUN) await addColumn();

  console.log("\n2/2 Backfill con trỏ đã đọc từ last_read_at...");
  await backfill();

  console.log("\nHoàn tất migration con trỏ đã đọc.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
