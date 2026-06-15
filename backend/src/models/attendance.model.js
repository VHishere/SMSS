const { pool } = require("../config/db");

async function findStatsByStudentId(studentId, filters = {}) {
  const { startDate, endDate, context } = filters;
  const params = [studentId];
  let where = "";

  if (startDate && endDate) {
    where += " AND a.attendance_date BETWEEN ? AND ?";
    params.push(startDate, endDate);
  } else if (startDate) {
    where += " AND a.attendance_date >= ?";
    params.push(startDate);
  } else if (endDate) {
    where += " AND a.attendance_date <= ?";
    params.push(endDate);
  }

  if (context) {
    where += " AND a.attendance_context = ?";
    params.push(context);
  }

  const [rows] = await pool.query(
    `
      SELECT
        at.attendance_type_id AS typeId,
        at.type_name          AS typeName,
        a.attendance_context  AS context,
        COUNT(*)              AS count
      FROM attendance a
      INNER JOIN attendance_type at
        ON at.attendance_type_id = a.attendance_type_id
      WHERE a.student_id = ?
        ${where}
      GROUP BY
        at.attendance_type_id,
        at.type_name,
        a.attendance_context
      ORDER BY
        a.attendance_context,
        at.attendance_type_id
    `,
    params,
  );

  return rows;
}

async function findHistoryByStudentId(studentId, filters = {}) {
  const { page = 1, limit = 20, startDate, endDate, context, typeId } = filters;
  const offset = (page - 1) * limit;

  const baseParams = [studentId];
  let where = "";

  if (startDate && endDate) {
    where += " AND a.attendance_date BETWEEN ? AND ?";
    baseParams.push(startDate, endDate);
  } else if (startDate) {
    where += " AND a.attendance_date >= ?";
    baseParams.push(startDate);
  } else if (endDate) {
    where += " AND a.attendance_date <= ?";
    baseParams.push(endDate);
  }

  if (context) {
    where += " AND a.attendance_context = ?";
    baseParams.push(context);
  }

  if (typeId) {
    where += " AND a.attendance_type_id = ?";
    baseParams.push(parseInt(typeId, 10));
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM attendance a WHERE a.student_id = ? ${where}`,
    baseParams,
  );

  const [rows] = await pool.query(
    `
      SELECT
        a.attendance_id                            AS attendanceId,
        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendanceDate,
        a.check_in_time                            AS checkInTime,
        a.check_out_time                           AS checkOutTime,
        a.attendance_context                       AS context,
        a.note,

        at.attendance_type_id                      AS typeId,
        at.type_name                               AS typeName,

        sc.class_id                                AS classId,
        sc.class_name                              AS className,

        sub.subject_id                             AS subjectId,
        sub.subject_name                           AS subjectName,

        ua.full_name                               AS createdByName
      FROM attendance a
      INNER JOIN attendance_type at
        ON at.attendance_type_id = a.attendance_type_id
      LEFT JOIN school_class sc
        ON sc.class_id = a.class_id
      LEFT JOIN timetable tt
        ON tt.timetable_id = a.timetable_id
      LEFT JOIN subject sub
        ON sub.subject_id = tt.subject_id
      LEFT JOIN user_account ua
        ON ua.user_id = a.created_by
      WHERE a.student_id = ?
        ${where}
      ORDER BY
        a.attendance_date DESC,
        a.attendance_id   DESC
      LIMIT ? OFFSET ?
    `,
    [...baseParams, limit, offset],
  );

  return { total: Number(total), rows };
}

module.exports = {
  findStatsByStudentId,
  findHistoryByStudentId,
};
