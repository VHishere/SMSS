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

async function getOverview() {
  const [[studentCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM student WHERE status = 'ACTIVE'",
  );
  const [[parentCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM parent_profile",
  );
  const [[classCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM school_class WHERE status = 'ACTIVE'",
  );
  const [[teacherCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM teacher t INNER JOIN user_account ua ON ua.user_id = t.user_id WHERE ua.status = 'ACTIVE'",
  );
  const [[schoolYearCount]] = await pool.query(
    "SELECT COUNT(*) AS total FROM school_year",
  );

  const schoolYear = await getActiveSchoolYear();

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
