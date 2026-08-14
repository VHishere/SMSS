const { pool } = require("../config/db");

// ── Read ──────────────────────────────────────────────────────────────────────

async function findByStudent(studentId, filters = {}) {
  const { status, goalType } = filters;
  const params = [studentId];
  let where = "sg.student_id = ?";

  // Keep legacy status filtering for admin/parent/report compatibility.
  // Student/teacher Goal UI no longer uses goal progress/status.
  if (status) {
    where += " AND sg.status = ?";
    params.push(status);
  }
  if (goalType) {
    where += " AND sg.goal_type = ?";
    params.push(goalType);
  }

  const [rows] = await pool.query(
    `SELECT
       sg.goal_id        AS goalId,
       sg.goal_type      AS goalType,
       sg.title,
       sg.description,
       DATE_FORMAT(sg.target_date, '%Y-%m-%d') AS targetDate,
       sg.progress,
       sg.status,
       sg.teacher_remark AS teacherRemark,
       sg.final_comment  AS finalComment,
       DATE_FORMAT(sg.created_at, '%Y-%m-%d') AS createdAt,
       DATE_FORMAT(sg.updated_at, '%Y-%m-%d %H:%i') AS updatedAt
     FROM student_goal sg
     WHERE ${where}
     ORDER BY
       CASE WHEN sg.target_date IS NULL THEN 1 ELSE 0 END,
       sg.target_date ASC,
       sg.updated_at DESC,
       sg.goal_id DESC`,
    params,
  );

  return rows.map((row) => ({
    ...row,
    progress: Number(row.progress ?? 0),
  }));
}

async function findByClass(classId, filters = {}) {
  const { status, goalType, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [classId];
  let where = "ce.class_id = ? AND ce.status = 'ACTIVE'";

  // Status remains accepted only for backward compatibility with old reports.
  if (status) {
    where += " AND sg.status = ?";
    params.push(status);
  }
  if (goalType) {
    where += " AND sg.goal_type = ?";
    params.push(goalType);
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM student_goal sg
     INNER JOIN class_enrollment ce
       ON ce.student_id = sg.student_id
      AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       sg.goal_id        AS goalId,
       sg.goal_type      AS goalType,
       sg.title,
       sg.description,
       DATE_FORMAT(sg.target_date, '%Y-%m-%d') AS targetDate,
       sg.progress,
       sg.status,
       sg.teacher_remark AS teacherRemark,
       sg.final_comment  AS finalComment,
       s.student_id      AS studentId,
       s.student_code    AS studentCode,
       ua.full_name      AS studentName,
       ua.avatar         AS studentAvatar,
       DATE_FORMAT(sg.created_at, '%Y-%m-%d') AS createdAt,
       DATE_FORMAT(sg.updated_at, '%Y-%m-%d %H:%i') AS updatedAt
     FROM student_goal sg
     INNER JOIN class_enrollment ce
       ON ce.student_id = sg.student_id
      AND ce.status = 'ACTIVE'
     INNER JOIN student s ON s.student_id = sg.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     WHERE ${where}
     ORDER BY
       CASE WHEN sg.target_date IS NULL THEN 1 ELSE 0 END,
       sg.target_date ASC,
       ua.full_name ASC,
       sg.goal_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((row) => ({
      ...row,
      progress: Number(row.progress ?? 0),
    })),
  };
}

async function findById(goalId) {
  const [[row]] = await pool.query(
    `SELECT
       sg.goal_id        AS goalId,
       sg.student_id     AS studentId,
       sg.goal_type      AS goalType,
       sg.title,
       sg.description,
       DATE_FORMAT(sg.target_date, '%Y-%m-%d') AS targetDate,
       sg.progress,
       sg.status,
       sg.teacher_remark AS teacherRemark,
       sg.final_comment  AS finalComment,
       s.user_id         AS studentUserId
     FROM student_goal sg
     INNER JOIN student s ON s.student_id = sg.student_id
     WHERE sg.goal_id = ?`,
    [goalId],
  );

  if (!row) return null;

  return {
    ...row,
    progress: Number(row.progress ?? 0),
  };
}

// ── Student-owned Goal writes ─────────────────────────────────────────────────

async function createGoal(goal) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO student_goal
         (student_id, goal_type, title, description, target_date, progress, status, teacher_remark, created_by)
       VALUES (?, ?, ?, ?, ?, 0, 'IN_PROGRESS', NULL, ?)`,
      [
        goal.studentId,
        goal.goalType,
        goal.title,
        goal.description ?? null,
        goal.targetDate ?? null,
        goal.createdBy,
      ],
    );

    const goalId = result.insertId;

    await conn.query(
      `INSERT INTO student_goal_log
         (goal_id, action, old_progress, new_progress, note, changed_by)
       VALUES (?, 'CREATE', NULL, 0, ?, ?)`,
      [goalId, goal.note ?? null, goal.createdBy],
    );

    if (goal.notifications?.length) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [
          goal.notifications.map((notification) => [
            notification.receiverId,
            notification.title,
            notification.content,
            "GOAL",
            "STUDENT_GOAL",
            goalId,
            false,
          ]),
        ],
      );
    }

    await conn.commit();
    return goalId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateGoal({ goalId, fields, changedBy, notifications = [] }) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE student_goal
       SET goal_type = ?,
           title = ?,
           description = ?,
           target_date = ?
       WHERE goal_id = ?`,
      [
        fields.goalType,
        fields.title,
        fields.description ?? null,
        fields.targetDate ?? null,
        goalId,
      ],
    );

    if (!result.affectedRows) {
      const error = new Error("Không tìm thấy mục tiêu");
      error.statusCode = 404;
      throw error;
    }

    await conn.query(
      `INSERT INTO student_goal_log
         (goal_id, action, note, changed_by)
       VALUES (?, 'UPDATE', ?, ?)`,
      [goalId, fields.note ?? null, changedBy],
    );

    if (notifications.length) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [
          notifications.map((notification) => [
            notification.receiverId,
            notification.title,
            notification.content,
            "GOAL",
            "STUDENT_GOAL",
            goalId,
            false,
          ]),
        ],
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// ── Homeroom-teacher-only write ───────────────────────────────────────────────

