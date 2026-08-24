const { pool } = require("../config/db");

// ── Teaching assignments (class + subject) the teacher may assign homework to ─

async function findTeachingAssignments(teacherId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       sc.class_id     AS classId,
       sc.class_name   AS className,
       g.grade_name    AS gradeName,
       sub.subject_id  AS subjectId,
       sub.subject_name AS subjectName
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id
       AND sc.status = 'ACTIVE'
     INNER JOIN school_year sy
       ON sy.school_year_id = sc.school_year_id
     INNER JOIN grade g
       ON g.grade_id = sc.grade_id
     INNER JOIN subject sub
       ON sub.subject_id = tc.subject_id
       AND sub.status = 'ACTIVE'
     WHERE tc.teacher_id = ?
       AND tc.subject_id IS NOT NULL
       AND sy.is_active = 1
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     ORDER BY sc.class_name ASC, sub.subject_name ASC`,
    [teacherId],
  );
  return rows;
}

async function isAssignmentValid(teacherId, classId, subjectId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id
       AND sc.status = 'ACTIVE'
     INNER JOIN school_year sy
       ON sy.school_year_id = sc.school_year_id
     WHERE tc.teacher_id = ?
       AND tc.class_id = ?
       AND tc.subject_id = ?
       AND sy.is_active = 1
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     LIMIT 1`,
    [teacherId, classId, subjectId],
  );
  return Boolean(row);
}

// ── List homework owned by the teacher (with filters/search/sort/pagination) ──

async function findByTeacher(teacherId, filters = {}) {
  const {
    classId,
    subjectId,
    status,
    search,
    sort = "due_desc",
    page = 1,
    limit = 12,
  } = filters;

  const offset = (page - 1) * limit;
  const params = [teacherId];
  let where = "";

  if (classId) {
    where += " AND h.class_id = ?";
    params.push(parseInt(classId, 10));
  }
  if (subjectId) {
    where += " AND h.subject_id = ?";
    params.push(parseInt(subjectId, 10));
  }
  if (status) {
    where += " AND h.status = ?";
    params.push(status);
  }
  if (search) {
    where += " AND h.title LIKE ?";
    params.push(`%${search}%`);
  }
  if (filters.due === "overdue") {
    where += " AND h.status = 'OPEN' AND h.due_date < NOW()";
  } else if (filters.due === "upcoming") {
    where += " AND h.status = 'OPEN' AND h.due_date >= NOW()";
  }

  const ORDER = {
    due_desc:     "h.due_date DESC",
    due_asc:      "h.due_date ASC",
    created_desc: "h.assign_date DESC",
    created_asc:  "h.assign_date ASC",
    title_asc:    "h.title ASC",
  };
  const orderBy = ORDER[sort] || ORDER.due_desc;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM homework h
     WHERE h.teacher_id = ? ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       h.homework_id                                   AS homeworkId,
       h.title,
       h.max_score                                     AS maxScore,
       h.status,
       DATE_FORMAT(h.assign_date, '%Y-%m-%d %H:%i')    AS assignDate,
       DATE_FORMAT(h.due_date,    '%Y-%m-%d %H:%i')    AS dueDate,
       (h.due_date < NOW())                            AS isOverdue,

       sc.class_id                                     AS classId,
       sc.class_name                                   AS className,
       sub.subject_id                                  AS subjectId,
       sub.subject_name                                AS subjectName,

       (SELECT COUNT(*) FROM class_enrollment ce
         WHERE ce.class_id = h.class_id AND ce.status = 'ACTIVE') AS totalStudents,
       (SELECT COUNT(*) FROM homework_submission hs
         WHERE hs.homework_id = h.homework_id)         AS totalSubmissions,
       (SELECT COUNT(*) FROM homework_submission hs
         WHERE hs.homework_id = h.homework_id AND hs.status = 'GRADED') AS gradedSubmissions
     FROM homework h
     INNER JOIN school_class sc ON sc.class_id = h.class_id
     INNER JOIN subject sub     ON sub.subject_id = h.subject_id
     WHERE h.teacher_id = ? ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    total: Number(total),
    rows: rows.map((r) => ({
      ...r,
      maxScore:          Number(r.maxScore),
      isOverdue:         Boolean(r.isOverdue),
      totalStudents:     Number(r.totalStudents),
      totalSubmissions:  Number(r.totalSubmissions),
      gradedSubmissions: Number(r.gradedSubmissions),
    })),
  };
}

