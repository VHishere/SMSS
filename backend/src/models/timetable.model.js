const { pool } = require("../config/db");

async function findCurrentStudentContext(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,

        ua.full_name AS fullName,
        ua.avatar,

        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS classRoom,

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

async function findLessonsByClassId(classId) {
  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,

        COALESCE(
          tt.room_name,
          sc.room_name
        ) AS roomName,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        t.teacher_id AS teacherId,
        ua.full_name AS teacherName

      FROM timetable tt

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN teacher t
        ON t.teacher_id = tt.teacher_id

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id

      WHERE tt.class_id = ?
        AND tt.status = 'ACTIVE'

      ORDER BY
        tt.day_of_week ASC,
        tt.period_no ASC
    `,
    [classId],
  );

  return rows;
}

module.exports = {
  findCurrentStudentContext,
  findLessonsByClassId,
};