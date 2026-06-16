const { pool } = require("../config/db");

const LEAVE_TYPES = ["SICK_LEAVE", "FAMILY_LEAVE", "OTHER"];

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

module.exports = {
  LEAVE_TYPES,
  findHomeroomTeacherUserIdByClassId,
  create,
  attachFile,
  notifyHomeroomTeacher,
  findByStudentId,
  findById,
  cancelPending,
};
