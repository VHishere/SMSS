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

module.exports = {
  findProfileByUserId,
  findLinkedStudentsByUserId,
};