// ── Dashboard summary counts for the teacher ──────────────────────────────────

async function findTeacherSummary(teacherId) {
  const [[row]] = await pool.query(
    `SELECT
       COUNT(*)                                                       AS totalHomework,
       SUM(CASE WHEN h.status = 'OPEN'   THEN 1 ELSE 0 END)           AS openCount,
       SUM(CASE WHEN h.status = 'CLOSED' THEN 1 ELSE 0 END)           AS closedCount,
       SUM(CASE WHEN h.status = 'OPEN' AND h.due_date < NOW() THEN 1 ELSE 0 END) AS overdueOpen
     FROM homework h
     WHERE h.teacher_id = ?`,
    [teacherId],
  );

  const [[{ pendingGrading }]] = await pool.query(
    `SELECT COUNT(*) AS pendingGrading
     FROM homework_submission hs
     INNER JOIN homework h ON h.homework_id = hs.homework_id
     WHERE h.teacher_id = ?
       AND hs.status = 'SUBMITTED'`,
    [teacherId],
  );

  return {
    totalHomework: Number(row.totalHomework),
    openCount:     Number(row.openCount),
    closedCount:   Number(row.closedCount),
    overdueOpen:   Number(row.overdueOpen),
    pendingGrading: Number(pendingGrading),
  };
}

// ── Single homework detail (+ attachments) ────────────────────────────────────

async function findDetailById(homeworkId) {
  const [[row]] = await pool.query(
    `SELECT
       h.homework_id                                 AS homeworkId,
       h.title,
       h.content                                     AS description,
       h.instructions,
       h.max_score                                   AS maxScore,
       h.status,
       h.teacher_id                                  AS teacherId,
       DATE_FORMAT(h.assign_date, '%Y-%m-%d %H:%i')  AS assignDate,
       DATE_FORMAT(h.due_date,    '%Y-%m-%d %H:%i')  AS dueDate,
       (h.due_date < NOW())                          AS isOverdue,

       sc.class_id    AS classId,
       sc.class_name  AS className,
       g.grade_name   AS gradeName,
       sub.subject_id AS subjectId,
       sub.subject_name AS subjectName
     FROM homework h
     INNER JOIN school_class sc ON sc.class_id = h.class_id
     INNER JOIN grade g         ON g.grade_id = sc.grade_id
     INNER JOIN subject sub     ON sub.subject_id = h.subject_id
     WHERE h.homework_id = ?`,
    [homeworkId],
  );

  if (!row) return null;

  const [attachments] = await pool.query(
    `SELECT
       attachment_id AS attachmentId,
       file_name     AS fileName,
       file_url      AS fileUrl,
       file_type     AS fileType
     FROM attachment
     WHERE related_type = 'HOMEWORK'
       AND related_id = ?
     ORDER BY attachment_id ASC`,
    [homeworkId],
  );

  return {
    ...row,
    maxScore:    Number(row.maxScore),
    isOverdue:   Boolean(row.isOverdue),
    attachments,
  };
}

// ── Create homework (single row); returns inserted id ─────────────────────────

