const { pool } = require("../config/db");

// ── Teaching assignments + semesters for pickers ──────────────────────────────

async function findTeachingAssignments(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       sc.class_id      AS classId,
       sc.class_name    AS className,
       g.grade_name     AS gradeName,
       sub.subject_id   AS subjectId,
       sub.subject_name AS subjectName
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN subject sub
       ON sub.subject_id = tc.subject_id AND sub.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND tc.subject_id IS NOT NULL
     ORDER BY sc.class_name ASC, sub.subject_name ASC`,
    [teacherId],
  );
  return rows;
}

async function isTeacherAssigned(teacherId, classId, subjectId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND tc.class_id = ? AND tc.subject_id = ?
     LIMIT 1`,
    [teacherId, classId, subjectId],
  );
  return Boolean(row);
}

// Verify a teacher may manage a given student's scores for a subject:
// the student is enrolled in a class the teacher teaches that subject in.
async function isTeacherForStudentSubject(teacherId, studentId, subjectId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce
       ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ?
       AND tc.subject_id = ?
       AND ce.student_id = ?
     LIMIT 1`,
    [teacherId, subjectId, studentId],
  );
  return Boolean(row);
}

// Teacher may view a student if they teach any class the student is enrolled in
// (homeroom or subject).
async function isTeacherForStudent(teacherId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce
       ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
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
       sy.school_year_id AS schoolYearId,
       sy.year_name      AS schoolYearName,
       sy.is_active      AS isActiveYear
     FROM semester sem
     INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
     ORDER BY sy.is_active DESC, sy.start_date DESC, sem.start_date ASC`,
  );
  return rows.map((r) => ({ ...r, isActiveYear: Boolean(r.isActiveYear) }));
}

// ── Score-entry grid: enrolled students + their score for one type ────────────

async function findScoreSheet(classId, subjectId, semesterId, scoreType) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       ua.avatar      AS studentAvatar,

       ar.result_id    AS resultId,
       ar.score_value  AS scoreValue,
       ar.max_score    AS maxScore,
       ar.comment
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     LEFT JOIN academic_result ar
       ON ar.student_id = s.student_id
       AND ar.subject_id = ?
       AND ar.semester_id = ?
       AND ar.score_type = ?
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [subjectId, semesterId, scoreType, classId],
  );

  return rows.map((r) => ({
    studentId:    r.studentId,
    studentCode:  r.studentCode,
    studentName:  r.studentName,
    studentAvatar: r.studentAvatar,
    resultId:     r.resultId,
    scoreValue:   r.scoreValue === null ? null : Number(r.scoreValue),
    maxScore:     r.maxScore === null ? null : Number(r.maxScore),
    comment:      r.comment,
  }));
}

async function findResultById(resultId) {
  const [[row]] = await pool.query(
    `SELECT
       ar.result_id   AS resultId,
       ar.student_id  AS studentId,
       ar.subject_id  AS subjectId,
       ar.semester_id AS semesterId,
       ar.score_type  AS scoreType,
       ar.score_value AS scoreValue,
       ar.max_score   AS maxScore,
       s.user_id      AS studentUserId
     FROM academic_result ar
     INNER JOIN student s ON s.student_id = ar.student_id
     WHERE ar.result_id = ?`,
    [resultId],
  );
  if (!row) return null;
  return {
    ...row,
    scoreValue: row.scoreValue === null ? null : Number(row.scoreValue),
    maxScore:   Number(row.maxScore),
  };
}

// ── Bulk upsert scores (transaction: upsert + audit log + notifications) ──────

