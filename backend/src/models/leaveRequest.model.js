const { pool } = require("../config/db");

const LEAVE_TYPES = ["SICK_LEAVE", "FAMILY_LEAVE", "OTHER"];

// ── Parent / Student side ─────────────────────────────────────────────────────

async function findHomeroomTeacherUserIdByClassId(classId) {
  const [rows] = await pool.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        ua.user_id   AS userId
      FROM teacher_class tc
      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
      WHERE tc.class_id = ?
        AND tc.role_in_class = 'HOMEROOM_TEACHER'
        AND tc.end_date IS NULL
      LIMIT 1
    `,
    [classId],
  );

  return rows[0] || null;
}

async function create({ studentId, parentId, homeroomTeacherId, leaveType, startDate, endDate, reason }) {
  const [result] = await pool.query(
    `
      INSERT INTO leave_request
        (student_id, parent_id, homeroom_teacher_id, leave_type, start_date, end_date, reason, status)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `,
    [studentId, parentId, homeroomTeacherId, leaveType, startDate, endDate, reason],
  );

  return result.insertId;
}

async function attachFile(leaveRequestId, attachmentId) {
  await pool.query(
    `UPDATE leave_request SET attachment_id = ? WHERE leave_request_id = ?`,
    [attachmentId, leaveRequestId],
  );
}

async function notifyHomeroomTeacher(receiverUserId, { leaveRequestId, studentName, startDate, endDate }) {
  if (!receiverUserId) return;

  await pool.query(
    `
      INSERT INTO notification
        (receiver_id, title, content, type, related_type, related_id)
      VALUES
        (?, ?, ?, 'LEAVE', 'LEAVE_REQUEST', ?)
    `,
    [
      receiverUserId,
      "Đơn xin nghỉ mới",
      `Phụ huynh đã gửi đơn xin nghỉ cho ${studentName} từ ${startDate} đến ${endDate}.`,
      leaveRequestId,
    ],
  );
}

async function findByStudentId(studentId, filters = {}) {
  const { page = 1, limit = 20, status } = filters;
  const offset = (page - 1) * limit;

  const baseParams = [studentId];
  let where = "";

  if (status) {
    where += " AND lr.status = ?";
    baseParams.push(status);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM leave_request lr WHERE lr.student_id = ? ${where}`,
    baseParams,
  );

  const [rows] = await pool.query(
    `
      SELECT
        lr.leave_request_id AS leaveRequestId,
        lr.leave_type        AS leaveType,
        lr.start_date         AS startDate,
        lr.end_date           AS endDate,
        lr.reason,
        lr.status,
        lr.created_at         AS createdAt,

        ht.teacher_id         AS homeroomTeacherId,
        hua.full_name         AS homeroomTeacherName,

        att.attachment_id     AS attachmentId,
        att.file_name         AS attachmentFileName,
        att.file_url          AS attachmentFileUrl,
        att.file_type         AS attachmentFileType

      FROM leave_request lr
      LEFT JOIN teacher ht
        ON ht.teacher_id = lr.homeroom_teacher_id
      LEFT JOIN user_account hua
        ON hua.user_id = ht.user_id
      LEFT JOIN attachment att
        ON att.attachment_id = lr.attachment_id
      WHERE lr.student_id = ?
        ${where}
      ORDER BY
        lr.created_at DESC
      LIMIT ? OFFSET ?
    `,
    [...baseParams, limit, offset],
  );

  return { total: Number(total), rows };
}

async function findById(leaveRequestId) {
  const [rows] = await pool.query(
    `
      SELECT
        lr.leave_request_id   AS leaveRequestId,
        lr.student_id          AS studentId,
        lr.parent_id            AS parentId,
        lr.leave_type            AS leaveType,
        lr.start_date             AS startDate,
        lr.end_date               AS endDate,
        lr.reason,
        lr.status,
        lr.created_at             AS createdAt,

        ht.teacher_id              AS homeroomTeacherId,
        hua.full_name               AS homeroomTeacherName,

        att.attachment_id           AS attachmentId,
        att.file_name               AS attachmentFileName,
        att.file_url                AS attachmentFileUrl,
        att.file_type                AS attachmentFileType

      FROM leave_request lr
      LEFT JOIN teacher ht
        ON ht.teacher_id = lr.homeroom_teacher_id
      LEFT JOIN user_account hua
        ON hua.user_id = ht.user_id
      LEFT JOIN attachment att
        ON att.attachment_id = lr.attachment_id
      WHERE lr.leave_request_id = ?
      LIMIT 1
    `,
    [leaveRequestId],
  );

  const leaveRequest = rows[0];
  if (!leaveRequest) return null;

  const [approvals] = await pool.query(
    `
      SELECT
        la.approval_id     AS approvalId,
        la.approver_id      AS approverId,
        ua.full_name          AS approverName,
        la.role,
        la.action,
        la.approval_time       AS approvalTime,
        la.comment
      FROM leave_approval la
      INNER JOIN user_account ua
        ON ua.user_id = la.approver_id
      WHERE la.leave_request_id = ?
      ORDER BY la.approval_time ASC
    `,
    [leaveRequestId],
  );

  return { ...leaveRequest, approvals };
}

async function cancelPending(leaveRequestId) {
  const [result] = await pool.query(
    `
      UPDATE leave_request
      SET status = 'CANCELLED'
      WHERE leave_request_id = ?
        AND status = 'PENDING'
    `,
    [leaveRequestId],
  );

  return result.affectedRows > 0;
}

// ── Teacher side ──────────────────────────────────────────────────────────────

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

    await conn.query(
      `INSERT INTO leave_approval
         (leave_request_id, approver_id, role, action, comment)
       VALUES (?, ?, ?, ?, ?)`,
      [leaveRequestId, approverUserId, role, action, comment],
    );

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

async function findTeacherUserId(teacherId) {
  const [[row]] = await pool.query(
    `SELECT user_id AS userId FROM teacher WHERE teacher_id = ?`,
    [teacherId],
  );
  return row ? row.userId : null;
}

module.exports = {
  LEAVE_TYPES,
  findHomeroomTeacherUserIdByClassId,
  create,
  attachFile,
  notifyHomeroomTeacher,
  findByStudentId,
  findById,
  cancelPending,
  findByTeacher,
  findDetailById,
  countByStatusForTeacher,
  findTeacherClassesForFilter,
  applyDecision,
  findTeacherUserId,
};