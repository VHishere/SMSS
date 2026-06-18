const { pool } = require("../config/db");

// ── Permission & pickers ──────────────────────────────────────────────────────

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class WHERE teacher_id = ? AND class_id = ? LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

async function findTeacherClasses(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT sc.class_id AS classId, sc.class_name AS className, g.grade_name AS gradeName
     FROM teacher_class tc
     INNER JOIN school_class sc ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     WHERE tc.teacher_id = ?
     ORDER BY sc.class_name`,
    [teacherId],
  );
  return rows;
}

// Parents of a class (for inviting) — returns the parent's user_id + student.
async function findClassParents(classId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       pp.user_id    AS userId,
       pua.full_name AS parentName,
       sp.relationship,
       s.student_id  AS studentId,
       sua.full_name AS studentName
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
  return rows;
}

// ── Meetings ──────────────────────────────────────────────────────────────────

async function createMeeting(m) {
  const [result] = await pool.query(
    `INSERT INTO parent_meeting
       (class_id, student_id, teacher_id, meeting_type, title, meeting_date, end_time, location, content, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
    [m.classId, m.studentId ?? null, m.teacherId, m.meetingType ?? "CLASS", m.title,
     m.meetingDate, m.endTime ?? null, m.location ?? null, m.content ?? null, m.createdBy],
  );
  return result.insertId;
}

async function updateMeeting(meetingId, m) {
  const [result] = await pool.query(
    `UPDATE parent_meeting
     SET title = ?, meeting_type = ?, meeting_date = ?, end_time = ?, location = ?, content = ?, student_id = ?
     WHERE meeting_id = ? AND status NOT IN ('ARCHIVED','CANCELLED')`,
    [m.title, m.meetingType ?? "CLASS", m.meetingDate, m.endTime ?? null, m.location ?? null,
     m.content ?? null, m.studentId ?? null, meetingId],
  );
  return result.affectedRows;
}

async function setMeetingStatus(meetingId, status) {
  const [result] = await pool.query(
    `UPDATE parent_meeting SET status = ? WHERE meeting_id = ?`,
    [status, meetingId],
  );
  return result.affectedRows;
}

async function findMeetingById(meetingId) {
  const [[row]] = await pool.query(
    `SELECT
       pm.meeting_id   AS meetingId,
       pm.class_id     AS classId,
       pm.student_id   AS studentId,
       pm.teacher_id   AS teacherId,
       pm.meeting_type AS meetingType,
       pm.title,
       DATE_FORMAT(pm.meeting_date, '%Y-%m-%d %H:%i') AS meetingDate,
       DATE_FORMAT(pm.end_time, '%Y-%m-%d %H:%i')     AS endTime,
       pm.location,
       pm.content,
       pm.status,
       pm.created_by   AS createdBy,
       sc.class_name   AS className,
       sua.full_name   AS studentName
     FROM parent_meeting pm
     LEFT JOIN school_class sc ON sc.class_id = pm.class_id
     LEFT JOIN student s ON s.student_id = pm.student_id
     LEFT JOIN user_account sua ON sua.user_id = s.user_id
     WHERE pm.meeting_id = ?`,
    [meetingId],
  );
  return row || null;
}

async function findMeetingsByTeacher(teacherId, filters = {}) {
  const { status, classId, studentId, startDate, endDate, search, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [teacherId];
  let where = "pm.teacher_id = ?";
  if (status)    { where += " AND pm.status = ?";              params.push(status); }
  if (classId)   { where += " AND pm.class_id = ?";           params.push(parseInt(classId, 10)); }
  if (studentId) { where += " AND pm.student_id = ?";         params.push(parseInt(studentId, 10)); }
  if (startDate) { where += " AND DATE(pm.meeting_date) >= ?"; params.push(startDate); }
  if (endDate)   { where += " AND DATE(pm.meeting_date) <= ?"; params.push(endDate); }
  if (search)    { where += " AND pm.title LIKE ?";           params.push(`%${search}%`); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM parent_meeting pm WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       pm.meeting_id   AS meetingId,
       pm.title,
       pm.meeting_type AS meetingType,
       DATE_FORMAT(pm.meeting_date, '%Y-%m-%d %H:%i') AS meetingDate,
       DATE_FORMAT(pm.end_time, '%Y-%m-%d %H:%i')     AS endTime,
       pm.location, pm.status,
       sc.class_name AS className,
       sua.full_name AS studentName,
       (SELECT COUNT(*) FROM meeting_invitation mi WHERE mi.meeting_id = pm.meeting_id) AS inviteeCount,
       (SELECT COUNT(*) FROM meeting_invitation mi WHERE mi.meeting_id = pm.meeting_id AND mi.status = 'ACCEPTED') AS acceptedCount,
       (SELECT COUNT(*) FROM meeting_action ma WHERE ma.meeting_id = pm.meeting_id AND ma.status <> 'COMPLETED') AS openActions
     FROM parent_meeting pm
     LEFT JOIN school_class sc ON sc.class_id = pm.class_id
     LEFT JOIN student s ON s.student_id = pm.student_id
     LEFT JOIN user_account sua ON sua.user_id = s.user_id
     WHERE ${where}
     ORDER BY pm.meeting_date DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({
      ...r,
      inviteeCount: Number(r.inviteeCount),
      acceptedCount: Number(r.acceptedCount),
      openActions: Number(r.openActions),
    })),
  };
}

