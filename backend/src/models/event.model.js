const { pool } = require("../config/db");

// ── Permission & pickers ──────────────────────────────────────────────────────

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN school_class sc ON sc.class_id = tc.class_id
     INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
     WHERE tc.teacher_id = ?
       AND tc.class_id = ?
       AND sc.status = 'ACTIVE'
       AND sy.is_active = 1
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

async function findTeacherClasses(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT sc.class_id AS classId, sc.class_name AS className, g.grade_name AS gradeName
     FROM teacher_class tc
     INNER JOIN school_class sc ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     WHERE tc.teacher_id = ?
       AND sy.is_active = 1
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     ORDER BY sc.class_name`,
    [teacherId],
  );
  return rows;
}

// Class contacts for adding participants (students + parents).
async function findClassContacts(classId) {
  const [students] = await pool.query(
    `SELECT s.student_id AS studentId, s.user_id AS userId, ua.full_name AS name, s.student_code AS code
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name`,
    [classId],
  );
  const [parents] = await pool.query(
    `SELECT DISTINCT pp.user_id AS userId, pua.full_name AS name, sua.full_name AS studentName, s.student_id AS studentId
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account sua ON sua.user_id = s.user_id
     INNER JOIN student_parent sp ON sp.student_id = s.student_id
     INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
     INNER JOIN user_account pua ON pua.user_id = pp.user_id AND pua.status = 'ACTIVE'
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY sua.full_name`,
    [classId],
  );
  return { students, parents };
}

// ── Events CRUD ───────────────────────────────────────────────────────────────

async function createEvent(e) {
  const [result] = await pool.query(
    `INSERT INTO event
       (title, event_type, category, class_id, description, start_date, end_date, location, organizer, capacity, created_by, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
    [e.title, e.eventType ?? null, e.category ?? null, e.classId ?? null, e.description ?? null,
     e.startDate, e.endDate ?? null, e.location ?? null, e.organizer ?? null, e.capacity ?? null, e.createdBy],
  );
  return result.insertId;
}

async function updateEvent(eventId, e) {
  const [result] = await pool.query(
    `UPDATE event
     SET title = ?, event_type = ?, category = ?, class_id = ?, description = ?,
         start_date = ?, end_date = ?, location = ?, organizer = ?, capacity = ?
     WHERE event_id = ? AND status NOT IN ('CANCELLED','ARCHIVED')`,
    [e.title, e.eventType ?? null, e.category ?? null, e.classId ?? null, e.description ?? null,
     e.startDate, e.endDate ?? null, e.location ?? null, e.organizer ?? null, e.capacity ?? null, eventId],
  );
  return result.affectedRows;
}

async function setStatus(eventId, status) {
  const [result] = await pool.query(`UPDATE event SET status = ? WHERE event_id = ?`, [status, eventId]);
  return result.affectedRows;
}

async function saveOutcome({ eventId, outcome, submit }) {
  const [result] = await pool.query(
    `UPDATE event
     SET outcome = ?, outcome_submitted = ?, outcome_submitted_at = CASE WHEN ? THEN NOW() ELSE outcome_submitted_at END
     WHERE event_id = ?`,
    [outcome ?? null, submit ? 1 : 0, submit ? 1 : 0, eventId],
  );
  return result.affectedRows;
}

async function findById(eventId) {
  const [[row]] = await pool.query(
    `SELECT
       e.event_id AS eventId, e.title, e.event_type AS eventType, e.category, e.class_id AS classId,
       e.description,
       DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
       DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i')   AS endDate,
       e.location, e.organizer, e.capacity, e.status,
       e.outcome, e.outcome_submitted AS outcomeSubmitted,
       DATE_FORMAT(e.outcome_submitted_at, '%Y-%m-%d %H:%i') AS outcomeSubmittedAt,
       e.created_by AS createdBy, sc.class_name AS className
     FROM event e
     LEFT JOIN school_class sc ON sc.class_id = e.class_id
     WHERE e.event_id = ?`,
    [eventId],
  );
  if (!row) return null;
  return { ...row, outcomeSubmitted: Boolean(row.outcomeSubmitted) };
}