async function bulkUpsertScores({ classId, subjectId, semesterId, scoreType, maxScore, records, actorUserId, notifications }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const rec of records) {
      // Look up existing score for accurate old→new logging
      const [[existing]] = await conn.query(
        `SELECT result_id, score_value
         FROM academic_result
         WHERE student_id = ? AND subject_id = ? AND semester_id = ? AND score_type = ?`,
        [rec.studentId, subjectId, semesterId, scoreType],
      );

      const oldScore = existing ? Number(existing.score_value) : null;
      const action   = existing ? "UPDATE" : "CREATE";

      await conn.query(
        `INSERT INTO academic_result
           (student_id, subject_id, semester_id, score_type, score_value, max_score, comment, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           score_value = VALUES(score_value),
           max_score   = VALUES(max_score),
           comment     = VALUES(comment),
           updated_by  = VALUES(updated_by)`,
        [rec.studentId, subjectId, semesterId, scoreType, rec.scoreValue, maxScore, rec.comment ?? null, actorUserId, actorUserId],
      );

      const [[row]] = await conn.query(
        `SELECT result_id FROM academic_result
         WHERE student_id = ? AND subject_id = ? AND semester_id = ? AND score_type = ?`,
        [rec.studentId, subjectId, semesterId, scoreType],
      );

      await conn.query(
        `INSERT INTO academic_result_log
           (result_id, student_id, subject_id, semester_id, score_type, action, old_score, new_score, reason, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.result_id, rec.studentId, subjectId, semesterId, scoreType, action, oldScore, rec.scoreValue, rec.reason ?? null, actorUserId],
      );
    }

    if (notifications && notifications.length) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [notifications.map((n) => [n.receiverId, n.title, n.content, "ACADEMIC", "ACADEMIC_RESULT", n.relatedId ?? null, false])],
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

async function updateSingleScore({ resultId, newScore, maxScore, comment, reason, actorUserId, prev }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE academic_result
       SET score_value = ?, max_score = ?, comment = ?, updated_by = ?
       WHERE result_id = ?`,
      [newScore, maxScore, comment ?? null, actorUserId, resultId],
    );

    await conn.query(
      `INSERT INTO academic_result_log
         (result_id, student_id, subject_id, semester_id, score_type, action, old_score, new_score, reason, changed_by)
       VALUES (?, ?, ?, ?, ?, 'UPDATE', ?, ?, ?, ?)`,
      [resultId, prev.studentId, prev.subjectId, prev.semesterId, prev.scoreType, prev.scoreValue, newScore, reason ?? null, actorUserId],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function deleteScore({ resultId, reason, actorUserId, prev }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO academic_result_log
         (result_id, student_id, subject_id, semester_id, score_type, action, old_score, new_score, reason, changed_by)
       VALUES (?, ?, ?, ?, ?, 'DELETE', ?, NULL, ?, ?)`,
      [resultId, prev.studentId, prev.subjectId, prev.semesterId, prev.scoreType, prev.scoreValue, reason ?? null, actorUserId],
    );

    await conn.query(`DELETE FROM academic_result WHERE result_id = ?`, [resultId]);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ── Score data for GPA / profile / analytics ──────────────────────────────────

async function findStudentScores(studentId, semesterId) {
  const [rows] = await pool.query(
    `SELECT
       ar.subject_id   AS subjectId,
       sub.subject_name AS subjectName,
       ar.score_type   AS scoreType,
       ar.score_value  AS scoreValue,
       ar.max_score    AS maxScore
     FROM academic_result ar
     INNER JOIN subject sub ON sub.subject_id = ar.subject_id
     WHERE ar.student_id = ? AND ar.semester_id = ?
     ORDER BY sub.subject_name ASC`,
    [studentId, semesterId],
  );
  return rows.map((r) => ({
    subjectId:   r.subjectId,
    subjectName: r.subjectName,
    scoreType:   r.scoreType,
    scoreValue:  Number(r.scoreValue),
    maxScore:    Number(r.maxScore),
  }));
}

async function findStudentProfile(studentId) {
  const [[row]] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       ua.avatar,
       s.gender,
       DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
       sc.class_id    AS classId,
       sc.class_name  AS className,
       g.grade_name   AS gradeName
     FROM student s
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN class_enrollment ce
       ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc
       ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     LEFT JOIN grade g ON g.grade_id = sc.grade_id
     WHERE s.student_id = ?`,
    [studentId],
  );
  return row || null;
}

// All score rows for every student enrolled in a class for one semester
// (used for class analytics + ranking). Tagged with studentId/name.
async function findClassScores(classId, semesterId) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id    AS studentId,
       ua.full_name    AS studentName,
       s.student_code  AS studentCode,
       ar.subject_id   AS subjectId,
       sub.subject_name AS subjectName,
       ar.score_type   AS scoreType,
       ar.score_value  AS scoreValue,
       ar.max_score    AS maxScore
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN academic_result ar
       ON ar.student_id = s.student_id AND ar.semester_id = ?
     LEFT JOIN subject sub ON sub.subject_id = ar.subject_id
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [semesterId, classId],
  );
  return rows.map((r) => ({
    studentId:   r.studentId,
    studentName: r.studentName,
    studentCode: r.studentCode,
    subjectId:   r.subjectId,
    subjectName: r.subjectName,
    scoreType:   r.scoreType,
    scoreValue:  r.scoreValue === null ? null : Number(r.scoreValue),
    maxScore:    r.maxScore === null ? null : Number(r.maxScore),
  }));
}

