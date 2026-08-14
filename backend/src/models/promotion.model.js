const { pool } = require("../config/db");

async function findSchoolYearById(schoolYearId) {
  const [[row]] = await pool.query(
    `SELECT school_year_id AS schoolYearId, year_name AS yearName,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            is_active AS isActive,
            end_date < CURDATE() AS hasEnded,
            status
     FROM school_year
     WHERE school_year_id = ?
     LIMIT 1`,
    [schoolYearId],
  );

  return row
    ? {
        ...row,
        isActive: Boolean(row.isActive),
        hasEnded: Boolean(Number(row.hasEnded)),
      }
    : null;
}

async function findNextSchoolYear(schoolYearId) {
  const source = await findSchoolYearById(schoolYearId);
  if (!source) return null;

  const [[row]] = await pool.query(
    `SELECT school_year_id AS schoolYearId, year_name AS yearName,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            is_active AS isActive, status
     FROM school_year
     WHERE start_date > ?
     ORDER BY start_date ASC
     LIMIT 1`,
    [source.startDate],
  );

  return row ? { ...row, isActive: Boolean(row.isActive) } : null;
}

async function findPreviousSchoolYear(targetSchoolYearId) {
  const target = await findSchoolYearById(targetSchoolYearId);
  if (!target) return null;

  const [[row]] = await pool.query(
    `SELECT school_year_id AS schoolYearId, year_name AS yearName,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            is_active AS isActive, status
     FROM school_year
     WHERE start_date < ?
     ORDER BY start_date DESC
     LIMIT 1`,
    [target.startDate],
  );

  return row ? { ...row, isActive: Boolean(row.isActive) } : null;
}

