const { pool } = require("../../config/db");

async function getActiveSchoolYear() {
  const [rows] = await pool.query(
    `
      SELECT school_year_id AS schoolYearId, year_name AS yearName
      FROM school_year
      WHERE is_active = 1
      ORDER BY start_date DESC
      LIMIT 1
    `,
  );

  return rows[0] || null;
}

async function getSchoolYearById(schoolYearId) {
  if (!schoolYearId) return null;

  const [rows] = await pool.query(
    `
      SELECT school_year_id AS schoolYearId, year_name AS yearName
      FROM school_year
      WHERE school_year_id = ?
      LIMIT 1
    `,
    [schoolYearId],
  );

  return rows[0] || null;
}

async function getOverview(filters = {}) {
  const schoolYear = filters.schoolYearId
    ? await getSchoolYearById(filters.schoolYearId)
    : await getActiveSchoolYear();
  const schoolYearId = schoolYear?.schoolYearId || null;

  const [[studentCount]] = await pool.query(
    schoolYearId
      ? `
        SELECT COUNT(DISTINCT ce.student_id) AS total
        FROM class_enrollment ce
        INNER JOIN school_class sc ON sc.class_id = ce.class_id
        INNER JOIN student s ON s.student_id = ce.student_id
        WHERE ce.status = 'ACTIVE'
          AND s.status = 'ACTIVE'
          AND sc.school_year_id = ?
      `
      : "SELECT COUNT(*) AS total FROM student WHERE status = 'ACTIVE'",
    schoolYearId ? [schoolYearId] : [],
  );
  const [[parentCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM parent_profile",
  );
  const [[classCount]] = await pool.query(
    schoolYearId
      ? "SELECT COUNT(*) AS total FROM school_class WHERE status = 'ACTIVE' AND school_year_id = ?"
      : "SELECT COUNT(*) AS total FROM school_class WHERE status = 'ACTIVE'",
    schoolYearId ? [schoolYearId] : [],
  );
  const [[teacherCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM teacher t INNER JOIN user_account ua ON ua.user_id = t.user_id WHERE ua.status = 'ACTIVE'",
  );
  const [[schoolYearCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM school_year",
  );

  return {
    totalStudents: Number(studentCount.total),
    totalParents: Number(parentCount.total),
    totalClasses: Number(classCount.total),
    totalTeachers: Number(teacherCount.total),
    totalSchoolYears: Number(schoolYearCount.total),
    schoolYearName: schoolYear?.yearName || "Chưa cập nhật",
    activeSchoolYearId: schoolYear?.schoolYearId || null,
  };
}

module.exports = { getOverview, getActiveSchoolYear };
