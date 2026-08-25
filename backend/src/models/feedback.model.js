const { pool } = require("../config/db");

// ── Lesson feedback (GVBM → HS theo tiết) ─────────────────────────────────────

async function bulkUpsertLessonFeedback({ timetableId, teacherId, date, items }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const it of items) {
      await conn.query(
        `INSERT INTO lesson_feedback (timetable_id, student_id, teacher_id, feedback_date, rating, content)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), content = VALUES(content), teacher_id = VALUES(teacher_id)`,
        [timetableId, it.studentId, teacherId, date, it.rating ?? null, it.content ?? null],
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

async function findPeriodFeedback(timetableId, date) {
  const [rows] = await pool.query(
    `SELECT feedback_id AS feedbackId, student_id AS studentId, rating, content
     FROM lesson_feedback WHERE timetable_id = ? AND feedback_date = ?`,
    [timetableId, date],
  );
  return rows;
}

// Nhận xét theo tiết để phụ huynh / học sinh xem.
async function findStudentFeedback(studentId, limit = 100) {
  const [rows] = await pool.query(
    `SELECT
       lf.feedback_id AS feedbackId,
       DATE_FORMAT(lf.feedback_date, '%Y-%m-%d') AS feedbackDate,
       lf.rating, lf.content,
       tt.period_no    AS periodNo,
       sub.subject_name AS subjectName,
       sc.class_name    AS className,
       ua.full_name     AS teacherName
     FROM lesson_feedback lf
     INNER JOIN timetable tt ON tt.timetable_id = lf.timetable_id
     INNER JOIN subject sub ON sub.subject_id = tt.subject_id
     INNER JOIN school_class sc ON sc.class_id = tt.class_id
     INNER JOIN teacher t ON t.teacher_id = lf.teacher_id
     INNER JOIN user_account ua ON ua.user_id = t.user_id
     WHERE lf.student_id = ? AND (lf.rating IS NOT NULL OR (lf.content IS NOT NULL AND lf.content <> ''))
     ORDER BY lf.feedback_date DESC, lf.feedback_id DESC
     LIMIT ?`,
    [studentId, limit],
  );
  return rows;
}

// ── Teacher survey (HS → GV, ẩn danh) ─────────────────────────────────────────

// Kiểm tra GV có thực sự dạy lớp/môn này không, trước khi tạo khảo sát —
// tránh tạo khảo sát "vô hình" (không học sinh nào thoả điều kiện join ở
// findOpenSurveysForStudent) do staff chọn nhầm tổ hợp GV/lớp/môn.
async function teacherClassAssignmentExists({ teacherId, classId, subjectId }) {
  const conditions = ["tc.teacher_id = ?", "(tc.end_date IS NULL OR tc.end_date >= CURRENT_DATE)"];
  const params = [teacherId];
  if (classId) {
    conditions.push("tc.class_id = ?");
    params.push(classId);
  }
  if (subjectId) {
    conditions.push("tc.subject_id = ?");
    params.push(subjectId);
  }
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class tc WHERE ${conditions.join(" AND ")} LIMIT 1`,
    params,
  );
  return Boolean(row);
}

async function createSurvey(s) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Khóa giáo viên để hai request đồng thời không tạo hai khảo sát giống nhau.
    await conn.query("SELECT teacher_id FROM teacher WHERE teacher_id = ? FOR UPDATE", [s.teacherId]);
    const [[existing]] = await conn.query(
      `SELECT survey_id AS surveyId
       FROM teacher_survey
       WHERE semester_id = ? AND teacher_id = ?
         AND subject_id <=> ? AND class_id <=> ? AND status = 'OPEN'
       LIMIT 1`,
      [s.semesterId, s.teacherId, s.subjectId ?? null, s.classId ?? null],
    );
    if (existing) {
      const error = new Error("Khảo sát này đang mở và đã tồn tại");
      error.statusCode = 409;
      throw error;
    }
    const [r] = await conn.query(
      `INSERT INTO teacher_survey (semester_id, teacher_id, subject_id, class_id, title, status, opened_at, created_by)
       VALUES (?, ?, ?, ?, ?, 'OPEN', NOW(), ?)`,
      [s.semesterId, s.teacherId, s.subjectId ?? null, s.classId ?? null, s.title ?? null, s.createdBy ?? null],
    );
    await conn.commit();
    return r.insertId;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function setSurveyStatus(surveyId, status) {
  await pool.query(
    `UPDATE teacher_survey target
     INNER JOIN teacher_survey source ON source.survey_id = ?
     SET target.status = ?,
         target.closed_at = IF(? = 'CLOSED', NOW(), target.closed_at)
     WHERE target.semester_id = source.semester_id
       AND target.teacher_id = source.teacher_id
       AND target.subject_id <=> source.subject_id
       AND target.class_id <=> source.class_id`,
    [surveyId, status, status],
  );
}

async function findSurveyById(surveyId) {
  const [[row]] = await pool.query(
    `SELECT survey_id AS surveyId, semester_id AS semesterId, teacher_id AS teacherId,
            subject_id AS subjectId, class_id AS classId, title, status, created_by AS createdBy
     FROM teacher_survey WHERE survey_id = ?`,
    [surveyId],
  );
  return row || null;
}

// Khảo sát ĐANG MỞ mà 1 học sinh có thể đánh giá (GV dạy lớp HS) + đã nộp chưa.
async function findOpenSurveysForStudent(studentId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       ts.survey_id AS surveyId,
       ts.title,
       sub.subject_name AS subjectName,
       ua.full_name AS teacherName,
       CASE WHEN b.student_id IS NULL THEN 0 ELSE 1 END AS submitted,
       -- Phải có trong SELECT vì ORDER BY dùng nó: MySQL strict mode báo
       -- ER_FIELD_IN_ORDER_NOT_SELECT khi ORDER BY cột ngoài SELECT của DISTINCT.
       ts.created_at AS createdAt
     FROM teacher_survey ts
     INNER JOIN teacher t ON t.teacher_id = ts.teacher_id
     INNER JOIN user_account ua ON ua.user_id = t.user_id
     INNER JOIN semester sem ON sem.semester_id = ts.semester_id
     LEFT JOIN subject sub ON sub.subject_id = ts.subject_id
     INNER JOIN class_enrollment ce
       ON ce.student_id = ?
       AND ce.status = 'ACTIVE'
     INNER JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.school_year_id = sem.school_year_id
     INNER JOIN teacher_class tc
       ON tc.class_id = ce.class_id
       AND tc.teacher_id = ts.teacher_id
       AND (tc.end_date IS NULL OR tc.end_date >= CURRENT_DATE)
       AND (ts.subject_id IS NULL OR tc.subject_id = ts.subject_id)
     LEFT JOIN teacher_survey_ballot b
       ON b.survey_id = ts.survey_id
       AND b.student_id = ?
     WHERE ts.status = 'OPEN'
       AND NOT EXISTS (
         SELECT 1 FROM teacher_survey earlier
         WHERE earlier.survey_id < ts.survey_id
           AND earlier.status = 'OPEN'
           AND earlier.semester_id = ts.semester_id
           AND earlier.teacher_id = ts.teacher_id
           AND earlier.subject_id <=> ts.subject_id
           AND earlier.class_id <=> ts.class_id
       )
       AND (ts.opened_at IS NULL OR ts.opened_at <= NOW())
       AND (ts.closed_at IS NULL OR ts.closed_at > NOW())
       AND (ts.class_id IS NULL OR ts.class_id = ce.class_id)
     ORDER BY ts.created_at DESC`,
    [studentId, studentId],
  );
  return rows.map((row) => ({ ...row, submitted: Boolean(row.submitted) }));
}

async function canStudentSubmitSurvey(surveyId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS eligible
     FROM teacher_survey ts
     INNER JOIN semester sem ON sem.semester_id = ts.semester_id
     INNER JOIN class_enrollment ce
       ON ce.student_id = ?
       AND ce.status = 'ACTIVE'
     INNER JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.school_year_id = sem.school_year_id
     INNER JOIN teacher_class tc
       ON tc.class_id = ce.class_id
       AND tc.teacher_id = ts.teacher_id
       AND (tc.end_date IS NULL OR tc.end_date >= CURRENT_DATE)
       AND (ts.subject_id IS NULL OR tc.subject_id = ts.subject_id)
     WHERE ts.survey_id = ?
       AND ts.status = 'OPEN'
       AND (ts.opened_at IS NULL OR ts.opened_at <= NOW())
       AND (ts.closed_at IS NULL OR ts.closed_at > NOW())
       AND (ts.class_id IS NULL OR ts.class_id = ce.class_id)
     LIMIT 1`,
    [studentId, surveyId],
  );
  return Boolean(row);
}

async function hasSubmitted(surveyId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_survey_ballot WHERE survey_id = ? AND student_id = ? LIMIT 1`,
    [surveyId, studentId],
  );
  return Boolean(row);
}