async function findStudentsForSchoolYear(schoolYearId) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id AS studentId,
       s.student_code AS studentCode,
       ua.full_name AS fullName,
       ce.enrollment_id AS enrollmentId,
       sc.class_id AS fromClassId,
       sc.class_name AS fromClassName,
       g.grade_id AS gradeId,
       g.grade_name AS gradeName
     FROM class_enrollment ce
     INNER JOIN school_class sc
       ON sc.class_id = ce.class_id
       AND sc.school_year_id = ?
     INNER JOIN student s
       ON s.student_id = ce.student_id
       AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
       AND ua.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN (
       SELECT ce2.student_id, MAX(ce2.enrollment_id) AS enrollment_id
       FROM class_enrollment ce2
       INNER JOIN school_class sc2 ON sc2.class_id = ce2.class_id
       WHERE sc2.school_year_id = ?
         AND ce2.status = 'ACTIVE'
       GROUP BY ce2.student_id
     ) latest ON latest.enrollment_id = ce.enrollment_id
     WHERE ce.status = 'ACTIVE'
     ORDER BY sc.class_name, ua.full_name`,
    [schoolYearId, schoolYearId],
  );

  return rows.map((row) => ({
    ...row,
    studentId: Number(row.studentId),
    fromClassId: Number(row.fromClassId),
    gradeId: Number(row.gradeId),
  }));
}

async function findSemesters(schoolYearId) {
  const [rows] = await pool.query(
    `SELECT semester_id AS semesterId, semester_name AS semesterName,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
            status
     FROM semester
     WHERE school_year_id = ?
     ORDER BY start_date ASC, semester_id ASC`,
    [schoolYearId],
  );
  return rows;
}

async function findExpectedCurriculum(schoolYearId, gradeId) {
  const [rows] = await pool.query(
    `SELECT DISTINCT
       syc.semester_id AS semesterId,
       syc.subject_id AS subjectId,
       sub.subject_name AS subjectName
     FROM school_year_curriculum syc
     INNER JOIN subject sub ON sub.subject_id = syc.subject_id
     WHERE syc.school_year_id = ?
       AND syc.status = 'ACTIVE'
       AND (syc.grade_id IS NULL OR syc.grade_id = ?)
     ORDER BY syc.semester_id, sub.subject_name`,
    [schoolYearId, gradeId],
  );

  return rows.map((row) => ({
    ...row,
    semesterId: Number(row.semesterId),
    subjectId: Number(row.subjectId),
  }));
}

async function findStudentYearScores(studentId, schoolYearId) {
  const [rows] = await pool.query(
    `SELECT ar.result_id AS resultId,
            ar.subject_id AS subjectId,
            sub.subject_name AS subjectName,
            ar.semester_id AS semesterId,
            sem.semester_name AS semesterName,
            ar.score_type AS scoreType,
            ar.score_value AS scoreValue,
            ar.max_score AS maxScore
     FROM academic_result ar
     INNER JOIN semester sem ON sem.semester_id = ar.semester_id
     INNER JOIN subject sub ON sub.subject_id = ar.subject_id
     WHERE ar.student_id = ?
       AND sem.school_year_id = ?
       AND ar.score_value IS NOT NULL
     ORDER BY sem.start_date, ar.subject_id, ar.result_id`,
    [studentId, schoolYearId],
  );

  return rows.map((row) => ({
    ...row,
    subjectId: Number(row.subjectId),
    semesterId: Number(row.semesterId),
    scoreValue: Number(row.scoreValue),
    maxScore: Number(row.maxScore),
  }));
}

async function findAttendancePolicy(schoolYearId) {
  const [[row]] = await pool.query(
    `SELECT periods_per_session AS periodsPerSession,
            max_absent_sessions AS maxAbsentSessions,
            warn_ratio AS warnRatio,
            count_excused AS countExcused
     FROM attendance_policy
     WHERE school_year_id = ?
     LIMIT 1`,
    [schoolYearId],
  );

  return row
    ? {
        periodsPerSession: Number(row.periodsPerSession),
        maxAbsentSessions: Number(row.maxAbsentSessions),
        warnRatio: Number(row.warnRatio),
        countExcused: Boolean(row.countExcused),
      }
    : {
        periodsPerSession: 5,
        maxAbsentSessions: 45,
        warnRatio: 0.8,
        countExcused: true,
      };
}

async function findStudentAbsence(studentId, startDate, endDate) {
  const [[row]] = await pool.query(
    `SELECT
       SUM(CASE WHEN at.type_name = 'ABSENT_EXCUSED' THEN 1 ELSE 0 END) AS absentExcused,
       SUM(CASE WHEN at.type_name = 'ABSENT_UNEXCUSED' THEN 1 ELSE 0 END) AS absentUnexcused
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.timetable_id IS NOT NULL
       AND a.attendance_date BETWEEN ? AND ?`,
    [studentId, startDate, endDate],
  );

  return {
    absentExcused: Number(row?.absentExcused || 0),
    absentUnexcused: Number(row?.absentUnexcused || 0),
  };
}

async function findGrades() {
  const [rows] = await pool.query(
    `SELECT grade_id AS gradeId, grade_name AS gradeName
     FROM grade
     WHERE status = 'ACTIVE'
     ORDER BY grade_id`,
  );
  return rows.map((row) => ({ ...row, gradeId: Number(row.gradeId) }));
}

async function findClassByNameAndGrade(schoolYearId, gradeId, className) {
  const [[row]] = await pool.query(
    `SELECT class_id AS toClassId, class_name AS toClassName,
            grade_id AS toGradeId
     FROM school_class
     WHERE school_year_id = ?
       AND grade_id = ?
       AND UPPER(TRIM(class_name)) = UPPER(TRIM(?))
       AND status = 'ACTIVE'
     ORDER BY class_id DESC
     LIMIT 1`,
    [schoolYearId, gradeId, className],
  );

  return row
    ? {
        ...row,
        toClassId: Number(row.toClassId),
        toGradeId: Number(row.toGradeId),
      }
    : null;
}

async function findExistingTargetEnrollment(studentId, targetSchoolYearId) {
  const [[row]] = await pool.query(
    `SELECT ce.enrollment_id AS enrollmentId,
            sc.class_id AS classId, sc.class_name AS className,
            sc.grade_id AS gradeId
     FROM class_enrollment ce
     INNER JOIN school_class sc ON sc.class_id = ce.class_id
     WHERE ce.student_id = ?
       AND ce.status = 'ACTIVE'
       AND sc.school_year_id = ?
     ORDER BY ce.enrollment_id DESC
     LIMIT 1`,
    [studentId, targetSchoolYearId],
  );

  return row
    ? {
        ...row,
        classId: Number(row.classId),
        gradeId: Number(row.gradeId),
      }
    : null;
}

async function markSchoolYearClosed(schoolYearId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE semester SET status = 'LOCKED' WHERE school_year_id = ?`,
      [schoolYearId],
    );
    await connection.query(
      `UPDATE school_year
       SET status = 'CLOSED', is_active = FALSE
       WHERE school_year_id = ?`,
      [schoolYearId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findStudentRecipients(studentId) {
  const [rows] = await pool.query(
    `SELECT receiverId FROM (
       SELECT s.user_id AS receiverId
       FROM student s
       INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
       WHERE s.student_id = ?
       UNION
       SELECT pp.user_id AS receiverId
       FROM student_parent sp
       INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
       INNER JOIN user_account ua ON ua.user_id = pp.user_id AND ua.status = 'ACTIVE'
       WHERE sp.student_id = ?
     ) recipients`,
    [studentId, studentId],
  );
  return rows.map((row) => Number(row.receiverId));
}

async function findStaffRecipients() {
  const [rows] = await pool.query(
    `SELECT DISTINCT ua.user_id AS receiverId
     FROM user_account ua
     INNER JOIN user_role ur ON ur.user_id = ua.user_id
     INNER JOIN role r ON r.role_id = ur.role_id
     WHERE r.role_name = 'STAFF'
       AND ua.status = 'ACTIVE'
     ORDER BY ua.user_id`,
  );

  return rows.map((row) => Number(row.receiverId));
}

async function hasNotification({ receiverId, studentId, relatedType }) {
  const [[row]] = await pool.query(
    `SELECT notification_id
     FROM notification
     WHERE receiver_id = ?
       AND related_type = ?
       AND related_id = ?
     LIMIT 1`,
    [receiverId, relatedType, studentId],
  );
  return Boolean(row);
}

async function createNotifications(notifications) {
  if (!notifications.length) return;
  await pool.query(
    `INSERT INTO notification
       (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [
      notifications.map((item) => [
        item.receiverId,
        item.title,
        item.content,
        "SYSTEM",
        item.relatedType,
        item.studentId,
        false,
      ]),
    ],
  );
}

async function applyTransitionBatch({ items, sourceYear, targetYear }) {
  const connection = await pool.getConnection();
  const stats = {
    promoted: 0,
    alreadyEnrolled: 0,
    notEligible: 0,
    notEligibleAssigned: 0,
    notEligibleNeedsAssignment: 0,
    graduated: 0,
  };

  try {
    await connection.beginTransaction();

    for (const item of items) {
      if (["PENDING_DATA", "MAPPING_MISSING", "INVALID_TARGET_ASSIGNMENT"].includes(item.result)) {
        const error = new Error(
          `Không thể chuyển năm học vì ${item.fullName} chưa có kết quả cuối cùng.`,
        );
        error.statusCode = 409;
        throw error;
      }

      if (item.result === "NOT_ELIGIBLE") {
        // Học sinh không đủ điều kiện lên khối trên: chỉ đóng enrollment của
        // năm học cũ. Nếu Staff đã chủ động xếp học sinh vào một lớp CÙNG KHỐI
        // của năm mới thì phải giữ lại enrollment đó.
        await connection.query(
          `UPDATE class_enrollment ce
           INNER JOIN school_class sc ON sc.class_id = ce.class_id
           SET ce.status = 'INACTIVE'
           WHERE ce.student_id = ?
             AND ce.status = 'ACTIVE'
             AND sc.school_year_id = ?`,
          [item.studentId, sourceYear.schoolYearId],
        );

        // Nếu trước đó có enrollment năm mới nhưng lại khác khối cũ thì đây là
        // xếp lớp sai với kết quả xét. Gỡ enrollment sai để Staff xếp lại đúng.
        if (item.invalidTargetAssignment && item.existingTargetClassId) {
          await connection.query(
            `UPDATE class_enrollment
             SET status = 'INACTIVE'
             WHERE student_id = ?
               AND class_id = ?
               AND status = 'ACTIVE'`,
            [item.studentId, item.existingTargetClassId],
          );
        }

        stats.notEligible += 1;
        if (item.requiresStaffAssignment) stats.notEligibleNeedsAssignment += 1;
        else stats.notEligibleAssigned += 1;
        continue;
      }

      if (item.result === "GRADUATION_ELIGIBLE") {
        await connection.query(
          `UPDATE class_enrollment ce
           INNER JOIN school_class sc ON sc.class_id = ce.class_id
           SET ce.status = 'INACTIVE'
           WHERE ce.student_id = ?
             AND ce.status = 'ACTIVE'
             AND sc.school_year_id = ?`,
          [item.studentId, sourceYear.schoolYearId],
        );
        stats.graduated += 1;
        continue;
      }

      if (!["ELIGIBLE", "ALREADY_ENROLLED"].includes(item.result)) continue;

      let toClassId = item.toClassId;
      let alreadyEnrolled = item.result === "ALREADY_ENROLLED";

      const [[existingTarget]] = await connection.query(
        `SELECT ce.enrollment_id AS enrollmentId, sc.class_id AS classId
         FROM class_enrollment ce
         INNER JOIN school_class sc ON sc.class_id = ce.class_id
         WHERE ce.student_id = ?
           AND ce.status = 'ACTIVE'
           AND sc.school_year_id = ?
         ORDER BY ce.enrollment_id DESC
         LIMIT 1`,
        [item.studentId, targetYear.schoolYearId],
      );

      if (existingTarget) {
        toClassId = Number(existingTarget.classId);
        alreadyEnrolled = true;
      } else {
        await connection.query(
          `INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
           VALUES (?, ?, ?, 'ACTIVE')
           ON DUPLICATE KEY UPDATE
             enrollment_date = VALUES(enrollment_date),
             status = 'ACTIVE'`,
          [toClassId, item.studentId, targetYear.startDate],
        );
      }

      await connection.query(
        `UPDATE class_enrollment ce
         INNER JOIN school_class sc ON sc.class_id = ce.class_id
         SET ce.status = 'INACTIVE'
         WHERE ce.student_id = ?
           AND ce.status = 'ACTIVE'
           AND sc.school_year_id = ?`,
        [item.studentId, sourceYear.schoolYearId],
      );

      const [[existingPromotion]] = await connection.query(
        `SELECT promotion_id AS promotionId
         FROM class_promotion
         WHERE student_id = ?
           AND from_class_id = ?
           AND to_class_id = ?
           AND school_year_id = ?
         LIMIT 1`,
        [
          item.studentId,
          item.fromClassId,
          toClassId,
          targetYear.schoolYearId,
        ],
      );

      if (!existingPromotion) {
        await connection.query(
          `INSERT INTO class_promotion
             (student_id, from_class_id, to_class_id, school_year_id, promotion_date, reason)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            item.studentId,
            item.fromClassId,
            toClassId,
            targetYear.schoolYearId,
            targetYear.startDate,
            item.reason,
          ],
        );
      }

      if (alreadyEnrolled) stats.alreadyEnrolled += 1;
      else stats.promoted += 1;
    }

    await connection.commit();
    return stats;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  applyTransitionBatch,
  createNotifications,
  findAttendancePolicy,
  findClassByNameAndGrade,
  findExistingTargetEnrollment,
  findExpectedCurriculum,
  findGrades,
  findNextSchoolYear,
  findPreviousSchoolYear,
  findSchoolYearById,
  findSemesters,
  findStudentAbsence,
  findStudentRecipients,
  findStaffRecipients,
  findStudentsForSchoolYear,
  findStudentYearScores,
  hasNotification,
  markSchoolYearClosed,
};
