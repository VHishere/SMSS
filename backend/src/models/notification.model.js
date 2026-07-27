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

module.exports = {
  findByUserId,
  markRead,
  markAllRead,
};
