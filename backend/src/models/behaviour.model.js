const { pool } = require("../config/db");

// ── Pickers & permission ──────────────────────────────────────────────────────

async function findTeacherClasses(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       sc.class_id   AS classId,
       sc.class_name AS className,
       g.grade_name  AS gradeName
     FROM teacher_class tc
     INNER JOIN school_class sc ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     WHERE tc.teacher_id = ?
     ORDER BY sc.class_name ASC`,
    [teacherId],
  );
  return rows;
}

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class WHERE teacher_id = ? AND class_id = ? LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

async function isTeacherForStudent(teacherId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND ce.student_id = ?
     LIMIT 1`,
    [teacherId, studentId],
  );
  return Boolean(row);
}

async function findSemesters() {
  const [rows] = await pool.query(
    `SELECT
       sem.semester_id   AS semesterId,
       sem.semester_name AS semesterName,
       DATE_FORMAT(sem.start_date, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(sem.end_date, '%Y-%m-%d')   AS endDate,
       sy.year_name      AS schoolYearName,
       sy.is_active      AS isActiveYear
     FROM semester sem
     INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
     ORDER BY sy.is_active DESC, sy.start_date DESC, sem.start_date ASC`,
  );
  return rows.map((r) => ({ ...r, isActiveYear: Boolean(r.isActiveYear) }));
}

async function findSemesterById(semesterId) {
  const [[row]] = await pool.query(
    `SELECT
       semester_id AS semesterId,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(end_date, '%Y-%m-%d')   AS endDate
     FROM semester WHERE semester_id = ?`,
    [semesterId],
  );
  return row || null;
}

async function findStudentProfile(studentId) {
  const [[row]] = await pool.query(
    `SELECT
       s.student_id AS studentId, s.student_code AS studentCode,
       ua.full_name AS fullName, ua.avatar,
       sc.class_id AS classId, sc.class_name AS className, g.grade_name AS gradeName
     FROM student s
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     LEFT JOIN grade g ON g.grade_id = sc.grade_id
     WHERE s.student_id = ?`,
    [studentId],
  );
  return row || null;
}

// ── Behaviour records: list / detail ──────────────────────────────────────────

