const { pool } = require("../config/db");

// ── List / detail ─────────────────────────────────────────────────────────────

async function findByStudent(studentId, filters = {}) {
  const { status, goalType } = filters;
  const params = [studentId];
  let where = "sg.student_id = ?";
  if (status)   { where += " AND sg.status = ?";    params.push(status); }
  if (goalType) { where += " AND sg.goal_type = ?"; params.push(goalType); }

  const [rows] = await pool.query(
    `SELECT
       sg.goal_id      AS goalId,
       sg.goal_type    AS goalType,
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
       CASE sg.status WHEN 'IN_PROGRESS' THEN 0 WHEN 'COMPLETED' THEN 1 WHEN 'FAILED' THEN 2 ELSE 3 END,
       sg.target_date ASC`,
    params,
  );
  return rows.map((r) => ({ ...r, progress: Number(r.progress) }));
}

// Goals across a class, with student info (for the management page).
async function findByClass(classId, filters = {}) {
  const { status, goalType, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [classId];
  let where = "ce.class_id = ? AND ce.status = 'ACTIVE'";
  if (status)   { where += " AND sg.status = ?";    params.push(status); }
  if (goalType) { where += " AND sg.goal_type = ?"; params.push(goalType); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM student_goal sg
     INNER JOIN class_enrollment ce ON ce.student_id = sg.student_id AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       sg.goal_id   AS goalId,
       sg.goal_type AS goalType,
       sg.title,
       DATE_FORMAT(sg.target_date, '%Y-%m-%d') AS targetDate,
       sg.progress,
       sg.status,
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       ua.avatar      AS studentAvatar
     FROM student_goal sg
     INNER JOIN class_enrollment ce ON ce.student_id = sg.student_id AND ce.status = 'ACTIVE'
     INNER JOIN student s ON s.student_id = sg.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     WHERE ${where}
     ORDER BY
       CASE sg.status WHEN 'IN_PROGRESS' THEN 0 ELSE 1 END,
       sg.target_date ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total: Number(total), rows: rows.map((r) => ({ ...r, progress: Number(r.progress) })) };
}

async function findById(goalId) {
  const [[row]] = await pool.query(
    `SELECT
       sg.goal_id    AS goalId,
       sg.student_id AS studentId,
       sg.goal_type  AS goalType,
       sg.title,
       sg.description,
       DATE_FORMAT(sg.target_date, '%Y-%m-%d') AS targetDate,
       sg.progress,
       sg.status,
       sg.teacher_remark AS teacherRemark,
       sg.final_comment  AS finalComment,
       s.user_id     AS studentUserId
     FROM student_goal sg
     INNER JOIN student s ON s.student_id = sg.student_id
     WHERE sg.goal_id = ?`,
    [goalId],
  );
  if (!row) return null;
  return { ...row, progress: Number(row.progress) };
}

// ── Create / update / progress / evaluate / archive (transactional + log) ─────

async function createGoal(g) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO student_goal
         (student_id, goal_type, title, description, target_date, progress, status, teacher_remark, created_by)
       VALUES (?, ?, ?, ?, ?, 0, 'IN_PROGRESS', ?, ?)`,
      [g.studentId, g.goalType, g.title, g.description ?? null, g.targetDate ?? null, g.teacherRemark ?? null, g.createdBy],
    );
    const goalId = result.insertId;

    await conn.query(
      `INSERT INTO student_goal_log (goal_id, action, old_progress, new_progress, note, changed_by)
       VALUES (?, 'CREATE', NULL, 0, ?, ?)`,
      [goalId, g.note ?? null, g.createdBy],
    );

    if (g.notifications && g.notifications.length) {
      await conn.query(
        `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
        [g.notifications.map((n) => [n.receiverId, n.title, n.content, "GOAL", "STUDENT_GOAL", goalId, false])],
      );
    }

    await conn.commit();
    return goalId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateGoal({ goalId, fields, changedBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE student_goal
       SET goal_type = ?, title = ?, description = ?, target_date = ?, teacher_remark = ?
       WHERE goal_id = ? AND status <> 'ARCHIVED'`,
      [fields.goalType, fields.title, fields.description ?? null, fields.targetDate ?? null, fields.teacherRemark ?? null, goalId],
    );
    await conn.query(
      `INSERT INTO student_goal_log (goal_id, action, note, changed_by) VALUES (?, 'UPDATE', ?, ?)`,
      [goalId, fields.note ?? null, changedBy],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateProgress({ goalId, oldProgress, newProgress, note, milestoneTitle, changedBy, autoStatus }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (autoStatus) {
      await conn.query(`UPDATE student_goal SET progress = ?, status = ? WHERE goal_id = ?`, [newProgress, autoStatus, goalId]);
    } else {
      await conn.query(`UPDATE student_goal SET progress = ? WHERE goal_id = ?`, [newProgress, goalId]);
    }

    await conn.query(
      `INSERT INTO student_goal_log (goal_id, action, old_progress, new_progress, milestone_title, note, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [goalId, milestoneTitle ? "MILESTONE" : "PROGRESS", oldProgress, newProgress, milestoneTitle ?? null, note ?? null, changedBy],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function evaluateGoal({ goalId, status, finalComment, progress, changedBy, notifications }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE student_goal SET status = ?, final_comment = ?, progress = ? WHERE goal_id = ?`,
      [status, finalComment, progress, goalId],
    );
    await conn.query(
      `INSERT INTO student_goal_log (goal_id, action, new_progress, note, changed_by)
       VALUES (?, 'EVALUATE', ?, ?, ?)`,
      [goalId, progress, finalComment, changedBy],
    );

    if (notifications && notifications.length) {
      await conn.query(
        `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read) VALUES ?`,
        [notifications.map((n) => [n.receiverId, n.title, n.content, "GOAL", "STUDENT_GOAL", goalId, false])],
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function archiveGoal({ goalId, note, changedBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`UPDATE student_goal SET status = 'ARCHIVED' WHERE goal_id = ?`, [goalId]);
    await conn.query(
      `INSERT INTO student_goal_log (goal_id, action, note, changed_by) VALUES (?, 'ARCHIVE', ?, ?)`,
      [goalId, note ?? null, changedBy],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findGoalLog(goalId) {
  const [rows] = await pool.query(
    `SELECT
       l.goal_log_id AS logId, l.action, l.old_progress AS oldProgress, l.new_progress AS newProgress,
       l.milestone_title AS milestoneTitle, l.note,
       DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       ua.full_name AS changedByName
     FROM student_goal_log l
     INNER JOIN user_account ua ON ua.user_id = l.changed_by
     WHERE l.goal_id = ?
     ORDER BY l.created_at ASC`,
    [goalId],
  );
  return rows.map((r) => ({
    ...r,
    oldProgress: r.oldProgress === null ? null : Number(r.oldProgress),
    newProgress: r.newProgress === null ? null : Number(r.newProgress),
  }));
}

async function findStudentRecipients(studentId) {
  const [[student]] = await pool.query(`SELECT user_id AS userId FROM student WHERE student_id = ?`, [studentId]);
  const [parents] = await pool.query(
    `SELECT pp.user_id AS userId
     FROM student_parent sp
     INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
     INNER JOIN user_account ua ON ua.user_id = pp.user_id AND ua.status = 'ACTIVE'
     WHERE sp.student_id = ?`,
    [studentId],
  );
  const ids = [];
  if (student) ids.push(student.userId);
  ids.push(...parents.map((p) => p.userId));
  return [...new Set(ids)];
}

module.exports = {
  findByStudent,
  findByClass,
  findById,
  createGoal,
  updateGoal,
  updateProgress,
  evaluateGoal,
  archiveGoal,
  findGoalLog,
  findStudentRecipients,
};
