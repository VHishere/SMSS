/*
 * Dời giờ gửi của những tin nhắn đang nằm ở tương lai về thực tế.
 *
 * Dữ liệu demo được nhập với sent_at cố định (ví dụ '2026-08-12 18:30:00'), nên
 * khi xem lúc 13:40 thì tin nhắn hiện giờ gửi muộn hơn hiện tại ~5 tiếng. Đồng
 * hồ máy chủ và MySQL đều đúng — tin nhắn gửi qua app dùng CURRENT_TIMESTAMP nên
 * không bị ảnh hưởng; đây thuần túy là dọn dữ liệu cũ.
 *
 * Cách dời: với mỗi hội thoại, trừ cùng một khoảng cho toàn bộ tin ở tương lai
 * để tin cuối cùng rơi vào vài phút trước hiện tại. Trừ cùng một khoảng nên
 * khoảng cách giữa các tin và thứ tự hội thoại được giữ nguyên.
 *
 *   npm run fix:future-message-times -- --dry-run
 *   npm run fix:future-message-times
 *
 * An toàn khi chạy lại nhiều lần (chạy lần hai sẽ không còn gì để dời).
 */
const { pool } = require("../config/db");

const DRY_RUN = process.argv.includes("--dry-run");

// Tin mới nhất sẽ nằm cách hiện tại chừng này phút, để không có gì kẹt lại ở
// tương lai nếu script chạy sát thời điểm chuyển phút.
const LANDING_MARGIN_MINUTES = 5;

async function findAffectedConversations() {
  const [rows] = await pool.query(`
    SELECT
      m.conversation_id AS conversationId,
      COUNT(*) AS futureCount,
      CAST(MAX(m.sent_at) AS CHAR) AS latestFuture,
      TIMESTAMPDIFF(SECOND, NOW(), MAX(m.sent_at)) AS secondsAhead,
      (
        SELECT CAST(MAX(prev.sent_at) AS CHAR)
        FROM conversation_message prev
        WHERE prev.conversation_id = m.conversation_id
          AND prev.sent_at <= NOW()
      ) AS latestPast
    FROM conversation_message m
    WHERE m.sent_at > NOW()
    GROUP BY m.conversation_id
    ORDER BY m.conversation_id
  `);

  return rows;
}

async function shiftConversation(conversation) {
  // Trừ đi phần vượt quá hiện tại, cộng thêm biên an toàn.
  const shiftSeconds =
    Number(conversation.secondsAhead) + LANDING_MARGIN_MINUTES * 60;

  const [messages] = await pool.query(
    `SELECT message_id AS messageId,
            CAST(sent_at AS CHAR) AS sentBefore,
            CAST(sent_at - INTERVAL ? SECOND AS CHAR) AS sentAfter
     FROM conversation_message
     WHERE conversation_id = ? AND sent_at > NOW()
     ORDER BY sent_at`,
    [shiftSeconds, conversation.conversationId],
  );

  // Không được dời lùi qua tin nhắn cũ nhất đã có, nếu không thứ tự hội thoại
  // sẽ đảo so với message_id.
  const earliestAfter = messages[0]?.sentAfter;
  if (conversation.latestPast && earliestAfter <= conversation.latestPast) {
    console.log(
      `  ⚠ Hội thoại #${conversation.conversationId}: dời về ${earliestAfter} sẽ chen trước tin cũ ${conversation.latestPast} — bỏ qua để rà soát thủ công.`,
    );
    return 0;
  }

  messages.forEach((message) => {
    console.log(`    #${message.messageId}: ${message.sentBefore} → ${message.sentAfter}`);
  });

  if (DRY_RUN) return messages.length;

  const [result] = await pool.query(
    `UPDATE conversation_message
     SET sent_at = sent_at - INTERVAL ? SECOND
     WHERE conversation_id = ? AND sent_at > NOW()`,
    [shiftSeconds, conversation.conversationId],
  );

  return result.affectedRows;
}

async function verify() {
  const [[{ remaining }]] = await pool.query(
    `SELECT COUNT(*) AS remaining FROM conversation_message WHERE sent_at > NOW()`,
  );

  // Thứ tự theo thời gian phải trùng thứ tự theo message_id, nếu không giao diện
  // sẽ hiển thị tin nhắn lộn xộn.
  const [[{ outOfOrder }]] = await pool.query(`
    SELECT COUNT(*) AS outOfOrder
    FROM conversation_message a
    INNER JOIN conversation_message b
      ON b.conversation_id = a.conversation_id
      AND b.message_id > a.message_id
      AND b.sent_at < a.sent_at
  `);

  console.log(`\nCòn tin ở tương lai: ${remaining}`);
  console.log(`Cặp tin nhắn sai thứ tự thời gian so với message_id: ${outOfOrder}`);
}

async function run() {
  if (DRY_RUN) {
    console.log("── CHẾ ĐỘ THỬ (--dry-run): không ghi thay đổi nào ──\n");
  }

  const conversations = await findAffectedConversations();

  if (conversations.length === 0) {
    console.log("✔ Không có tin nhắn nào ở tương lai.");
    await pool.end();
    return;
  }

  let total = 0;

  for (const conversation of conversations) {
    const hours = (Number(conversation.secondsAhead) / 3600).toFixed(1);
    console.log(
      `  Hội thoại #${conversation.conversationId}: ${conversation.futureCount} tin, muộn nhất ${conversation.latestFuture} (sớm ${hours} giờ)`,
    );
    total += await shiftConversation(conversation);
  }

  console.log(`\n✔ ${DRY_RUN ? "Sẽ dời" : "Đã dời"} ${total} tin nhắn.`);

  if (!DRY_RUN) await verify();

  await pool.end();
}

run().catch((error) => {
  console.error("Dọn dữ liệu thất bại:", error);
  process.exit(1);
});