// ── Invitations ───────────────────────────────────────────────────────────────

async function addInvitations(meetingId, invitees) {
  if (!invitees.length) return;
  const values = invitees.map((i) => [meetingId, i.userId, i.studentId ?? null, "SENT"]);
  await pool.query(
    `INSERT INTO meeting_invitation (meeting_id, user_id, student_id, status) VALUES ?
     ON DUPLICATE KEY UPDATE status = 'SENT', invited_at = NOW(), responded_at = NULL`,
    [values],
  );
}

async function findInvitations(meetingId) {
  const [rows] = await pool.query(
    `SELECT
       mi.invitation_id AS invitationId,
       mi.user_id       AS userId,
       ua.full_name     AS name,
       ua.phone,
       mi.status,
       DATE_FORMAT(mi.invited_at, '%Y-%m-%d %H:%i')   AS invitedAt,
       DATE_FORMAT(mi.responded_at, '%Y-%m-%d %H:%i') AS respondedAt,
       sua.full_name AS studentName
     FROM meeting_invitation mi
     INNER JOIN user_account ua ON ua.user_id = mi.user_id
     LEFT JOIN student s ON s.student_id = mi.student_id
     LEFT JOIN user_account sua ON sua.user_id = s.user_id
     WHERE mi.meeting_id = ?
     ORDER BY ua.full_name`,
    [meetingId],
  );
  return rows;
}

async function resendInvitation(invitationId, meetingId) {
  const [result] = await pool.query(
    `UPDATE meeting_invitation SET status = 'SENT', invited_at = NOW(), responded_at = NULL
     WHERE invitation_id = ? AND meeting_id = ?`,
    [invitationId, meetingId],
  );
  return result.affectedRows;
}

async function findInvitationRecipients(meetingId) {
  const [rows] = await pool.query(
    `SELECT user_id AS userId FROM meeting_invitation WHERE meeting_id = ?`,
    [meetingId],
  );
  return rows.map((r) => r.userId);
}

// ── Minutes ───────────────────────────────────────────────────────────────────

async function findMinutes(meetingId) {
  const [[row]] = await pool.query(
    `SELECT
       minutes_id AS minutesId, meeting_id AS meetingId, discussion, agreements, decisions,
       is_submitted AS isSubmitted, DATE_FORMAT(submitted_at, '%Y-%m-%d %H:%i') AS submittedAt,
       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updatedAt
     FROM meeting_minutes WHERE meeting_id = ?`,
    [meetingId],
  );
  if (!row) return null;
  return { ...row, isSubmitted: Boolean(row.isSubmitted) };
}

async function upsertMinutes({ meetingId, discussion, agreements, decisions, submit, createdBy }) {
  await pool.query(
    `INSERT INTO meeting_minutes (meeting_id, discussion, agreements, decisions, is_submitted, submitted_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       discussion = VALUES(discussion),
       agreements = VALUES(agreements),
       decisions  = VALUES(decisions),
       is_submitted = VALUES(is_submitted),
       submitted_at = VALUES(submitted_at)`,
    [meetingId, discussion ?? null, agreements ?? null, decisions ?? null,
     submit ? 1 : 0, submit ? new Date() : null, createdBy],
  );
}

// ── Follow-up actions ─────────────────────────────────────────────────────────