async function findRecords(filters = {}) {
  const { behaviorType, classId, studentId, startDate, endDate, status = "ACTIVE", page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [];
  let where = "br.status = ?";
  params.push(status);

  if (behaviorType) { where += " AND br.behavior_type = ?"; params.push(behaviorType); }
  if (classId)      { where += " AND ce.class_id = ?";      params.push(parseInt(classId, 10)); }
  if (studentId)    { where += " AND br.student_id = ?";    params.push(parseInt(studentId, 10)); }
  if (startDate)    { where += " AND br.record_date >= ?";  params.push(startDate); }
  if (endDate)      { where += " AND br.record_date <= ?";  params.push(endDate); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM behavior_record br
     INNER JOIN student s ON s.student_id = br.student_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       br.behavior_id   AS behaviorId,
       br.behavior_type AS behaviorType,
       br.category,
       br.title,
       br.description,
       br.severity_level AS severityLevel,
       br.points,
       DATE_FORMAT(br.record_date, '%Y-%m-%d') AS recordDate,
       br.evidence_url  AS evidenceUrl,
       br.status,
       s.student_id     AS studentId,
       s.student_code   AS studentCode,
       ua.full_name     AS studentName,
       ua.avatar        AS studentAvatar,
       sc.class_name    AS className,
       creator.full_name AS createdByName
     FROM behavior_record br
     INNER JOIN student s ON s.student_id = br.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     LEFT JOIN user_account creator ON creator.user_id = br.created_by
     WHERE ${where}
     ORDER BY br.record_date DESC, br.behavior_id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total: Number(total), rows };
}

async function findRecordById(behaviorId) {
  const [[row]] = await pool.query(
    `SELECT
       br.behavior_id AS behaviorId, br.student_id AS studentId,
       br.behavior_type AS behaviorType, br.points, br.status,
       br.title, s.user_id AS studentUserId
     FROM behavior_record br
     INNER JOIN student s ON s.student_id = br.student_id
     WHERE br.behavior_id = ?`,
    [behaviorId],
  );
  return row || null;
}

// ── Create / update / archive (transactional with audit log) ──────────────────

async function createRecord(rec) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO behavior_record
         (student_id, supervisor_id, behavior_type, title, category, description,
          severity_level, points, record_date, semester_id, evidence_url, created_by, status)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')`,
      [
        rec.studentId, rec.behaviorType, rec.title, rec.category ?? null, rec.description ?? null,
        rec.severityLevel ?? "LOW", rec.points, rec.recordDate, rec.semesterId ?? null,
        rec.evidenceUrl ?? null, rec.createdBy,
      ],
    );
    const behaviorId = result.insertId;

    await conn.query(
      `INSERT INTO behavior_record_log
         (behavior_id, student_id, action, old_points, new_points, reason, changed_by)
       VALUES (?, ?, 'CREATE', NULL, ?, ?, ?)`,
      [behaviorId, rec.studentId, rec.points, rec.reason ?? null, rec.createdBy],
    );

    if (rec.notifications && rec.notifications.length) {
      await conn.query(
        `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [rec.notifications.map((n) => [n.receiverId, n.title, n.content, "BEHAVIOR", "BEHAVIOR_RECORD", behaviorId, false])],
      );
    }

    await conn.commit();
    return behaviorId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function updateRecord({ behaviorId, fields, oldPoints, reason, changedBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE behavior_record
       SET title = ?, category = ?, description = ?, severity_level = ?, points = ?,
           record_date = ?, evidence_url = ?
       WHERE behavior_id = ? AND status = 'ACTIVE'`,
      [
        fields.title, fields.category ?? null, fields.description ?? null,
        fields.severityLevel ?? "LOW", fields.points, fields.recordDate,
        fields.evidenceUrl ?? null, behaviorId,
      ],
    );

    await conn.query(
      `INSERT INTO behavior_record_log
         (behavior_id, student_id, action, old_points, new_points, reason, changed_by)
       VALUES (?, ?, 'UPDATE', ?, ?, ?, ?)`,
      [behaviorId, fields.studentId, oldPoints, fields.points, reason ?? null, changedBy],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function archiveRecord({ behaviorId, studentId, oldPoints, reason, changedBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE behavior_record SET status = 'ARCHIVED' WHERE behavior_id = ?`,
      [behaviorId],
    );
    await conn.query(
      `INSERT INTO behavior_record_log
         (behavior_id, student_id, action, old_points, new_points, reason, changed_by)
       VALUES (?, ?, 'ARCHIVE', ?, NULL, ?, ?)`,
      [behaviorId, studentId, oldPoints, reason ?? null, changedBy],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findRecordLog(behaviorId) {
  const [rows] = await pool.query(
    `SELECT
       l.log_id AS logId, l.action, l.old_points AS oldPoints, l.new_points AS newPoints,
       l.reason, DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       ua.full_name AS changedByName
     FROM behavior_record_log l
     INNER JOIN user_account ua ON ua.user_id = l.changed_by
     WHERE l.behavior_id = ?
     ORDER BY l.created_at ASC`,
    [behaviorId],
  );
  return rows;
}

// ── Conduct aggregation (by semester date range) ──────────────────────────────

async function aggregateConduct(studentId, startDate, endDate) {
  const [[row]] = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN behavior_type = 'POSITIVE'  THEN points ELSE 0 END), 0) AS meritPoints,
       COALESCE(SUM(CASE WHEN behavior_type = 'VIOLATION' THEN ABS(points) ELSE 0 END), 0) AS demeritPoints,
       SUM(CASE WHEN behavior_type = 'VIOLATION' THEN 1 ELSE 0 END) AS violationCount,
       SUM(CASE WHEN behavior_type = 'POSITIVE'  THEN 1 ELSE 0 END) AS meritCount
     FROM behavior_record
     WHERE student_id = ? AND status = 'ACTIVE'
       AND record_date BETWEEN ? AND ?`,
    [studentId, startDate, endDate],
  );
  return {
    meritPoints:    Number(row.meritPoints),
    demeritPoints:  Number(row.demeritPoints),
    violationCount: Number(row.violationCount),
    meritCount:     Number(row.meritCount),
  };
}

// Per-student merit/demerit aggregates for a whole class within a date range.
async function aggregateClassConduct(classId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       ua.avatar      AS studentAvatar,
       COALESCE(SUM(CASE WHEN br.behavior_type = 'POSITIVE'  THEN br.points ELSE 0 END), 0) AS meritPoints,
       COALESCE(SUM(CASE WHEN br.behavior_type = 'VIOLATION' THEN ABS(br.points) ELSE 0 END), 0) AS demeritPoints,
       SUM(CASE WHEN br.behavior_type = 'VIOLATION' THEN 1 ELSE 0 END) AS violationCount,
       SUM(CASE WHEN br.behavior_type = 'POSITIVE'  THEN 1 ELSE 0 END) AS meritCount
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     LEFT JOIN behavior_record br
       ON br.student_id = s.student_id AND br.status = 'ACTIVE'
       AND br.record_date BETWEEN ? AND ?
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     GROUP BY s.student_id, s.student_code, ua.full_name, ua.avatar
     ORDER BY ua.full_name ASC`,
    [startDate, endDate, classId],
  );
  return rows.map((r) => ({
    studentId:      r.studentId,
    studentCode:    r.studentCode,
    studentName:    r.studentName,
    studentAvatar:  r.studentAvatar,
    meritPoints:    Number(r.meritPoints),
    demeritPoints:  Number(r.demeritPoints),
    violationCount: Number(r.violationCount),
    meritCount:     Number(r.meritCount),
  }));
}

// Monthly trend of merit/demerit points for a class within a date range.
async function monthlyTrend(classId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(br.record_date, '%Y-%m') AS month,
       COALESCE(SUM(CASE WHEN br.behavior_type = 'POSITIVE'  THEN br.points ELSE 0 END), 0) AS merit,
       COALESCE(SUM(CASE WHEN br.behavior_type = 'VIOLATION' THEN br.points ELSE 0 END), 0) AS demerit
     FROM behavior_record br
     INNER JOIN class_enrollment ce ON ce.student_id = br.student_id AND ce.status = 'ACTIVE'
     WHERE ce.class_id = ? AND br.status = 'ACTIVE'
       AND br.record_date BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(br.record_date, '%Y-%m')
     ORDER BY month ASC`,
    [classId, startDate, endDate],
  );
  return rows.map((r) => ({ month: r.month, merit: Number(r.merit), demerit: Number(r.demerit) }));
}

// ── Conduct evaluation ────────────────────────────────────────────────────────

async function upsertConductEvaluation(ev) {
  await pool.query(
    `INSERT INTO conduct_evaluation
       (student_id, semester_id, merit_points, demerit_points, base_score, adjustment,
        final_score, conduct_grade, comment, status, evaluated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       merit_points = VALUES(merit_points),
       demerit_points = VALUES(demerit_points),
       base_score = VALUES(base_score),
       adjustment = VALUES(adjustment),
       final_score = VALUES(final_score),
       conduct_grade = VALUES(conduct_grade),
       comment = VALUES(comment),
       status = VALUES(status),
       evaluated_by = VALUES(evaluated_by)`,
    [
      ev.studentId, ev.semesterId, ev.meritPoints, ev.demeritPoints, ev.baseScore,
      ev.adjustment, ev.finalScore, ev.conductGrade, ev.comment, ev.status, ev.evaluatedBy,
    ],
  );
}

async function findConductEvaluation(studentId, semesterId) {
  const [[row]] = await pool.query(
    `SELECT
       evaluation_id AS evaluationId, student_id AS studentId, semester_id AS semesterId,
       merit_points AS meritPoints, demerit_points AS demeritPoints, base_score AS baseScore,
       adjustment, final_score AS finalScore, conduct_grade AS conductGrade,
       comment, status,
       DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i') AS updatedAt
     FROM conduct_evaluation
     WHERE student_id = ? AND semester_id = ?`,
    [studentId, semesterId],
  );
  if (!row) return null;
  return {
    ...row,
    meritPoints: Number(row.meritPoints), demeritPoints: Number(row.demeritPoints),
    baseScore: Number(row.baseScore), adjustment: Number(row.adjustment), finalScore: Number(row.finalScore),
  };
}

async function findStudentConductHistory(studentId) {
  const [rows] = await pool.query(
    `SELECT
       ce.semester_id AS semesterId, sem.semester_name AS semesterName, sy.year_name AS schoolYearName,
       ce.final_score AS finalScore, ce.conduct_grade AS conductGrade, ce.status,
       ce.merit_points AS meritPoints, ce.demerit_points AS demeritPoints, ce.comment
     FROM conduct_evaluation ce
     INNER JOIN semester sem ON sem.semester_id = ce.semester_id
     INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
     WHERE ce.student_id = ?
     ORDER BY sy.start_date DESC, sem.start_date DESC`,
    [studentId],
  );
  return rows.map((r) => ({
    ...r,
    finalScore: Number(r.finalScore), meritPoints: Number(r.meritPoints), demeritPoints: Number(r.demeritPoints),
  }));
}

async function findStudentRecords(studentId, limit = 50) {
  const [rows] = await pool.query(
    `SELECT
       br.behavior_id AS behaviorId, br.behavior_type AS behaviorType, br.category,
       br.title, br.description, br.severity_level AS severityLevel, br.points,
       DATE_FORMAT(br.record_date, '%Y-%m-%d') AS recordDate, br.evidence_url AS evidenceUrl,
       br.status, creator.full_name AS createdByName
     FROM behavior_record br
     LEFT JOIN user_account creator ON creator.user_id = br.created_by
     WHERE br.student_id = ? AND br.status = 'ACTIVE'
     ORDER BY br.record_date DESC, br.behavior_id DESC
     LIMIT ?`,
    [studentId, limit],
  );
  return rows;
}

// ── Behaviour warnings ────────────────────────────────────────────────────────

async function upsertWarning(w) {
  await pool.query(
    `INSERT INTO behavior_warning
       (student_id, semester_id, warning_type, conduct_score, violation_count, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       conduct_score = VALUES(conduct_score),
       violation_count = VALUES(violation_count),
       note = VALUES(note)`,
    [w.studentId, w.semesterId, w.warningType, w.conductScore, w.violationCount, w.note ?? null, w.createdBy],
  );
}

async function findWarnings(filters = {}) {
  const { semesterId, classId, status, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [];
  let where = "1=1";
  if (semesterId) { where += " AND w.semester_id = ?"; params.push(parseInt(semesterId, 10)); }
  if (status)     { where += " AND w.status = ?";      params.push(status); }
  if (classId)    { where += " AND ce.class_id = ?";   params.push(parseInt(classId, 10)); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM behavior_warning w
     INNER JOIN student s ON s.student_id = w.student_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       w.warning_id AS warningId, w.warning_type AS warningType, w.conduct_score AS conductScore,
       w.violation_count AS violationCount, w.note, w.intervention, w.status,
       DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       s.student_id AS studentId, s.student_code AS studentCode,
       ua.full_name AS studentName, ua.avatar AS studentAvatar,
       sc.class_name AS className, sem.semester_name AS semesterName
     FROM behavior_warning w
     INNER JOIN student s ON s.student_id = w.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     INNER JOIN semester sem ON sem.semester_id = w.semester_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     WHERE ${where}
     ORDER BY CASE w.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, w.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({
      ...r,
      conductScore: r.conductScore === null ? null : Number(r.conductScore),
      violationCount: Number(r.violationCount),
    })),
  };
}

async function findWarningById(warningId) {
  const [[row]] = await pool.query(
    `SELECT w.warning_id AS warningId, w.student_id AS studentId, w.status, s.user_id AS studentUserId
     FROM behavior_warning w INNER JOIN student s ON s.student_id = w.student_id
     WHERE w.warning_id = ?`,
    [warningId],
  );
  return row || null;
}

async function updateWarningIntervention(warningId, { note, intervention, status }) {
  const [result] = await pool.query(
    `UPDATE behavior_warning
     SET note = COALESCE(?, note), intervention = ?, status = ?
     WHERE warning_id = ?`,
    [note ?? null, intervention ?? null, status, warningId],
  );
  return result.affectedRows;
}

// ── Notification recipients ───────────────────────────────────────────────────

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

async function insertNotifications(notifications) {
  if (!notifications.length) return;
  await pool.query(
    `INSERT INTO notification (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [notifications.map((n) => [n.receiverId, n.title, n.content, "BEHAVIOR", "BEHAVIOR_RECORD", n.relatedId ?? null, false])],
  );
}

module.exports = {
  findTeacherClasses,
  isTeacherForClass,
  isTeacherForStudent,
  findSemesters,
  findSemesterById,
  findStudentProfile,
  findRecords,
  findRecordById,
  createRecord,
  updateRecord,
  archiveRecord,
  findRecordLog,
  aggregateConduct,
  aggregateClassConduct,
  monthlyTrend,
  upsertConductEvaluation,
  findConductEvaluation,
  findStudentConductHistory,
  findStudentRecords,
  upsertWarning,
  findWarnings,
  findWarningById,
  updateWarningIntervention,
  findStudentRecipients,
  insertNotifications,
};
