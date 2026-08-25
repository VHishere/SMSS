const { pool } = require("../config/db");

async function create({ title, content, audience, classId, gradeId, status, scheduledAt, createdBy }) {
  const [result] = await pool.query(
    `INSERT INTO announcement (title, content, audience, class_id, grade_id, status, scheduled_at, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, content ?? null, audience, classId ?? null, gradeId ?? null, status, scheduledAt ?? null,
     status === "PUBLISHED" ? new Date() : null, createdBy],
  );
  return result.insertId;
}

// Every announcement school-wide, not scoped to a single creator (admin
// manage-mode view — mirrors findByCreator but unfiltered).
async function findAll({ status, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = [];
  let where = "1=1";
  if (status) { where += " AND a.status = ?"; params.push(status); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM announcement a WHERE ${where}`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT
       a.announcement_id AS announcementId,
       a.title, a.content, a.audience, a.class_id AS classId, a.grade_id AS gradeId,
       a.status, a.is_pinned AS isPinned,
       DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i') AS scheduledAt,
       DATE_FORMAT(a.published_at, '%Y-%m-%d %H:%i') AS publishedAt,
       DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       sc.class_name AS className,
       g.grade_name AS gradeName,
       ua.full_name AS createdByName
     FROM announcement a
     LEFT JOIN school_class sc ON sc.class_id = a.class_id
     LEFT JOIN grade g ON g.grade_id = a.grade_id
     LEFT JOIN user_account ua ON ua.user_id = a.created_by
     WHERE ${where}
     ORDER BY a.is_pinned DESC, a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return {
    total: Number(total),
    rows: rows.map((r) => ({ ...r, isPinned: Boolean(r.isPinned) })),
  };
}

async function findByCreator(createdBy, { status, page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const params = [createdBy];
  let where = "a.created_by = ?";
  if (status) { where += " AND a.status = ?"; params.push(status); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM announcement a WHERE ${where}`,
    params,
  );
  const [rows] = await pool.query(
    `SELECT
       a.announcement_id AS announcementId,
       a.title, a.content, a.audience, a.class_id AS classId,
       a.status, a.is_pinned AS isPinned,
       DATE_FORMAT(a.scheduled_at, '%Y-%m-%d %H:%i') AS scheduledAt,
       DATE_FORMAT(a.published_at, '%Y-%m-%d %H:%i') AS publishedAt,
       DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       sc.class_name AS className
     FROM announcement a
     LEFT JOIN school_class sc ON sc.class_id = a.class_id
     WHERE ${where}
     ORDER BY a.is_pinned DESC, a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  return {
    total: Number(total),
    rows: rows.map((r) => ({ ...r, isPinned: Boolean(r.isPinned) })),
  };
}

async function findById(announcementId) {
  const [[row]] = await pool.query(
    `SELECT
       announcement_id AS announcementId, title, content, audience, class_id AS classId, grade_id AS gradeId,
       status, is_pinned AS isPinned, scheduled_at AS scheduledRaw, created_by AS createdBy
     FROM announcement WHERE announcement_id = ?`,
    [announcementId],
  );
  if (!row) return null;
  return { ...row, isPinned: Boolean(row.isPinned) };
}

async function update(announcementId, { title, content, audience, classId, gradeId, scheduledAt, status }) {
  const [result] = await pool.query(
    `UPDATE announcement
     SET title = ?, content = ?, audience = ?, class_id = ?, grade_id = ?, scheduled_at = ?, status = ?
     WHERE announcement_id = ? AND status <> 'ARCHIVED'`,
    [title, content ?? null, audience, classId ?? null, gradeId ?? null, scheduledAt ?? null, status, announcementId],
  );
  return result.affectedRows;
}

async function setStatus(announcementId, status) {
  const [result] = await pool.query(
    `UPDATE announcement
     SET status = ?, published_at = CASE WHEN ? = 'PUBLISHED' THEN NOW() ELSE published_at END
     WHERE announcement_id = ?`,
    [status, status, announcementId],
  );
  return result.affectedRows;
}

async function setPinned(announcementId, isPinned) {
  const [result] = await pool.query(
    `UPDATE announcement SET is_pinned = ? WHERE announcement_id = ?`,
    [isPinned ? 1 : 0, announcementId],
  );
  return result.affectedRows;
}

// Scheduled announcements whose time has arrived (used by an external/cron runner).
async function findDue() {
  const [rows] = await pool.query(
    `SELECT announcement_id AS announcementId, title, content, audience, class_id AS classId, grade_id AS gradeId, created_by AS createdBy
     FROM announcement
     WHERE status = 'SCHEDULED'
       AND scheduled_at IS NOT NULL
       AND scheduled_at <= CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+07:00')`,
  );
  return rows;
}

// UC-71: read receipts derived from the fanned-out notifications.
async function findReadReceipts(announcementId) {
  const [rows] = await pool.query(
    `SELECT
       ua.full_name AS name,
       n.is_read    AS isRead,
       DATE_FORMAT(n.created_at, '%Y-%m-%d %H:%i') AS sentAt
     FROM notification n
     INNER JOIN user_account ua ON ua.user_id = n.receiver_id
     WHERE n.related_type = 'ANNOUNCEMENT' AND n.related_id = ?
     ORDER BY n.is_read DESC, ua.full_name`,
    [announcementId],
  );
  const recipients = rows.map((r) => ({ name: r.name, isRead: Boolean(r.isRead), sentAt: r.sentAt }));
  const total = recipients.length;
  const readCount = recipients.filter((r) => r.isRead).length;
  return {
    total,
    readCount,
    readRate: total > 0 ? Math.round((readCount / total) * 1000) / 10 : null,
    recipients,
  };
}

async function insertNotifications(receivers, title, content, announcementId) {
  if (!receivers.length) return;
  const values = receivers.map((rid) => [rid, title, content, "ANNOUNCEMENT", "ANNOUNCEMENT", announcementId, false]);
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
    [values],
  );
}

module.exports = {
  create,
  findAll,
  findByCreator,
  findById,
  update,
  setStatus,
  setPinned,
  findDue,
  findReadReceipts,
  insertNotifications,
};
