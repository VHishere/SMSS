const { pool } = require("../config/db");

// ── List leave requests owned by a teacher (their assigned classes) ───────────

async function findByTeacher(teacherId, filters = {}) {
  const {
    status,
    classId,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 20,
  } = filters;

  const offset = (page - 1) * limit;
  const params = [teacherId];
  let where = "";

  if (status) {
    where += " AND lr.status = ?";
    params.push(status);
  }

  if (classId) {
    where += " AND sc.class_id = ?";
    params.push(parseInt(classId, 10));
  }

  // Overlap with [startDate, endDate] on the requested leave window
  if (startDate) {
    where += " AND DATE(lr.end_date) >= ?";
    params.push(startDate);
  }
  if (endDate) {
    where += " AND DATE(lr.start_date) <= ?";
    params.push(endDate);
  }

  if (search) {
    where += " AND (sua.full_name LIKE ? OR s.student_code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM leave_request lr
     INNER JOIN student s
       ON s.student_id = lr.student_id
     INNER JOIN user_account sua
       ON sua.user_id = s.user_id
     LEFT JOIN class_enrollment ce
       ON ce.student_id = s.student_id
       AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.status = 'ACTIVE'
     WHERE lr.homeroom_teacher_id = ?
       ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       lr.leave_request_id                          AS leaveRequestId,
       lr.leave_type                                AS leaveType,
       DATE_FORMAT(lr.start_date, '%Y-%m-%d %H:%i') AS startDate,
       DATE_FORMAT(lr.end_date,   '%Y-%m-%d %H:%i') AS endDate,
       lr.reason,
       lr.status,
       DATE_FORMAT(lr.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       lr.attachment_id                             AS attachmentId,

       s.student_id                                 AS studentId,
       s.student_code                               AS studentCode,
       sua.full_name                                AS studentName,
       sua.avatar                                   AS studentAvatar,

       sc.class_id                                  AS classId,
       sc.class_name                                AS className,

       pua.full_name                                AS parentName,
       pua.phone                                    AS parentPhone
     FROM leave_request lr
     INNER JOIN student s
       ON s.student_id = lr.student_id
     INNER JOIN user_account sua
       ON sua.user_id = s.user_id
     LEFT JOIN class_enrollment ce
       ON ce.student_id = s.student_id
       AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.status = 'ACTIVE'
     LEFT JOIN parent_profile pp
       ON pp.parent_id = lr.parent_id
     LEFT JOIN user_account pua
       ON pua.user_id = pp.user_id
     WHERE lr.homeroom_teacher_id = ?
       ${where}
     ORDER BY
       CASE lr.status WHEN 'PENDING' THEN 0 ELSE 1 END ASC,
       lr.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total: Number(total), rows };
}

// ── Full detail of a single request (with attachment + approval history) ──────

async function findDetailById(leaveRequestId) {
  const [[row]] = await pool.query(
    `SELECT
       lr.leave_request_id                                 AS leaveRequestId,
       lr.leave_type                                       AS leaveType,
       DATE_FORMAT(lr.start_date, '%Y-%m-%d %H:%i')        AS startDate,
       DATE_FORMAT(lr.end_date,   '%Y-%m-%d %H:%i')        AS endDate,
       lr.reason,
       lr.status,
       lr.homeroom_teacher_id                              AS homeroomTeacherId,
       DATE_FORMAT(lr.created_at, '%Y-%m-%d %H:%i')        AS createdAt,

       s.student_id                                        AS studentId,
       s.student_code                                      AS studentCode,
       s.user_id                                           AS studentUserId,
       sua.full_name                                       AS studentName,
       sua.avatar                                          AS studentAvatar,
       DATE_FORMAT(s.date_of_birth, '%Y-%m-%d')            AS studentDob,
       s.gender                                            AS studentGender,

       sc.class_id                                         AS classId,
       sc.class_name                                       AS className,
       sc.room_name                                        AS roomName,
       g.grade_name                                        AS gradeName,

       pp.parent_id                                        AS parentId,
       pp.user_id                                          AS parentUserId,
       pp.relationship                                     AS parentRelationship,
       pua.full_name                                       AS parentName,
       pua.phone                                           AS parentPhone,
       pua.email                                           AS parentEmail,

       att.attachment_id                                   AS attachmentId,
       att.file_name                                       AS attachmentName,
       att.file_url                                        AS attachmentUrl,
       att.file_type                                       AS attachmentType
     FROM leave_request lr
     INNER JOIN student s
       ON s.student_id = lr.student_id
     INNER JOIN user_account sua
       ON sua.user_id = s.user_id
     LEFT JOIN class_enrollment ce
       ON ce.student_id = s.student_id
       AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.status = 'ACTIVE'
     LEFT JOIN grade g
       ON g.grade_id = sc.grade_id
     LEFT JOIN parent_profile pp
       ON pp.parent_id = lr.parent_id
     LEFT JOIN user_account pua
       ON pua.user_id = pp.user_id
     LEFT JOIN attachment att
       ON att.attachment_id = lr.attachment_id
     WHERE lr.leave_request_id = ?`,
    [leaveRequestId],
  );

  if (!row) return null;

  const [history] = await pool.query(
    `SELECT
       la.approval_id                               AS approvalId,
       la.action,
       la.role,
       la.comment,
       DATE_FORMAT(la.approval_time, '%Y-%m-%d %H:%i') AS approvalTime,
       ua.full_name                                 AS approverName
     FROM leave_approval la
     INNER JOIN user_account ua
       ON ua.user_id = la.approver_id
     WHERE la.leave_request_id = ?
     ORDER BY la.approval_time ASC`,
    [leaveRequestId],
  );

  return { ...row, approvalHistory: history };
}

// ── Status counts for the teacher (for tab badges) ────────────────────────────

async function countByStatusForTeacher(teacherId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS count
     FROM leave_request
     WHERE homeroom_teacher_id = ?
     GROUP BY status`,
    [teacherId],
  );

  const counts = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const r of rows) {
    if (counts[r.status] !== undefined) counts[r.status] = Number(r.count);
  }
  return counts;
}

// ── Teacher's classes (for the class filter dropdown) ─────────────────────────

async function findTeacherClassesForFilter(teacherId) {
  const [rows] = await pool.query(
    `SELECT
       sc.class_id   AS classId,
       sc.class_name AS className
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id
       AND sc.status = 'ACTIVE'
     WHERE tc.teacher_id = ?
     ORDER BY sc.class_name ASC`,
    [teacherId],
  );
  return rows;
}

// ── Transactional decision (approve / reject) ─────────────────────────────────
// Returns the affected row count from the conditional UPDATE so the service
// can enforce "only PENDING can be modified" by checking it equals 1.

async function applyDecision({
  leaveRequestId,
  newStatus,
  approverUserId,
  role,
  action,
  comment,
  notifications,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Guard: only flip PENDING → APPROVED/REJECTED
    const [result] = await conn.query(
      `UPDATE leave_request
       SET status = ?
       WHERE leave_request_id = ?
         AND status = 'PENDING'`,
      [newStatus, leaveRequestId],
    );

    if (result.affectedRows !== 1) {
      await conn.rollback();
      return { updated: false };
    }

    // Audit log (leave_approval is the action trail)
    await conn.query(
      `INSERT INTO leave_approval
         (leave_request_id, approver_id, role, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [leaveRequestId, approverUserId, role, action, comment],
    );

    // Notifications to student / parent / homeroom teacher
    if (notifications.length > 0) {
      const values = notifications.map((n) => [
        n.receiverId,
        n.title,
        n.content,
        "LEAVE",
        "LEAVE_REQUEST",
        leaveRequestId,
        false,
      ]);

      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [values],
      );
    }

    await conn.commit();
    return { updated: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Resolve the homeroom teacher's user_id for notification ───────────────────

async function findTeacherUserId(teacherId) {
  const [[row]] = await pool.query(
    `SELECT user_id AS userId FROM teacher WHERE teacher_id = ?`,
    [teacherId],
  );
  return row ? row.userId : null;
}

module.exports = {
  findByTeacher,
  findDetailById,
  countByStatusForTeacher,
  findTeacherClassesForFilter,
  applyDecision,
  findTeacherUserId,
};
