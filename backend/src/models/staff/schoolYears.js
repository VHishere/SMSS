const { pool } = require("../../config/db");

async function listSchoolYears() {
  const [rows] = await pool.query(
    `
      SELECT
        sy.school_year_id AS schoolYearId,
        sy.year_name AS yearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS endDate,
        sy.is_active AS isActive,
        sy.status,
        (SELECT COUNT(*) FROM school_class sc WHERE sc.school_year_id = sy.school_year_id) AS classCount,
        (
          SELECT COUNT(DISTINCT ce.student_id)
          FROM class_enrollment ce
          INNER JOIN school_class sc ON sc.class_id = ce.class_id
          WHERE sc.school_year_id = sy.school_year_id AND ce.status = 'ACTIVE'
        ) AS studentCount
      FROM school_year sy
      ORDER BY sy.start_date DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
  }));
}

async function createSchoolYear(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO school_year (year_name, start_date, end_date, is_active, status)
        VALUES (?, ?, ?, FALSE, ?)
      `,
      [
        data.yearName,
        data.startDate || null,
        data.endDate || null,
        data.status || "PLANNED",
      ],
    );

    const schoolYearId = result.insertId;

    if (data.createSemesters !== false) {
      await connection.query(
        `
          INSERT INTO semester (school_year_id, semester_name, start_date, end_date, status)
          VALUES
            (?, 'Học kỳ 1', ?, ?, 'ACTIVE'),
            (?, 'Học kỳ 2', ?, ?, 'ACTIVE')
        `,
        [
          schoolYearId,
          data.startDate || null,
          data.endDate || null,
          schoolYearId,
          data.startDate || null,
          data.endDate || null,
        ],
      );
    }

    await connection.commit();
    return listSchoolYears().then((years) =>
      years.find((y) => y.schoolYearId === schoolYearId),
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function activateSchoolYear(schoolYearId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT school_year_id FROM school_year WHERE school_year_id = ?",
      [schoolYearId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy năm học");
      error.statusCode = 404;
      throw error;
    }

    await connection.query("UPDATE school_year SET is_active = FALSE");
    await connection.query(
      "UPDATE school_year SET is_active = TRUE, status = 'ACTIVE' WHERE school_year_id = ?",
      [schoolYearId],
    );

    await connection.commit();
    return listSchoolYears();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSchoolYear(schoolYearId, data) {
  const [result] = await pool.query(
    `
      UPDATE school_year
      SET year_name = ?, start_date = ?, end_date = ?, status = ?
      WHERE school_year_id = ?
    `,
    [
      data.yearName,
      data.startDate || null,
      data.endDate || null,
      data.status || "ACTIVE",
      schoolYearId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy năm học");
    error.statusCode = 404;
    throw error;
  }

  const years = await listSchoolYears();
  return years.find((y) => y.schoolYearId === Number(schoolYearId));
}

module.exports = {
  listSchoolYears,
  createSchoolYear,
  activateSchoolYear,
  updateSchoolYear,
};