async function insertHomework(conn, hw) {
  const [result] = await conn.query(
    `INSERT INTO homework
       (class_id, subject_id, teacher_id, title, content, max_score, instructions, due_date, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
    [
      hw.classId,
      hw.subjectId,
      hw.teacherId,
      hw.title,
      hw.description ?? null,
      hw.maxScore,
      hw.instructions ?? null,
      hw.dueDate,
    ],
  );
  return result.insertId;
}

async function linkAttachments(conn, homeworkId, attachmentIds) {
  if (!attachmentIds.length) return;
  const placeholders = attachmentIds.map(() => "?").join(",");
  await conn.query(
    `UPDATE attachment
     SET related_type = 'HOMEWORK', related_id = ?
     WHERE attachment_id IN (${placeholders})`,
    [homeworkId, ...attachmentIds],
  );
}

async function updateHomework(homeworkId, fields) {
  const [result] = await pool.query(
    `UPDATE homework
     SET title        = ?,
         content      = ?,
         instructions = ?,
         max_score    = ?,
         due_date     = ?,
         status       = ?
     WHERE homework_id = ?
       AND status = 'OPEN'`,
    [
      fields.title,
      fields.description ?? null,
      fields.instructions ?? null,
      fields.maxScore,
      fields.dueDate,
      fields.status,
      homeworkId,
    ],
  );
  return result.affectedRows;
}

async function setStatus(homeworkId, status) {
  const [result] = await pool.query(
    `UPDATE homework SET status = ? WHERE homework_id = ?`,
    [status, homeworkId],
  );
  return result.affectedRows;
}

// ── Submission tracking ───────────────────────────────────────────────────────

async function findSubmissionsByHomework(homeworkId, classId) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id                                   AS studentId,
       s.student_code                                 AS studentCode,
       ua.full_name                                   AS studentName,
       ua.avatar                                      AS studentAvatar,

       hs.submission_id                               AS submissionId,
       DATE_FORMAT(hs.submit_time, '%Y-%m-%d %H:%i')  AS submitTime,
       hs.file_url                                    AS fileUrl,
       hs.content,
       hs.score,
       hs.feedback,
       DATE_FORMAT(hs.graded_at, '%Y-%m-%d %H:%i')    AS gradedAt,
       grader.full_name                               AS graderName,
       hs.status                                      AS submissionStatus,
       (hs.submit_time > h.due_date)                  AS isLate
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id
       AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
       AND ua.status = 'ACTIVE'
     LEFT JOIN homework_submission hs
       ON hs.homework_id = ?
       AND hs.student_id = s.student_id
     LEFT JOIN homework h
       ON h.homework_id = ?
     LEFT JOIN user_account grader
       ON grader.user_id = hs.graded_by
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [homeworkId, homeworkId, classId],
  );

  return rows.map((r) => ({
    studentId:    r.studentId,
    studentCode:  r.studentCode,
    studentName:  r.studentName,
    studentAvatar: r.studentAvatar,
    submissionId: r.submissionId,
    submitTime:   r.submitTime,
    fileUrl:      r.fileUrl,
    content:      r.content,
    score:        r.score === null ? null : Number(r.score),
    feedback:     r.feedback,
    gradedAt:     r.gradedAt,
    graderName:   r.graderName,
    isLate:       Boolean(r.isLate),
    status:       r.submissionId
      ? r.submissionStatus
      : "MISSING",
  }));
}

async function findSubmissionById(submissionId) {
  const [[row]] = await pool.query(
    `SELECT
       hs.submission_id  AS submissionId,
       hs.homework_id    AS homeworkId,
       hs.student_id     AS studentId,
       hs.score,
       hs.feedback,
       hs.status,
       s.user_id         AS studentUserId,
       h.teacher_id      AS teacherId,
       h.title           AS homeworkTitle,
       h.class_id        AS classId,
       h.max_score       AS maxScore
     FROM homework_submission hs
     INNER JOIN homework h ON h.homework_id = hs.homework_id
     INNER JOIN student s  ON s.student_id = hs.student_id
     WHERE hs.submission_id = ?`,
    [submissionId],
  );
  if (!row) return null;
  return {
    ...row,
    score:    row.score === null ? null : Number(row.score),
    maxScore: Number(row.maxScore),
  };
}

// ── Grade a submission (transaction: update + audit log) ──────────────────────

async function applyGrade({ submissionId, graderUserId, oldScore, newScore, feedback, action, notification }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE homework_submission
       SET score     = ?,
           feedback  = ?,
           graded_by = ?,
           graded_at = NOW(),
           status    = 'GRADED'
       WHERE submission_id = ?`,
      [newScore, feedback ?? null, graderUserId, submissionId],
    );

    await conn.query(
      `INSERT INTO homework_grade_log
         (submission_id, grader_id, action, old_score, new_score, feedback)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [submissionId, graderUserId, action, oldScore, newScore, feedback ?? null],
    );

    if (notification) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES ?`,
        [
          notification.receivers.map((rid) => [
            rid,
            notification.title,
            notification.content,
            "HOMEWORK",
            "HOMEWORK",
            notification.relatedId,
            false,
          ]),
        ],
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

async function findGradeLog(submissionId) {
  const [rows] = await pool.query(
    `SELECT
       gl.grade_log_id                              AS gradeLogId,
       gl.action,
       gl.old_score                                 AS oldScore,
       gl.new_score                                 AS newScore,
       gl.feedback,
       DATE_FORMAT(gl.created_at, '%Y-%m-%d %H:%i') AS createdAt,
       ua.full_name                                 AS graderName
     FROM homework_grade_log gl
     INNER JOIN user_account ua ON ua.user_id = gl.grader_id
     WHERE gl.submission_id = ?
     ORDER BY gl.created_at ASC`,
    [submissionId],
  );
  return rows.map((r) => ({
    ...r,
    oldScore: r.oldScore === null ? null : Number(r.oldScore),
    newScore: r.newScore === null ? null : Number(r.newScore),
  }));
}

// ── Analytics ─────────────────────────────────────────────────────────────────

async function findAnalytics(homeworkId, classId) {
  const [[counts]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM class_enrollment ce
         WHERE ce.class_id = ? AND ce.status = 'ACTIVE')                AS totalStudents,
       (SELECT COUNT(*) FROM homework_submission hs
         WHERE hs.homework_id = ?)                                      AS totalSubmissions,
       (SELECT COUNT(*) FROM homework_submission hs
         WHERE hs.homework_id = ? AND hs.status = 'GRADED')             AS gradedCount,
       (SELECT COUNT(*) FROM homework_submission hs
         INNER JOIN homework h ON h.homework_id = hs.homework_id
         WHERE hs.homework_id = ? AND hs.submit_time > h.due_date)      AS lateCount,
       (SELECT AVG(hs.score) FROM homework_submission hs
         WHERE hs.homework_id = ? AND hs.score IS NOT NULL)             AS avgScore`,
    [classId, homeworkId, homeworkId, homeworkId, homeworkId],
  );

  const totalStudents    = Number(counts.totalStudents);
  const totalSubmissions = Number(counts.totalSubmissions);
  const gradedCount      = Number(counts.gradedCount);
  const lateCount        = Number(counts.lateCount);
  const missingCount     = Math.max(0, totalStudents - totalSubmissions);
  const avgScore         = counts.avgScore === null ? null : Math.round(Number(counts.avgScore) * 100) / 100;

  return {
    totalStudents,
    totalSubmissions,
    gradedCount,
    lateCount,
    missingCount,
    avgScore,
    submissionRate: totalStudents > 0 ? Math.round((totalSubmissions / totalStudents) * 1000) / 10 : 0,
    completionRate: totalStudents > 0 ? Math.round((gradedCount / totalStudents) * 1000) / 10 : 0,
  };
}

// ── Notification recipients for a class (students + their parents) ────────────

async function findClassNotificationRecipients(classId) {
  const [students] = await pool.query(
    `SELECT s.user_id AS userId
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id
       AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
       AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'`,
    [classId],
  );

  const [parents] = await pool.query(
    `SELECT pp.user_id AS userId
     FROM class_enrollment ce
     INNER JOIN student_parent sp
       ON sp.student_id = ce.student_id
     INNER JOIN parent_profile pp
       ON pp.parent_id = sp.parent_id
     INNER JOIN user_account ua
       ON ua.user_id = pp.user_id
       AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'`,
    [classId],
  );

  const ids = [
    ...students.map((r) => r.userId),
    ...parents.map((r) => r.userId),
  ];
  return [...new Set(ids)];
}

async function insertNotifications(receivers, title, content, relatedId) {
  if (!receivers.length) return;
  const values = receivers.map((rid) => [
    rid, title, content, "HOMEWORK", "HOMEWORK", relatedId, false,
  ]);
  await pool.query(
    `INSERT INTO notification
       (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [values],
  );
}

// ── Attachment helpers (file upload integration) ──────────────────────────────

async function insertAttachment({ relatedType, relatedId, fileName, fileUrl, fileType, uploadedBy }) {
  const [result] = await pool.query(
    `INSERT INTO attachment
       (related_type, related_id, file_name, file_url, file_type, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [relatedType, relatedId, fileName, fileUrl, fileType, uploadedBy],
  );
  return result.insertId;
}

async function deleteAttachment(attachmentId, homeworkId) {
  const [result] = await pool.query(
    `DELETE FROM attachment
     WHERE attachment_id = ?
       AND related_type = 'HOMEWORK'
       AND related_id = ?`,
    [attachmentId, homeworkId],
  );
  return result.affectedRows;
}

// ── List homework for a specific student (parent/student read-only view) ──────

async function findByStudentId(studentId, filters = {}) {
  const { subjectId, status, search, submissionStatus, sort = "due_desc", page = 1, limit = 12 } = filters;
  const offset = (page - 1) * limit;

  const ORDER = {
    due_desc:     "h.due_date DESC",
    due_asc:      "h.due_date ASC",
    created_desc: "h.assign_date DESC",
    created_asc:  "h.assign_date ASC",
    title_asc:    "h.title ASC",
  };
  const orderBy = ORDER[sort] || ORDER.due_desc;

  // Base filters (status, subject, search) — applied to all 3 queries
  const baseParams = [];
  let baseWhere = "";
  if (subjectId) {
    baseWhere += " AND h.subject_id = ?";
    baseParams.push(parseInt(subjectId, 10));
  }
  if (status) {
    baseWhere += " AND h.status = ?";
    baseParams.push(status);
  }
  if (search) {
    baseWhere += " AND h.title LIKE ?";
    baseParams.push(`%${search}%`);
  }

  // submissionStatus filter via EXISTS — applied only to count + data queries
  let subWhere = "";
  const subParams = [];
  if (submissionStatus === "GRADED") {
    subWhere = " AND EXISTS (SELECT 1 FROM homework_submission s2 WHERE s2.homework_id = h.homework_id AND s2.student_id = ? AND s2.status = 'GRADED')";
    subParams.push(studentId);
  } else if (submissionStatus === "SUBMITTED") {
    subWhere = " AND EXISTS (SELECT 1 FROM homework_submission s2 WHERE s2.homework_id = h.homework_id AND s2.student_id = ? AND s2.status = 'SUBMITTED')";
    subParams.push(studentId);
  } else if (submissionStatus === "MISSING") {
    subWhere = " AND NOT EXISTS (SELECT 1 FROM homework_submission s2 WHERE s2.homework_id = h.homework_id AND s2.student_id = ?)";
    subParams.push(studentId);
  }

  // Summary query — uses baseWhere only (not submissionStatus) so chip counts are stable
  const [[summaryRow]] = await pool.query(
    `SELECT
       COUNT(*)                                                         AS total,
       SUM(CASE WHEN hs.status = 'GRADED'    THEN 1 ELSE 0 END)        AS graded,
       SUM(CASE WHEN hs.status = 'SUBMITTED' THEN 1 ELSE 0 END)        AS submitted,
       SUM(CASE WHEN hs.submission_id IS NULL THEN 1 ELSE 0 END)        AS missing
     FROM homework h
     INNER JOIN class_enrollment ce
       ON ce.class_id = h.class_id AND ce.student_id = ? AND ce.status = 'ACTIVE'
     LEFT JOIN homework_submission hs
       ON hs.homework_id = h.homework_id AND hs.student_id = ?
     WHERE 1=1 ${baseWhere}`,
    [studentId, studentId, ...baseParams],
  );

  // Paginated count (respects submissionStatus filter)
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM homework h
     INNER JOIN class_enrollment ce
       ON ce.class_id = h.class_id AND ce.student_id = ? AND ce.status = 'ACTIVE'
     WHERE 1=1 ${baseWhere}${subWhere}`,
    [studentId, ...baseParams, ...subParams],
  );

  const [rows] = await pool.query(
    `SELECT
       h.homework_id                                   AS homeworkId,
       h.title,
       h.max_score                                     AS maxScore,
       h.status,
       DATE_FORMAT(h.assign_date, '%Y-%m-%d %H:%i')    AS assignDate,
       DATE_FORMAT(h.due_date,    '%Y-%m-%d %H:%i')    AS dueDate,
       (h.due_date < NOW())                            AS isOverdue,

       sc.class_id                                     AS classId,
       sc.class_name                                   AS className,
       sub.subject_id                                  AS subjectId,
       sub.subject_name                                AS subjectName,

       hs.submission_id                                AS submissionId,
       hs.score,
       hs.feedback,
       DATE_FORMAT(hs.submit_time, '%Y-%m-%d %H:%i')   AS submitTime,
       (hs.submit_time > h.due_date)                   AS isLate,
       hs.status                                       AS submissionStatus
     FROM homework h
     INNER JOIN school_class sc ON sc.class_id = h.class_id
     INNER JOIN subject sub     ON sub.subject_id = h.subject_id
     INNER JOIN class_enrollment ce
       ON ce.class_id = h.class_id AND ce.student_id = ? AND ce.status = 'ACTIVE'
     LEFT JOIN homework_submission hs
       ON hs.homework_id = h.homework_id AND hs.student_id = ?
     WHERE 1=1 ${baseWhere}${subWhere}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [studentId, studentId, ...baseParams, ...subParams, limit, offset],
  );

  return {
    total: Number(total),
    summary: {
      total:     Number(summaryRow.total),
      graded:    Number(summaryRow.graded),
      submitted: Number(summaryRow.submitted),
      missing:   Number(summaryRow.missing),
    },
    rows: rows.map((r) => ({
      ...r,
      maxScore:         Number(r.maxScore),
      isOverdue:        Boolean(r.isOverdue),
      isLate:           r.isLate !== null ? Boolean(r.isLate) : false,
      score:            r.score === null ? null : Number(r.score),
      submissionStatus: r.submissionId ? r.submissionStatus : "MISSING",
    })),
  };
}

// ── Homework detail + student's own submission (parent/student read-only) ─────

async function findDetailWithStudentSubmission(homeworkId, studentId) {
  const [[row]] = await pool.query(
    `SELECT
       h.homework_id                                  AS homeworkId,
       h.title,
       h.content                                      AS description,
       h.instructions,
       h.max_score                                    AS maxScore,
       h.status,
       DATE_FORMAT(h.assign_date, '%Y-%m-%d %H:%i')   AS assignDate,
       DATE_FORMAT(h.due_date,    '%Y-%m-%d %H:%i')   AS dueDate,
       (h.due_date < NOW())                           AS isOverdue,

       sc.class_id                                    AS classId,
       sc.class_name                                  AS className,
       g.grade_name                                   AS gradeName,
       sub.subject_id                                 AS subjectId,
       sub.subject_name                               AS subjectName,
       ua.full_name                                   AS teacherName,

       hs.submission_id                               AS submissionId,
       hs.score,
       hs.feedback,
       DATE_FORMAT(hs.submit_time, '%Y-%m-%d %H:%i')  AS submitTime,
       hs.content                                     AS submissionContent,
       hs.file_url                                    AS submissionFileUrl,
       (hs.submit_time > h.due_date)                  AS isLate,
       hs.status                                      AS submissionStatus
     FROM homework h
     INNER JOIN school_class sc  ON sc.class_id = h.class_id
     INNER JOIN grade g          ON g.grade_id = sc.grade_id
     INNER JOIN subject sub      ON sub.subject_id = h.subject_id
     INNER JOIN teacher t        ON t.teacher_id = h.teacher_id
     INNER JOIN user_account ua  ON ua.user_id = t.user_id
     INNER JOIN class_enrollment ce
       ON ce.class_id = h.class_id
       AND ce.student_id = ?
       AND ce.status = 'ACTIVE'
     LEFT JOIN homework_submission hs
       ON hs.homework_id = h.homework_id
       AND hs.student_id = ?
     WHERE h.homework_id = ?`,
    [studentId, studentId, homeworkId],
  );

  if (!row) return null;

  const [attachments] = await pool.query(
    `SELECT
       attachment_id AS attachmentId,
       file_name     AS fileName,
       file_url      AS fileUrl,
       file_type     AS fileType
     FROM attachment
     WHERE related_type = 'HOMEWORK'
       AND related_id = ?
     ORDER BY attachment_id ASC`,
    [homeworkId],
  );

  return {
    ...row,
    maxScore:         Number(row.maxScore),
    isOverdue:        Boolean(row.isOverdue),
    isLate:           row.isLate !== null ? Boolean(row.isLate) : false,
    score:            row.score === null ? null : Number(row.score),
    submissionStatus: row.submissionId ? row.submissionStatus : "MISSING",
    attachments,
  };
}

// ── Student submit / resubmit homework ───────────────────────────────────────

async function submitStudentSubmission({
  homeworkId,
  studentId,
  actorUserId,
  content,
  fileUrl,
}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [[homework]] = await conn.query(
      `SELECT
         h.homework_id AS homeworkId,
         h.title,
         h.status,
         h.due_date AS dueDate,
         (h.due_date < NOW()) AS isOverdue,
         h.teacher_id AS teacherId,
         t.user_id AS teacherUserId
       FROM homework h
       INNER JOIN teacher t
         ON t.teacher_id = h.teacher_id
       INNER JOIN class_enrollment ce
         ON ce.class_id = h.class_id
         AND ce.student_id = ?
         AND ce.status = 'ACTIVE'
       WHERE h.homework_id = ?
       LIMIT 1`,
      [studentId, homeworkId],
    );

    if (!homework) {
      const error = new Error("Không tìm thấy bài tập hoặc bài tập không thuộc lớp của bạn");
      error.statusCode = 404;
      throw error;
    }

    if (!["OPEN", "PUBLISHED", "ACTIVE"].includes(homework.status)) {
      const error = new Error("Bài tập hiện không mở để nộp bài");
      error.statusCode = 409;
      throw error;
    }

    if (Boolean(homework.isOverdue)) {
      const error = new Error("Bài tập đã quá hạn nộp");
      error.statusCode = 409;
      throw error;
    }

    const [[existing]] = await conn.query(
      `SELECT
         submission_id AS submissionId,
         status
       FROM homework_submission
       WHERE homework_id = ?
         AND student_id = ?
       LIMIT 1`,
      [homeworkId, studentId],
    );

    if (existing?.status === "GRADED") {
      const error = new Error("Bài nộp đã được chấm, không thể nộp lại");
      error.statusCode = 409;
      throw error;
    }

    let submissionId;

    if (existing) {
      submissionId = existing.submissionId;

      await conn.query(
        `UPDATE homework_submission
         SET content = ?,
             file_url = COALESCE(?, file_url),
             submit_time = NOW(),
             score = NULL,
             feedback = NULL,
             graded_by = NULL,
             graded_at = NULL,
             status = 'SUBMITTED'
         WHERE submission_id = ?`,
        [content || null, fileUrl || null, submissionId],
      );
    } else {
      const [result] = await conn.query(
        `INSERT INTO homework_submission
           (homework_id, student_id, submit_time, file_url, content, status)
         VALUES (?, ?, NOW(), ?, ?, 'SUBMITTED')`,
        [homeworkId, studentId, fileUrl || null, content || null],
      );

      submissionId = result.insertId;
    }

    const [[student]] = await conn.query(
      `SELECT ua.full_name AS fullName
       FROM student s
       INNER JOIN user_account ua
         ON ua.user_id = s.user_id
       WHERE s.student_id = ?`,
      [studentId],
    );

    if (homework.teacherUserId) {
      await conn.query(
        `INSERT INTO notification
           (receiver_id, title, content, type, related_type, related_id, is_read)
         VALUES (?, ?, ?, 'HOMEWORK', 'HOMEWORK', ?, false)`,
        [
          homework.teacherUserId,
          "Học sinh đã nộp bài",
          `${student?.fullName || "Học sinh"} đã nộp bài "${homework.title}".`,
          homeworkId,
        ],
      );
    }

    await conn.commit();

    return {
      submissionId,
      isResubmission: Boolean(existing),
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = {
  findTeachingAssignments,
  isAssignmentValid,
  findByTeacher,
  findTeacherSummary,
  findDetailById,
  insertHomework,
  linkAttachments,
  updateHomework,
  setStatus,
  findSubmissionsByHomework,
  findSubmissionById,
  applyGrade,
  findGradeLog,
  findAnalytics,
  findClassNotificationRecipients,
  insertNotifications,
  insertAttachment,
  deleteAttachment,
  findByStudentId,
  findDetailWithStudentSubmission,
  submitStudentSubmission,
};