async function findEnrolledStudents(classId) {
  const [rows] = await pool.query(
    `SELECT s.student_id AS studentId, s.student_code AS studentCode, ua.full_name AS studentName, ua.avatar AS studentAvatar
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [classId],
  );
  return rows;
}

// ── Score history ─────────────────────────────────────────────────────────────

async function findScoreLog(filters = {}) {
  const { studentId, subjectId, semesterId, page = 1, limit = 20 } = filters;
  const offset = (page - 1) * limit;
  const params = [];
  let where = "1=1";

  if (studentId)  { where += " AND l.student_id = ?";  params.push(parseInt(studentId, 10)); }
  if (subjectId)  { where += " AND l.subject_id = ?";  params.push(parseInt(subjectId, 10)); }
  if (semesterId) { where += " AND l.semester_id = ?"; params.push(parseInt(semesterId, 10)); }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM academic_result_log l WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       l.result_log_id                              AS logId,
       l.action,
       l.score_type                                 AS scoreType,
       l.old_score                                  AS oldScore,
       l.new_score                                  AS newScore,
       l.reason,
       DATE_FORMAT(l.created_at, '%Y-%m-%d %H:%i')  AS createdAt,
       ua.full_name                                 AS changedByName,
       sua.full_name                                AS studentName,
       sub.subject_name                             AS subjectName
     FROM academic_result_log l
     INNER JOIN user_account ua ON ua.user_id = l.changed_by
     INNER JOIN student s       ON s.student_id = l.student_id
     INNER JOIN user_account sua ON sua.user_id = s.user_id
     INNER JOIN subject sub     ON sub.subject_id = l.subject_id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({
      ...r,
      oldScore: r.oldScore === null ? null : Number(r.oldScore),
      newScore: r.newScore === null ? null : Number(r.newScore),
    })),
  };
}

// ── Academic warnings ─────────────────────────────────────────────────────────

async function upsertWarning(conn, w) {
  await (conn || pool).query(
    `INSERT INTO academic_warning
       (student_id, semester_id, warning_type, gpa_snapshot, failed_subjects, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       gpa_snapshot    = VALUES(gpa_snapshot),
       failed_subjects = VALUES(failed_subjects)`,
    [w.studentId, w.semesterId, w.warningType, w.gpaSnapshot, w.failedSubjects, w.note ?? null, w.createdBy],
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
     FROM academic_warning w
     INNER JOIN student s ON s.student_id = w.student_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     WHERE ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       w.warning_id      AS warningId,
       w.warning_type    AS warningType,
       w.gpa_snapshot    AS gpaSnapshot,
       w.failed_subjects AS failedSubjects,
       w.note,
       w.intervention,
       w.status,
       DATE_FORMAT(w.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       s.student_id      AS studentId,
       s.student_code    AS studentCode,
       ua.full_name      AS studentName,
       ua.avatar         AS studentAvatar,
       sc.class_name     AS className,
       sem.semester_name AS semesterName
     FROM academic_warning w
     INNER JOIN student s ON s.student_id = w.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     INNER JOIN semester sem ON sem.semester_id = w.semester_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     WHERE ${where}
     ORDER BY
       CASE w.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END ASC,
       w.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({
      ...r,
      gpaSnapshot:    r.gpaSnapshot === null ? null : Number(r.gpaSnapshot),
      failedSubjects: Number(r.failedSubjects),
    })),
  };
}

async function findWarningById(warningId) {
  const [[row]] = await pool.query(
    `SELECT w.warning_id AS warningId, w.student_id AS studentId, w.semester_id AS semesterId,
            w.status, s.user_id AS studentUserId
     FROM academic_warning w
     INNER JOIN student s ON s.student_id = w.student_id
     WHERE w.warning_id = ?`,
    [warningId],
  );
  return row || null;
}

async function updateWarningIntervention(warningId, { note, intervention, status }) {
  const [result] = await pool.query(
    `UPDATE academic_warning
     SET note = COALESCE(?, note),
         intervention = ?,
         status = ?
     WHERE warning_id = ?`,
    [note ?? null, intervention ?? null, status, warningId],
  );
  return result.affectedRows;
}

// ── Notification recipients (student + parents) ───────────────────────────────

async function findStudentRecipients(studentId) {
  const [[student]] = await pool.query(
    `SELECT user_id AS userId FROM student WHERE student_id = ?`,
    [studentId],
  );
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
  findTeachingAssignments,
  isTeacherAssigned,
  isTeacherForStudentSubject,
  isTeacherForStudent,
  findSemesters,
  findScoreSheet,
  findResultById,
  bulkUpsertScores,
  updateSingleScore,
  deleteScore,
  findStudentScores,
  findStudentProfile,
  findClassScores,
  findEnrolledStudents,
  findScoreLog,
  upsertWarning,
  findWarnings,
  findWarningById,
  updateWarningIntervention,
  findStudentRecipients,
};
