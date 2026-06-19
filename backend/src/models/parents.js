const { pool } = require("../config/db");

async function findProfileByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        ua.user_id    AS userId,
        ua.username,
        ua.email,
        ua.full_name  AS fullName,
        ua.phone,
        ua.avatar,

        pp.parent_id  AS parentId,
        pp.relationship,
        pp.is_primary AS isPrimary

      FROM user_account ua
      INNER JOIN parent_profile pp
        ON pp.user_id = ua.user_id

      WHERE ua.user_id = ?
        AND ua.status  = 'ACTIVE'

      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

async function findLinkedStudentsByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        -- Student user info
        sua.user_id        AS studentUserId,
        sua.full_name      AS studentFullName,
        sua.email          AS studentEmail,
        sua.phone          AS studentPhone,
        sua.avatar         AS studentAvatar,

        -- Student profile
        s.student_id       AS studentId,
        s.student_code     AS studentCode,
        DATE_FORMAT(
          s.date_of_birth,
          '%Y-%m-%d'
        )                  AS dateOfBirth,
        s.gender,
        s.address,
        s.status           AS studentStatus,

        -- Relationship info
        sp.relationship,
        sp.is_primary      AS isPrimary,

        -- Class info
        sc.class_id        AS classId,
        sc.class_name      AS className,
        sc.room_name       AS roomName,

        -- Grade info
        g.grade_id         AS gradeId,
        g.grade_name       AS gradeName,

        -- School year info
        sy.school_year_id  AS schoolYearId,
        sy.year_name       AS schoolYearName

      FROM user_account ua
      INNER JOIN parent_profile pp
        ON pp.user_id = ua.user_id

      INNER JOIN student_parent sp
        ON sp.parent_id = pp.parent_id

      INNER JOIN student s
        ON s.student_id = sp.student_id
        AND s.status    = 'ACTIVE'

      INNER JOIN user_account sua
        ON sua.user_id = s.user_id
        AND sua.status = 'ACTIVE'

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status    = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status  = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      WHERE ua.user_id  = ?
        AND ua.status   = 'ACTIVE'

      ORDER BY
        sp.is_primary      DESC,
        sy.is_active       DESC,
        sy.start_date      DESC,
        ce.enrollment_date DESC
    `,
    [userId],
  );

  return rows;
}

async function findStudentDetailByStudentId(studentId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.student_id   AS studentId,
        s.student_code AS studentCode,
        ua.full_name   AS fullName,
        ua.email,
        ua.phone,
        ua.avatar,
        DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
        s.gender,
        s.address,
        s.status       AS studentStatus,

        sc.class_id    AS classId,
        sc.class_name  AS className,
        sc.room_name   AS roomName,
        g.grade_name   AS gradeName,
        sy.year_name   AS schoolYearName,

        ht.teacher_id  AS homeroomTeacherId,
        htu.full_name  AS homeroomTeacherName,
        htu.email      AS homeroomTeacherEmail,
        htu.phone      AS homeroomTeacherPhone,
        htu.avatar     AS homeroomTeacherAvatar

      FROM student s
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status    = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status  = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      LEFT JOIN teacher_class htc
        ON htc.class_id      = sc.class_id
        AND htc.role_in_class = 'HOMEROOM_TEACHER'
        AND htc.end_date      IS NULL

      LEFT JOIN teacher ht
        ON ht.teacher_id = htc.teacher_id

      LEFT JOIN user_account htu
        ON htu.user_id = ht.user_id

      WHERE s.student_id = ?
        AND s.status     = 'ACTIVE'
        AND ua.status    = 'ACTIVE'

      ORDER BY
        sy.is_active       DESC,
        sy.start_date      DESC,
        ce.enrollment_date DESC

      LIMIT 1
    `,
    [studentId],
  );

  return rows[0] || null;
}

async function findGradesByStudentId(studentId) {
  const [subjects] = await pool.query(
    `
      SELECT
        subject_id AS subjectId,
        subject_name AS subjectName,
        subject_code AS subjectCode,
        description,
        status
      FROM subject
      WHERE status = 'ACTIVE'
      ORDER BY subject_name ASC
    `,
  );

  const [schoolYears] = await pool.query(
    `
      SELECT
        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS schoolYearStartDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS schoolYearEndDate,
        sy.is_active AS isActive,

        sm.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        DATE_FORMAT(sm.start_date, '%Y-%m-%d') AS semesterStartDate,
        DATE_FORMAT(sm.end_date, '%Y-%m-%d') AS semesterEndDate
      FROM school_year sy
      INNER JOIN semester sm
        ON sm.school_year_id = sy.school_year_id
      WHERE sy.status IN ('ACTIVE', 'PLANNED')
        AND sm.status = 'ACTIVE'
      ORDER BY
        sy.start_date DESC,
        sm.start_date ASC,
        sm.semester_id ASC
    `,
  );

  const [grades] = await pool.query(
    `
      SELECT
        ar.result_id AS resultId,
        ar.score_type AS scoreType,
        ar.score_value AS scoreValue,
        ar.comment,
        DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        sm.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        DATE_FORMAT(sm.start_date, '%Y-%m-%d') AS semesterStartDate,
        DATE_FORMAT(sm.end_date, '%Y-%m-%d') AS semesterEndDate,

        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS schoolYearStartDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS schoolYearEndDate,
        sy.is_active AS schoolYearIsActive
      FROM academic_result ar
      INNER JOIN subject sb
        ON sb.subject_id = ar.subject_id
      INNER JOIN semester sm
        ON sm.semester_id = ar.semester_id
      INNER JOIN school_year sy
        ON sy.school_year_id = sm.school_year_id
      WHERE ar.student_id = ?
      ORDER BY
        sy.start_date DESC,
        sm.start_date ASC,
        sb.subject_name ASC,
        FIELD(
          ar.score_type,
          'TX1',
          'TX2',
          'TX3',
          'ONE_PERIOD',
          'MIDTERM',
          'FINAL'
        ) ASC,
        ar.created_at ASC
    `,
    [studentId],
  );

  const [summaryRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalScores,
        ROUND(AVG(score_value), 2) AS averageScore,
        ROUND(MAX(score_value), 2) AS highestScore,
        ROUND(MIN(score_value), 2) AS lowestScore
      FROM academic_result
      WHERE student_id = ?
    `,
    [studentId],
  );

  return {
    summary: summaryRows[0] || {
      totalScores: 0,
      averageScore: null,
      highestScore: null,
      lowestScore: null,
    },
    subjects,
    schoolYears,
    grades,
  };
}

module.exports = {
  findProfileByUserId,
  findLinkedStudentsByUserId,
  findStudentDetailByStudentId,
  findGradesByStudentId,
};