async function findEvents(userId, teacherClassIds, filters = {}) {
  const { status, category, classId, startDate, endDate, search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  // Visible: created by me OR a class event of my class OR school-wide (class_id NULL)
  const classScope = teacherClassIds.length ? `OR e.class_id IN (${teacherClassIds.map(() => "?").join(",")})` : "";
  const params = [userId, ...teacherClassIds];
  let where = `(e.created_by = ? ${classScope} OR e.class_id IS NULL)`;

  if (status)    { where += " AND e.status = ?";            params.push(status); }
  if (category)  { where += " AND e.category = ?";          params.push(category); }
  if (classId)   { where += " AND e.class_id = ?";          params.push(parseInt(classId, 10)); }
  if (startDate) { where += " AND DATE(e.start_date) >= ?"; params.push(startDate); }
  if (endDate)   { where += " AND DATE(e.start_date) <= ?"; params.push(endDate); }
  if (search)    { where += " AND e.title LIKE ?";          params.push(`%${search}%`); }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM event e WHERE ${where}`, params);

  const [rows] = await pool.query(
    `SELECT
       e.event_id AS eventId, e.title, e.category, e.event_type AS eventType,
       DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
       DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i')   AS endDate,
       e.location, e.status, e.capacity, e.created_by AS createdBy,
       sc.class_name AS className,
       (SELECT COUNT(*) FROM event_registration er WHERE er.event_id = e.event_id) AS participantCount,
       (SELECT COUNT(*) FROM event_registration er WHERE er.event_id = e.event_id AND er.attend_status IN ('PRESENT','LATE')) AS attendedCount
     FROM event e
     LEFT JOIN school_class sc ON sc.class_id = e.class_id
     WHERE ${where}
     ORDER BY e.start_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({ ...r, participantCount: Number(r.participantCount), attendedCount: Number(r.attendedCount) })),
  };
}

// Admin: every event school-wide, no created_by/class ownership filter.
async function findAllEvents(filters = {}) {
  const { status, category, classId, startDate, endDate, search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;

  const params = [];
  let where = "1=1";
  if (status)    { where += " AND e.status = ?";            params.push(status); }
  if (category)  { where += " AND e.category = ?";          params.push(category); }
  if (classId)   { where += " AND e.class_id = ?";          params.push(parseInt(classId, 10)); }
  if (startDate) { where += " AND DATE(e.start_date) >= ?"; params.push(startDate); }
  if (endDate)   { where += " AND DATE(e.start_date) <= ?"; params.push(endDate); }
  if (search)    { where += " AND e.title LIKE ?";          params.push(`%${search}%`); }

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM event e WHERE ${where}`, params);

  const [rows] = await pool.query(
    `SELECT
       e.event_id AS eventId, e.title, e.category, e.event_type AS eventType,
       DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
       DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i')   AS endDate,
       e.location, e.status, e.capacity, e.created_by AS createdBy,
       sc.class_name AS className,
       (SELECT COUNT(*) FROM event_registration er WHERE er.event_id = e.event_id) AS participantCount,
       (SELECT COUNT(*) FROM event_registration er WHERE er.event_id = e.event_id AND er.attend_status IN ('PRESENT','LATE')) AS attendedCount
     FROM event e
     LEFT JOIN school_class sc ON sc.class_id = e.class_id
     WHERE ${where}
     ORDER BY e.start_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({ ...r, participantCount: Number(r.participantCount), attendedCount: Number(r.attendedCount) })),
  };
}