// Nộp khảo sát: ghi câu trả lời (KHÔNG kèm student_id) + phiếu chống trùng, trong 1 transaction.
async function submitSurveyResponse({ surveyId, studentId, score, comment }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Chống trùng: chèn ballot trước (unique PK) — nếu đã nộp sẽ lỗi ER_DUP_ENTRY.
    await conn.query(
      `INSERT INTO teacher_survey_ballot (survey_id, student_id) VALUES (?, ?)`,
      [surveyId, studentId],
    );
    await conn.query(
      `INSERT INTO teacher_survey_response (survey_id, score, comment) VALUES (?, ?, ?)`,
      [surveyId, score ?? null, comment ?? null],
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Tổng hợp ẩn danh cho quản lý (không lộ danh tính HS).
async function findSurveyAggregate(surveyId) {
  const [[agg]] = await pool.query(
    `SELECT COUNT(*) AS responseCount, ROUND(AVG(score), 2) AS avgScore,
            SUM(score = 5) AS s5, SUM(score = 4) AS s4, SUM(score = 3) AS s3, SUM(score = 2) AS s2, SUM(score = 1) AS s1
     FROM teacher_survey_response response
     INNER JOIN teacher_survey sibling ON sibling.survey_id = response.survey_id
     INNER JOIN teacher_survey source ON source.survey_id = ?
     WHERE sibling.semester_id = source.semester_id
       AND sibling.teacher_id = source.teacher_id
       AND sibling.subject_id <=> source.subject_id
       AND sibling.class_id <=> source.class_id`,
    [surveyId],
  );
  const [comments] = await pool.query(
    `SELECT response.comment
     FROM teacher_survey_response response
     INNER JOIN teacher_survey sibling ON sibling.survey_id = response.survey_id
     INNER JOIN teacher_survey source ON source.survey_id = ?
     WHERE sibling.semester_id = source.semester_id
       AND sibling.teacher_id = source.teacher_id
       AND sibling.subject_id <=> source.subject_id
       AND sibling.class_id <=> source.class_id
       AND response.comment IS NOT NULL AND response.comment <> ''
     ORDER BY response.submitted_at DESC`,
    [surveyId],
  );
  return {
    responseCount: Number(agg.responseCount),
    avgScore: agg.avgScore === null ? null : Number(agg.avgScore),
    distribution: { 5: Number(agg.s5), 4: Number(agg.s4), 3: Number(agg.s3), 2: Number(agg.s2), 1: Number(agg.s1) },
    comments: comments.map((c) => c.comment),
  };
}

// Danh sách khảo sát cho quản lý (staff/admin) — kèm số phản hồi + điểm TB (ẩn danh).
async function findSurveysForStaff() {
  const [rows] = await pool.query(
    `SELECT
       ts.survey_id AS surveyId, ts.title, ts.status,
       ts.semester_id AS semesterId, sem.semester_name AS semesterName,
       t.teacher_id AS teacherId, ua.full_name AS teacherName,
       sub.subject_name AS subjectName, sc.class_name AS className,
       (SELECT COUNT(*)
        FROM teacher_survey_response r
        INNER JOIN teacher_survey sibling ON sibling.survey_id = r.survey_id
        WHERE sibling.semester_id = ts.semester_id
          AND sibling.teacher_id = ts.teacher_id
          AND sibling.subject_id <=> ts.subject_id
          AND sibling.class_id <=> ts.class_id) AS responseCount,
       ROUND((SELECT AVG(r.score)
        FROM teacher_survey_response r
        INNER JOIN teacher_survey sibling ON sibling.survey_id = r.survey_id
        WHERE sibling.semester_id = ts.semester_id
          AND sibling.teacher_id = ts.teacher_id
          AND sibling.subject_id <=> ts.subject_id
          AND sibling.class_id <=> ts.class_id), 2) AS avgScore
     FROM teacher_survey ts
     INNER JOIN teacher t ON t.teacher_id = ts.teacher_id
     INNER JOIN user_account ua ON ua.user_id = t.user_id
     INNER JOIN semester sem ON sem.semester_id = ts.semester_id
     LEFT JOIN subject sub ON sub.subject_id = ts.subject_id
     LEFT JOIN school_class sc ON sc.class_id = ts.class_id
     WHERE NOT EXISTS (
       SELECT 1 FROM teacher_survey earlier
       WHERE earlier.survey_id < ts.survey_id
         AND earlier.semester_id = ts.semester_id
         AND earlier.teacher_id = ts.teacher_id
         AND earlier.subject_id <=> ts.subject_id
         AND earlier.class_id <=> ts.class_id
     )
     ORDER BY ts.created_at DESC`,
  );
  return rows.map((r) => ({
    ...r,
    responseCount: Number(r.responseCount),
    avgScore: r.avgScore === null ? null : Number(r.avgScore),
  }));
}

module.exports = {
  bulkUpsertLessonFeedback,
  findPeriodFeedback,
  findStudentFeedback,
  teacherClassAssignmentExists,
  createSurvey,
  setSurveyStatus,
  findSurveyById,
  findOpenSurveysForStudent,
  canStudentSubmitSurvey,
  hasSubmitted,
  submitSurveyResponse,
  findSurveyAggregate,
  findSurveysForStaff,
};
