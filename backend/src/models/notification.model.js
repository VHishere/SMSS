const { pool } = require("../config/db");

// Generic notification-table access, shared across roles (parent/student
// have their own copies pre-dating this file; admin uses this one).
async function findByUserId(userId, filters = {}) {
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 30));
  const unreadOnly = filters.unreadOnly === true || filters.unreadOnly === "true";

  let where = "receiver_id = ?";
  if (unreadOnly) {
    where += " AND is_read = FALSE";
  }

  const [[summary]] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalNotifications,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) AS unreadNotifications
      FROM notification
      WHERE receiver_id = ?
    `,
    [userId],
  );

  const [items] = await pool.query(
    `
      SELECT
        notification_id AS notificationId,
        title,
        content,
        type,
        related_type AS relatedType,
        related_id AS relatedId,
        is_read AS isRead,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt
      FROM notification
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [userId, limit],
  );

  return {
    summary: {
      totalNotifications: Number(summary?.totalNotifications || 0),
      unreadNotifications: Number(summary?.unreadNotifications || 0),
    },
    items,
  };
}

async function markRead(userId, notificationId) {
  const [result] = await pool.query(
    `
      UPDATE notification
      SET is_read = TRUE
      WHERE receiver_id = ?
        AND notification_id = ?
    `,
    [userId, notificationId],
  );

  return result.affectedRows;
}

async function markAllRead(userId) {
  const [result] = await pool.query(
    `
      UPDATE notification
      SET is_read = TRUE
      WHERE receiver_id = ?
        AND is_read = FALSE
    `,
    [userId],
  );

  return result.affectedRows;
}

// ── Gửi thông báo tới hộp thư GIÁO VỤ (tất cả tài khoản STAFF đang hoạt động) ─
// Nhận `conn` để chạy CHUNG transaction với nghiệp vụ gọi nó → nghiệp vụ rollback
// thì thông báo cũng mất theo (không tạo thông báo cho việc chưa thực sự xảy ra).
// Truyền conn = null nếu muốn dùng pool.
async function notifyAllStaff(conn, { title, content, type, relatedType, relatedId }) {
  const db = conn || pool;
  const [staff] = await db.query(
    `SELECT DISTINCT ua.user_id AS userId
     FROM user_account ua
     INNER JOIN user_role ur ON ur.user_id = ua.user_id
     INNER JOIN role r ON r.role_id = ur.role_id
     WHERE r.role_name = 'STAFF' AND ua.status = 'ACTIVE'`,
  );
  if (!staff.length) return 0;

  await db.query(
    `INSERT INTO notification
       (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [staff.map((s) => [s.userId, title, content, type, relatedType ?? null, relatedId ?? null, false])],
  );
  return staff.length;
}

// ── Trạng thái đã đọc cho FEED DẪN XUẤT (teacher / supervisor) ────────────────
// Các feed này tổng hợp từ nhiều bảng nên từng mục không có cột is_read; ta lưu
// "user đã đọc mục có feed_key nào" ở bảng notification_read_state.

async function findReadFeedKeys(userId) {
  const [rows] = await pool.query(
    `SELECT feed_key AS feedKey FROM notification_read_state WHERE user_id = ?`,
    [userId],
  );
  return rows.map((r) => r.feedKey);
}

async function markFeedKeyRead(userId, feedKey) {
  // INSERT IGNORE: bấm lại mục đã đọc không lỗi, không đổi read_at.
  const [result] = await pool.query(
    `INSERT IGNORE INTO notification_read_state (user_id, feed_key) VALUES (?, ?)`,
    [userId, feedKey],
  );
  return result.affectedRows;
}

async function markFeedKeysRead(userId, feedKeys) {
  if (!feedKeys.length) return 0;
  const [result] = await pool.query(
    `INSERT IGNORE INTO notification_read_state (user_id, feed_key) VALUES ?`,
    [feedKeys.map((k) => [userId, k])],
  );
  return result.affectedRows;
}

module.exports = {
  findByUserId,
  markRead,
  markAllRead,
  findReadFeedKeys,
  markFeedKeyRead,
  markFeedKeysRead,
  notifyAllStaff,
};