async function dashboardStatsAll() {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM event WHERE status = 'ACTIVE' AND start_date > NOW()) AS upcoming,
       (SELECT COUNT(*) FROM event WHERE status = 'ACTIVE' AND start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW())) AS ongoing,
       (SELECT COUNT(*) FROM event WHERE status = 'COMPLETED') AS completed,
       (SELECT COUNT(*) FROM event) AS total`,
  );
  return {
    upcoming: Number(row.upcoming), ongoing: Number(row.ongoing),
    completed: Number(row.completed), total: Number(row.total),
  };
}

async function analyticsAll() {
  const [byCategory] = await pool.query(
    `SELECT COALESCE(category, 'KHÁC') AS category, COUNT(*) AS count FROM event GROUP BY category`,
  );
  const [byMonth] = await pool.query(
    `SELECT DATE_FORMAT(start_date, '%Y-%m') AS month, COUNT(*) AS count
     FROM event GROUP BY DATE_FORMAT(start_date, '%Y-%m') ORDER BY month ASC`,
  );
  const [[totals]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM event_registration) AS totalParticipants,
       (SELECT COUNT(*) FROM event_registration WHERE attend_status IN ('PRESENT','LATE')) AS totalAttended
     FROM dual`,
  );
  return {
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    byMonth: byMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
    totalParticipants: Number(totals.totalParticipants),
    totalAttended: Number(totals.totalAttended),
  };
}

// ── Participants & attendance ─────────────────────────────────────────────────

async function addParticipants(eventId, participants, registeredBy) {
  if (!participants.length) return;
  const values = participants.map((p) => [eventId, p.userId, p.participantType, p.studentId ?? null, registeredBy, "REGISTERED"]);
  await pool.query(
    `INSERT INTO event_registration (event_id, user_id, participant_type, student_id, registered_by, attend_status)
     VALUES ?
     ON DUPLICATE KEY UPDATE participant_type = VALUES(participant_type), student_id = VALUES(student_id)`,
    [values],
  );
}

async function removeParticipant(eventId, registrationId) {
  const [result] = await pool.query(
    `DELETE FROM event_registration WHERE registration_id = ? AND event_id = ?`,
    [registrationId, eventId],
  );
  return result.affectedRows;
}

async function findParticipants(eventId) {
  const [rows] = await pool.query(
    `SELECT
       er.registration_id AS registrationId,
       er.user_id AS userId,
       er.participant_type AS participantType,
       er.attend_status AS attendStatus,
       er.note,
       ua.full_name AS name,
       sua.full_name AS studentName
     FROM event_registration er
     LEFT JOIN user_account ua ON ua.user_id = er.user_id
     LEFT JOIN student s ON s.student_id = er.student_id
     LEFT JOIN user_account sua ON sua.user_id = s.user_id
     WHERE er.event_id = ?
     ORDER BY er.participant_type, ua.full_name`,
    [eventId],
  );
  return rows;
}

async function findParticipantRecipients(eventId) {
  const [rows] = await pool.query(
    `SELECT user_id AS userId FROM event_registration WHERE event_id = ? AND user_id IS NOT NULL`,
    [eventId],
  );
  return rows.map((r) => r.userId);
}

async function updateAttendance(eventId, registrationId, status) {
  const [result] = await pool.query(
    `UPDATE event_registration SET attend_status = ? WHERE registration_id = ? AND event_id = ?`,
    [status, registrationId, eventId],
  );
  return result.affectedRows;
}

// ── Documents (attachment) ────────────────────────────────────────────────────

async function insertDocument({ eventId, fileName, fileUrl, fileType, uploadedBy }) {
  const [result] = await pool.query(
    `INSERT INTO attachment (related_type, related_id, file_name, file_url, file_type, uploaded_by)
     VALUES ('EVENT', ?, ?, ?, ?, ?)`,
    [eventId, fileName, fileUrl, fileType, uploadedBy],
  );
  return result.insertId;
}