async function updateTeacherRemark({ goalId, teacherRemark, notifications = [] }) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `UPDATE student_goal
       SET teacher_remark = ?
       WHERE goal_id = ?`,
      [teacherRemark, goalId],
    );

    if (!result.affectedRows) {
      const error = new Error("Không tìm thấy mục tiêu");
      error.statusCode = 404;
      throw error;
    }

    if (notifications.length) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [
          notifications.map((notification) => [
            notification.receiverId,
            notification.title,
            notification.content,
            "GOAL",
            "STUDENT_GOAL",
            goalId,
            false,
          ]),
        ],
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// ── Audit/read helpers ────────────────────────────────────────────────────────

async function findGoalLog(goalId) {
  const [rows] = await pool.query(
    `SELECT
       l.goal_log_id AS logId,
       l.action,
       l.old_progress AS oldProgress,
       l.new_progress AS newProgress,
       l.milestone_title AS milestoneTitle,
       l.note,
       DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       ua.full_name AS changedByName
     FROM student_goal_log l
     INNER JOIN user_account ua ON ua.user_id = l.changed_by
     WHERE l.goal_id = ?
     ORDER BY l.created_at ASC, l.goal_log_id ASC`,
    [goalId],
  );

  return rows.map((row) => ({
    ...row,
    oldProgress: row.oldProgress === null ? null : Number(row.oldProgress),
    newProgress: row.newProgress === null ? null : Number(row.newProgress),
  }));
}

async function findStudentUserRecipients(studentId) {
  const [[student]] = await pool.query(
    `SELECT s.user_id AS userId
     FROM student s
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
      AND ua.status = 'ACTIVE'
     WHERE s.student_id = ?`,
    [studentId],
  );

  return student ? [student.userId] : [];
}

async function findHomeroomTeacherRecipients(studentId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT t.user_id AS userId
     FROM class_enrollment ce
     INNER JOIN school_class sc
       ON sc.class_id = ce.class_id
      AND sc.status = 'ACTIVE'
     INNER JOIN school_year sy
       ON sy.school_year_id = sc.school_year_id
      AND sy.is_active = 1
     INNER JOIN teacher_class tc
       ON tc.class_id = ce.class_id
      AND tc.role_in_class = 'HOMEROOM_TEACHER'
      AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     INNER JOIN teacher t ON t.teacher_id = tc.teacher_id
     INNER JOIN user_account ua
       ON ua.user_id = t.user_id
      AND ua.status = 'ACTIVE'
     WHERE ce.student_id = ?
       AND ce.status = 'ACTIVE'`,
    [studentId],
  );

  return rows.map((row) => row.userId);
}

module.exports = {
  findByStudent,
  findByClass,
  findById,
  createGoal,
  updateGoal,
  updateTeacherRemark,
  findGoalLog,
  findStudentUserRecipients,
  findHomeroomTeacherRecipients,
};
