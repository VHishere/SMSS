/*
 * One-off migration gộp các cuộc trò chuyện 1-1 trùng lặp.
 *
 * Trước đây mỗi luồng 1-1 được tra cứu theo (conversation_type, student_id), nên
 * cùng hai con người có thể có nhiều cuộc: giáo viên nhắn về đứa con thứ hai,
 * hoặc cùng một người vừa là giáo viên bộ môn vừa là quản nhiệm. Migration này
 * gom toàn bộ lịch sử về một cuộc duy nhất cho mỗi cặp người — như Messenger.
 *
 *   1. Thêm cột dm_key ('userNhỏ:userLớn') vào bảng conversation.
 *   2. Chuyển luồng "1-1" có từ ba người trở lên thành GROUP.
 *   3. Gộp các cuộc trùng: dời tin nhắn, gộp trạng thái đã đọc, trỏ lại thông báo.
 *   4. Backfill dm_key và thêm UNIQUE để không bao giờ trùng lại.
 *
 * Chỉ gộp cuộc có ĐÚNG hai người tham gia — gộp luồng có người thứ ba sẽ để lộ
 * lịch sử cho người mà bên kia không hề chọn.
 *
 * Bước 2 xóa dòng conversation/conversation_participant thừa (tin nhắn được dời
 * chứ không mất). Xem trước bằng:
 *
 *   npm run migrate:merge-direct-conversations -- --dry-run
 *   npm run migrate:merge-direct-conversations
 *
 * An toàn khi chạy lại nhiều lần.
 */
const { pool } = require("../config/db");

const DRY_RUN = process.argv.includes("--dry-run");

async function hasColumn(column) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'conversation'
       AND COLUMN_NAME = ?`,
    [column],
  );
  return row.cnt > 0;
}

async function hasIndex(indexName) {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'conversation'
       AND INDEX_NAME = ?`,
    [indexName],
  );
  return row.cnt > 0;
}

async function addColumn() {
  if (await hasColumn("dm_key")) {
    console.log("✔ Cột dm_key đã tồn tại, bỏ qua.");
    return;
  }

  await pool.query(
    `ALTER TABLE conversation
       ADD COLUMN dm_key VARCHAR(64) NULL
         COMMENT 'Cặp user của luồng 1-1, dạng userNhỏ:userLớn' AFTER area_id`,
  );
  console.log("✔ Đã thêm cột dm_key vào bảng conversation.");
}

// Các cặp người đang có nhiều hơn một cuộc trò chuyện 1-1.
async function findDuplicatePairs() {
  const [rows] = await pool.query(`
    SELECT
      LEAST(a.user_id, b.user_id)    AS userA,
      GREATEST(a.user_id, b.user_id) AS userB,
      GROUP_CONCAT(c.conversation_id ORDER BY c.conversation_id ASC) AS conversationIds,
      uaa.full_name AS nameA,
      uab.full_name AS nameB
    FROM conversation c
    INNER JOIN conversation_participant a ON a.conversation_id = c.conversation_id
    INNER JOIN conversation_participant b ON b.conversation_id = c.conversation_id
      AND b.user_id > a.user_id
    INNER JOIN user_account uaa ON uaa.user_id = LEAST(a.user_id, b.user_id)
    INNER JOIN user_account uab ON uab.user_id = GREATEST(a.user_id, b.user_id)
    WHERE c.conversation_type <> 'GROUP'
      AND (
        SELECT COUNT(*) FROM conversation_participant cp
        WHERE cp.conversation_id = c.conversation_id
      ) = 2
    GROUP BY userA, userB, uaa.full_name, uab.full_name
    HAVING COUNT(DISTINCT c.conversation_id) > 1
    ORDER BY userA, userB
  `);

  return rows.map((row) => ({
    ...row,
    conversationIds: row.conversationIds.split(",").map(Number),
  }));
}

async function mergeInto(canonicalId, duplicateId, conn) {
  // Tin nhắn giữ nguyên message_id và sent_at, chỉ đổi chủ sở hữu, nên thứ tự
  // hội thoại sau khi gộp vẫn đúng theo thời gian.
  const [messages] = await conn.query(
    `UPDATE conversation_message SET conversation_id = ? WHERE conversation_id = ?`,
    [canonicalId, duplicateId],
  );

  // Mốc đã đọc: lấy mốc muộn hơn của hai luồng. Chọn mốc sớm hơn sẽ khiến những
  // tin đã đọc từ lâu bật lại thành chưa đọc.
  await conn.query(
    `
      UPDATE conversation_participant canonical
      INNER JOIN conversation_participant dup
        ON dup.conversation_id = ?
        AND dup.user_id = canonical.user_id
      SET canonical.last_read_at = GREATEST(
        COALESCE(canonical.last_read_at, '1970-01-01'),
        COALESCE(dup.last_read_at, '1970-01-01')
      )
      WHERE canonical.conversation_id = ?
    `,
    [duplicateId, canonicalId],
  );

  // notification.related_id không có khóa ngoại nên phải tự trỏ lại, nếu không
  // bấm vào thông báo cũ sẽ mở một hội thoại đã bị xóa.
  const [notifications] = await conn.query(
    `UPDATE notification SET related_id = ?
     WHERE related_type = 'CONVERSATION' AND related_id = ?`,
    [canonicalId, duplicateId],
  );

  await conn.query(
    `DELETE FROM conversation_participant WHERE conversation_id = ?`,
    [duplicateId],
  );
  await conn.query(
    `DELETE FROM conversation WHERE conversation_id = ?`,
    [duplicateId],
  );

  return {
    messages: messages.affectedRows,
    notifications: notifications.affectedRows,
  };
}