async function findDocuments(eventId) {
  const [rows] = await pool.query(
    `SELECT attachment_id AS attachmentId, file_name AS fileName, file_url AS fileUrl, file_type AS fileType,
       DATE_FORMAT(uploaded_at, '%Y-%m-%d %H:%i') AS uploadedAt
     FROM attachment WHERE related_type = 'EVENT' AND related_id = ? ORDER BY attachment_id DESC`,
    [eventId],
  );
  return rows;
}

async function deleteDocument(attachmentId, eventId) {
  const [result] = await pool.query(
    `DELETE FROM attachment WHERE attachment_id = ? AND related_type = 'EVENT' AND related_id = ?`,
    [attachmentId, eventId],
  );
  return result.affectedRows;
}

// ── Log ───────────────────────────────────────────────────────────────────────

async function log(eventId, action, detail, changedBy) {
  await pool.query(
    `INSERT INTO event_log (event_id, action, detail, changed_by) VALUES (?, ?, ?, ?)`,
    [eventId, action, detail ?? null, changedBy],
  );
}

async function findLog(eventId) {
  const [rows] = await pool.query(
    `SELECT el.action, el.detail, DATE_FORMAT(el.created_at, '%Y-%m-%d %H:%i') AS createdAt, ua.full_name AS changedByName
     FROM event_log el INNER JOIN user_account ua ON ua.user_id = el.changed_by
     WHERE el.event_id = ? ORDER BY el.created_at DESC`,
    [eventId],
  );
  return rows;
}

// ── Dashboard & analytics ─────────────────────────────────────────────────────

async function dashboardStats(userId) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM event WHERE created_by = ? AND status = 'ACTIVE' AND start_date > NOW()) AS upcoming,
       (SELECT COUNT(*) FROM event WHERE created_by = ? AND status = 'ACTIVE' AND start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW())) AS ongoing,
       (SELECT COUNT(*) FROM event WHERE created_by = ? AND status = 'COMPLETED') AS completed,
       (SELECT COUNT(*) FROM event WHERE created_by = ?) AS total`,
    [userId, userId, userId, userId],
  );
  return {
    upcoming: Number(row.upcoming), ongoing: Number(row.ongoing),
    completed: Number(row.completed), total: Number(row.total),
  };
}

async function analytics(userId) {
  const [byCategory] = await pool.query(
    `SELECT COALESCE(category, 'KHÁC') AS category, COUNT(*) AS count
     FROM event WHERE created_by = ? GROUP BY category`,
    [userId],
  );
  const [byMonth] = await pool.query(
    `SELECT DATE_FORMAT(start_date, '%Y-%m') AS month, COUNT(*) AS count
     FROM event WHERE created_by = ? GROUP BY DATE_FORMAT(start_date, '%Y-%m') ORDER BY month ASC`,
    [userId],
  );
  const [[totals]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM event_registration er INNER JOIN event e ON e.event_id = er.event_id WHERE e.created_by = ?) AS totalParticipants,
       (SELECT COUNT(*) FROM event_registration er INNER JOIN event e ON e.event_id = er.event_id WHERE e.created_by = ? AND er.attend_status IN ('PRESENT','LATE')) AS totalAttended
     FROM dual`,
    [userId, userId],
  );
  return {
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    byMonth: byMonth.map((r) => ({ month: r.month, count: Number(r.count) })),
    totalParticipants: Number(totals.totalParticipants),
    totalAttended: Number(totals.totalAttended),
  };
}

module.exports = {
  isTeacherForClass,
  findTeacherClasses,
  findClassContacts,
  createEvent,
  updateEvent,
  setStatus,
  saveOutcome,
  findById,
  findEvents,
  findAllEvents,
  dashboardStatsAll,
  analyticsAll,
  addParticipants,
  removeParticipant,
  findParticipants,
  findParticipantRecipients,
  updateAttendance,
  insertDocument,
  findDocuments,
  deleteDocument,
  log,
  findLog,
  dashboardStats,
  analytics,
};
