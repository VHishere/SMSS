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
        DATE_FORMAT(
          s.date_of_birth,
          '%Y-%m-%d'
        ) AS dateOfBirth,
        s.gender,
        s.address,
        s.status AS studentStatus,

        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,

        g.grade_id AS gradeId,
        g.grade_name AS gradeName,

        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName

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

  return rows[0] || null;
}

module.exports = {
  findProfileByUserId,
};