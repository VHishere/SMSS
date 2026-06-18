const { pool } = require("../../config/db");

async function getPromotionCandidates(fromSchoolYearId, fromGradeId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        ua.full_name AS fullName,
        sc.class_id AS fromClassId,
        sc.class_name AS fromClassName,
        g.grade_id AS fromGradeId,
        g.grade_name AS fromGradeName
      FROM class_enrollment ce
      INNER JOIN student s ON s.student_id = ce.student_id
      INNER JOIN user_account ua ON ua.user_id = s.user_id
      INNER JOIN school_class sc ON sc.class_id = ce.class_id
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      WHERE ce.status = 'ACTIVE'
        AND sc.school_year_id = ?
        AND sc.grade_id = ?
        AND s.status = 'ACTIVE'
      ORDER BY sc.class_name, s.student_code
    `,
    [fromSchoolYearId, fromGradeId],
  );

  return rows;
}

async function getTargetClasses(toSchoolYearId, toGradeId) {
  const [rows] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.class_name AS className,
        g.grade_name AS gradeName,
        (
          SELECT COUNT(*)
          FROM class_enrollment ce
          WHERE ce.class_id = sc.class_id AND ce.status = 'ACTIVE'
        ) AS studentCount
      FROM school_class sc
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      WHERE sc.school_year_id = ?
        AND sc.grade_id = ?
        AND sc.status = 'ACTIVE'
      ORDER BY sc.class_name
    `,
    [toSchoolYearId, toGradeId],
  );

  return rows;
}

async function promoteStudents({ schoolYearId, fromGradeId, toGradeId, items }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of items) {
      const { studentId, fromClassId, toClassId } = item;

      await connection.query(
        `
          UPDATE class_enrollment
          SET status = 'INACTIVE'
          WHERE student_id = ? AND status = 'ACTIVE'
        `,
        [studentId],
      );

      await connection.query(
        `
          INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
          VALUES (?, ?, CURDATE(), 'ACTIVE')
          ON DUPLICATE KEY UPDATE status = 'ACTIVE', enrollment_date = CURDATE()
        `,
        [toClassId, studentId],
      );

      await connection.query(
        `
          INSERT INTO class_promotion (
            student_id, from_class_id, to_class_id, school_year_id, promotion_date, reason
          ) VALUES (?, ?, ?, ?, CURDATE(), ?)
        `,
        [
          studentId,
          fromClassId || null,
          toClassId,
          schoolYearId,
          `Lên ${toGradeId ? "khối mới" : "lớp mới"} trong năm học`,
        ],
      );
    }

    await connection.commit();

    return {
      promotedCount: items.length,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  getPromotionCandidates,
  getTargetClasses,
  promoteStudents,
};