// Một vài luồng "1-1" thật ra có ba người (giáo viên + phụ huynh + chuyên viên
// tư vấn). Không thể gộp chúng vào luồng hai người mà không để lộ lịch sử cho
// người thứ ba, nhưng để nguyên kiểu 1-1 thì danh sách lại hiện chúng dưới tên
// một cá nhân — trông như trùng lặp. Chúng vốn là nhóm, nên chuyển hẳn thành nhóm.
async function convertMultiPartyToGroup() {
  const [rows] = await pool.query(`
    SELECT c.conversation_id AS conversationId, c.title, c.student_id AS studentId,
           COUNT(cp.participant_id) AS memberCount,
           (SELECT sua.full_name FROM student s
            INNER JOIN user_account sua ON sua.user_id = s.user_id
            WHERE s.student_id = c.student_id) AS studentName
    FROM conversation c
    INNER JOIN conversation_participant cp ON cp.conversation_id = c.conversation_id
    WHERE c.conversation_type <> 'GROUP'
    GROUP BY c.conversation_id, c.title, c.student_id
    HAVING memberCount > 2
    ORDER BY c.conversation_id ASC
  `);

  if (rows.length === 0) {
    console.log("✔ Không có luồng 1-1 nào nhiều hơn hai người.");
    return;
  }

  for (const row of rows) {
    const title = row.title
      || (row.studentName ? `Trao đổi về ${row.studentName}` : "Trao đổi nhiều bên");

    console.log(
      `  #${row.conversationId} (${row.memberCount} người) ⇒ GROUP "${title}"`,
    );

    if (DRY_RUN) continue;

    await pool.query(
      `UPDATE conversation SET conversation_type = 'GROUP', title = ? WHERE conversation_id = ?`,
      [title, row.conversationId],
    );
  }

  console.log(`✔ Đã chuyển ${rows.length} luồng nhiều bên thành nhóm.`);
}

async function mergeDuplicates() {
  const pairs = await findDuplicatePairs();

  if (pairs.length === 0) {
    console.log("✔ Không có cặp nào trùng lặp.");
    return;
  }

  let mergedConversations = 0;
  let movedMessages = 0;

  for (const pair of pairs) {
    const [canonicalId, ...duplicates] = pair.conversationIds;

    console.log(
      `  ${pair.nameA} ↔ ${pair.nameB}: giữ #${canonicalId}, gộp ${duplicates.map((id) => `#${id}`).join(", ")}`,
    );

    if (DRY_RUN) {
      const [[{ cnt }]] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM conversation_message WHERE conversation_id IN (?)`,
        [duplicates],
      );
      console.log(`    → sẽ dời ${cnt} tin nhắn`);
      mergedConversations += duplicates.length;
      movedMessages += cnt;
      continue;
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const duplicateId of duplicates) {
        const result = await mergeInto(canonicalId, duplicateId, conn);
        console.log(
          `    → #${duplicateId}: dời ${result.messages} tin nhắn, cập nhật ${result.notifications} thông báo`,
        );
        mergedConversations += 1;
        movedMessages += result.messages;
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }
  }

  console.log(
    `✔ Đã gộp ${mergedConversations} cuộc trùng, dời ${movedMessages} tin nhắn.`,
  );
}

async function backfillKeys() {
  if (DRY_RUN) {
    // Cột dm_key có thể chưa tồn tại khi chạy thử lần đầu.
    const pending = (await hasColumn("dm_key")) ? "AND c.dm_key IS NULL" : "";
    const [[{ cnt }]] = await pool.query(`
      SELECT COUNT(*) AS cnt FROM conversation c
      WHERE c.conversation_type <> 'GROUP'
        ${pending}
        AND (SELECT COUNT(*) FROM conversation_participant cp
             WHERE cp.conversation_id = c.conversation_id) = 2
    `);
    console.log(`  → sẽ gắn dm_key cho ${cnt} hội thoại`);
    return;
  }

  const [result] = await pool.query(`
    UPDATE conversation c
    SET c.dm_key = (
      SELECT CONCAT(MIN(cp.user_id), ':', MAX(cp.user_id))
      FROM conversation_participant cp
      WHERE cp.conversation_id = c.conversation_id
    )
    WHERE c.conversation_type <> 'GROUP'
      AND (SELECT COUNT(*) FROM conversation_participant cp2
           WHERE cp2.conversation_id = c.conversation_id) = 2
  `);
  console.log(`✔ Đã gắn dm_key cho ${result.affectedRows} hội thoại.`);

  if (await hasIndex("uq_conversation_dm_key")) {
    console.log("✔ Ràng buộc uq_conversation_dm_key đã tồn tại, bỏ qua.");
    return;
  }

  await pool.query(
    `ALTER TABLE conversation ADD UNIQUE KEY uq_conversation_dm_key (dm_key)`,
  );
  console.log("✔ Đã thêm UNIQUE uq_conversation_dm_key.");
}

async function run() {
  if (DRY_RUN) {
    console.log("── CHẾ ĐỘ THỬ (--dry-run): không ghi thay đổi nào ──\n");
  }

  console.log("1/4 Kiểm tra cột dm_key...");
  if (!DRY_RUN) await addColumn();

  console.log("\n2/4 Chuyển luồng nhiều bên thành nhóm...");
  await convertMultiPartyToGroup();

  console.log("\n3/4 Gộp các cuộc trò chuyện trùng...");
  await mergeDuplicates();

  console.log("\n4/4 Gắn dm_key và khóa ràng buộc duy nhất...");
  await backfillKeys();

  console.log("\nHoàn tất migration gộp hội thoại 1-1.");
  await pool.end();
}

run().catch((error) => {
  console.error("Migration thất bại:", error);
  process.exit(1);
});