async function createAction(a) {
  const [result] = await pool.query(
    `INSERT INTO meeting_action (meeting_id, title, description, assignee_user_id, deadline, status, created_by)
     VALUES (?, ?, ?, ?, ?, 'PENDING', ?)`,
    [a.meetingId, a.title, a.description ?? null, a.assigneeUserId ?? null, a.deadline, a.createdBy],
  );
  return result.insertId;
}

async function updateActionStatus(actionId, meetingId, status) {
  const [result] = await pool.query(
    `UPDATE meeting_action
     SET status = ?, completed_at = CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE NULL END
     WHERE action_id = ? AND meeting_id = ?`,
    [status, status, actionId, meetingId],
  );
  return result.affectedRows;
}

async function findActions(meetingId) {
  const [rows] = await pool.query(
    `SELECT
       ma.action_id AS actionId, ma.title, ma.description,
       ma.assignee_user_id AS assigneeUserId, ua.full_name AS assigneeName,
       DATE_FORMAT(ma.deadline, '%Y-%m-%d') AS deadline,
       ma.status,
       DATE_FORMAT(ma.completed_at, '%Y-%m-%d %H:%i') AS completedAt,
       (ma.status <> 'COMPLETED' AND ma.deadline < CURDATE()) AS isOverdue
     FROM meeting_action ma
     LEFT JOIN user_account ua ON ua.user_id = ma.assignee_user_id
     WHERE ma.meeting_id = ?
     ORDER BY ma.deadline ASC`,
    [meetingId],
  );
  return rows.map((r) => ({ ...r, isOverdue: Boolean(r.isOverdue) }));
}

async function findActionById(actionId) {
  const [[row]] = await pool.query(
    `SELECT action_id AS actionId, meeting_id AS meetingId, assignee_user_id AS assigneeUserId, title
     FROM meeting_action WHERE action_id = ?`,
    [actionId],
  );
  return row || null;
}

// ── Audit log ─────────────────────────────────────────────────────────────────

async function log(meetingId, action, detail, changedBy) {
  await pool.query(
    `INSERT INTO meeting_log (meeting_id, action, detail, changed_by) VALUES (?, ?, ?, ?)`,
    [meetingId, action, detail ?? null, changedBy],
  );
}

async function findLog(meetingId) {
  const [rows] = await pool.query(
    `SELECT ml.action, ml.detail, DATE_FORMAT(ml.created_at, '%Y-%m-%d %H:%i') AS createdAt, ua.full_name AS changedByName
     FROM meeting_log ml INNER JOIN user_account ua ON ua.user_id = ml.changed_by
     WHERE ml.meeting_id = ? ORDER BY ml.created_at DESC`,
    [meetingId],
  );
  return rows;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

async function dashboardStats(teacherId, userId) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM parent_meeting WHERE teacher_id = ? AND status = 'SCHEDULED' AND meeting_date >= NOW()) AS upcoming,
       (SELECT COUNT(*) FROM meeting_invitation mi
         INNER JOIN parent_meeting pm ON pm.meeting_id = mi.meeting_id
         WHERE pm.teacher_id = ? AND mi.status IN ('SENT','PENDING')) AS pendingInvites,
       (SELECT COUNT(*) FROM meeting_action ma
         INNER JOIN parent_meeting pm ON pm.meeting_id = ma.meeting_id
         WHERE pm.teacher_id = ? AND ma.status <> 'COMPLETED') AS openActions,
       (SELECT COUNT(*) FROM parent_meeting WHERE teacher_id = ?) AS totalMeetings`,
    [teacherId, teacherId, teacherId, teacherId],
  );
  return {
    upcoming: Number(row.upcoming),
    pendingInvites: Number(row.pendingInvites),
    openActions: Number(row.openActions),
    totalMeetings: Number(row.totalMeetings),
  };
}

module.exports = {
  isTeacherForClass,
  findTeacherClasses,
  findClassParents,
  createMeeting,
  updateMeeting,
  setMeetingStatus,
  findMeetingById,
  findMeetingsByTeacher,
  addInvitations,
  findInvitations,
  resendInvitation,
  findInvitationRecipients,
  findMinutes,
  upsertMinutes,
  createAction,
  updateActionStatus,
  findActions,
  findActionById,
  log,
  findLog,
  dashboardStats,
};
