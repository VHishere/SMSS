const { pool } = require("../config/db");

async function findProfileByUserId(userId) {
    const [rows] = await pool.query(
        `
      SELECT
        ua.user_id AS userId,
        ua.username,
        ua.email,
        ua.full_name AS fullName,
        ua.phone,
        ua.avatar,

        s.student_id AS studentId,
        s.student_code AS studentCode,
        DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
        s.gender,
        s.address,
        s.status AS studentStatus,

        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,

        g.grade_id AS gradeId,
        g.grade_name AS gradeName,

        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,

        ht.teacher_id AS homeroomTeacherId,
        htu.full_name AS homeroomTeacherName,
        htu.email AS homeroomTeacherEmail,
        htu.phone AS homeroomTeacherPhone

      FROM user_account ua

      INNER JOIN student s
        ON s.user_id = ua.user_id

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      LEFT JOIN teacher_class htc
        ON htc.class_id = sc.class_id
        AND htc.role_in_class = 'HOMEROOM_TEACHER'
        AND htc.end_date IS NULL

      LEFT JOIN teacher ht
        ON ht.teacher_id = htc.teacher_id

      LEFT JOIN user_account htu
        ON htu.user_id = ht.user_id

      WHERE ua.user_id = ?
        AND ua.status = 'ACTIVE'
        AND s.status = 'ACTIVE'

      ORDER BY
        sy.is_active DESC,
        sy.start_date DESC,
        ce.enrollment_date DESC

      LIMIT 1
    `,
        [userId],
    );

    const profile = rows[0] || null;

    if (!profile) {
        return null;
    }

    const [parents] = await pool.query(
        `
      SELECT
        pp.parent_id AS parentId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        COALESCE(sp.relationship, pp.relationship) AS relationship,
        sp.is_primary AS isPrimary
      FROM student_parent sp
      INNER JOIN parent_profile pp
        ON pp.parent_id = sp.parent_id
      INNER JOIN user_account ua
        ON ua.user_id = pp.user_id
      WHERE sp.student_id = ?
      ORDER BY sp.is_primary DESC, pp.parent_id ASC
    `,
        [profile.studentId],
    );

    return {
        ...profile,
        parents,
    };
}

async function findStudentContextByUserId(userId) {
    const [rows] = await pool.query(
        `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        ua.full_name AS fullName,
        ua.avatar,
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,
        g.grade_name AS gradeName,
        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName
      FROM student s
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id
      INNER JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'
      INNER JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status = 'ACTIVE'
      INNER JOIN grade g
        ON g.grade_id = sc.grade_id
      INNER JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id
      WHERE s.user_id = ?
        AND s.status = 'ACTIVE'
        AND ua.status = 'ACTIVE'
      ORDER BY
        sy.is_active DESC,
        sy.start_date DESC,
        ce.enrollment_date DESC
      LIMIT 1
    `,
        [userId],
    );

    return rows[0] || null;
}

async function findHomeworksByUserId(userId) {
    const context = await findStudentContextByUserId(userId);

    if (!context) {
        return null;
    }

    const [homeworks] = await pool.query(
        `
      SELECT
        hw.homework_id AS homeworkId,
        hw.title,
        hw.content,
        DATE_FORMAT(hw.assign_date, '%Y-%m-%d %H:%i:%s') AS assignDate,
        DATE_FORMAT(hw.due_date, '%Y-%m-%d %H:%i:%s') AS dueDate,
        hw.status AS homeworkStatus,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        t.teacher_id AS teacherId,
        tua.full_name AS teacherName,

        hws.submission_id AS submissionId,
        DATE_FORMAT(hws.submit_time, '%Y-%m-%d %H:%i:%s') AS submitTime,
        hws.content AS submissionContent,
        hws.file_url AS fileUrl,
        hws.score,
        hws.feedback,
        hws.status AS submissionStatus,

        CASE
          WHEN hws.submission_id IS NOT NULL THEN 'SUBMITTED'
          WHEN hw.due_date IS NOT NULL AND hw.due_date < NOW() THEN 'OVERDUE'
          ELSE 'PENDING'
        END AS studentHomeworkStatus
      FROM homework hw
      INNER JOIN subject sb
        ON sb.subject_id = hw.subject_id
      INNER JOIN teacher t
        ON t.teacher_id = hw.teacher_id
      INNER JOIN user_account tua
        ON tua.user_id = t.user_id
      LEFT JOIN homework_submission hws
        ON hws.homework_id = hw.homework_id
        AND hws.student_id = ?
      WHERE hw.class_id = ?
      ORDER BY
        CASE
          WHEN hws.submission_id IS NOT NULL THEN 3
          WHEN hw.due_date IS NOT NULL AND hw.due_date < NOW() THEN 2
          ELSE 1
        END ASC,
        hw.due_date ASC,
        hw.assign_date DESC
    `,
        [context.studentId, context.classId],
    );

    return {
        context,
        homeworks,
    };
}

async function findGradesByUserId(userId) {
    const context = await findStudentContextByUserId(userId);

    if (!context) {
        return null;
    }

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
        [context.studentId],
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
        [context.studentId],
    );

    return {
        context,
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
    findHomeworksByUserId,
    findGradesByUserId,
};