const { pool } = require("../config/db");

// ── Existing: parent/student-facing queries ───────────────────────────────────

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

// ── Teacher-facing: roll call ─────────────────────────────────────────────────

async function findAttendanceTypes() {
  const [rows] = await pool.query(
    `SELECT attendance_type_id AS typeId, type_name AS typeName
     FROM attendance_type
     ORDER BY attendance_type_id ASC`,
  );
  return rows;
}

async function findEnrolledStudents(classId) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       ua.avatar
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id
       AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
       AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [classId],
  );
  return rows;
}

async function findAttendanceByClassAndDate(classId, date) {
  const [rows] = await pool.query(
    `SELECT
       a.attendance_id        AS attendanceId,
       a.student_id           AS studentId,
       a.attendance_type_id   AS typeId,
       at.type_name           AS typeName,
       a.note,
       a.created_at           AS createdAt
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.class_id = ?
       AND a.attendance_date = ?
       AND a.attendance_context = 'CLASS'`,
    [classId, date],
  );
  return rows;
}

async function bulkUpsertAttendance(records) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of records) {
      await conn.query(
        `INSERT INTO attendance
           (student_id, class_id, attendance_date, attendance_context,
            attendance_type_id, note, created_by)
         VALUES (?, ?, ?, 'CLASS', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           attendance_type_id = VALUES(attendance_type_id),
           note               = VALUES(note),
           updated_at         = NOW()`,
        [r.studentId, r.classId, r.date, r.typeId, r.note ?? null, r.createdBy],
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findAttendanceRecordById(attendanceId) {
  const [[row]] = await pool.query(
    `SELECT
       a.attendance_id      AS attendanceId,
       a.student_id         AS studentId,
       a.class_id           AS classId,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendanceDate,
       a.attendance_type_id AS typeId,
       at.type_name         AS typeName,
       a.note,
       a.created_at         AS createdAt
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.attendance_id = ?`,
    [attendanceId],
  );
  return row || null;
}

async function updateAttendanceRecord(attendanceId, typeId, note) {
  const [result] = await pool.query(
    `UPDATE attendance
     SET attendance_type_id = ?,
         note               = ?,
         updated_at         = NOW()
     WHERE attendance_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
    [typeId, note ?? null, attendanceId],
  );
  return result.affectedRows;
}

// ── Teacher-facing: history & analytics ──────────────────────────────────────

async function findClassAttendanceHistory(classId, filters = {}) {
  const { page = 1, limit = 20, startDate, endDate, studentId, typeId } = filters;
  const offset = (page - 1) * limit;

  const params = [classId];
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

  if (studentId) {
    where += " AND a.student_id = ?";
    params.push(parseInt(studentId, 10));
  }

  if (typeId) {
    where += " AND a.attendance_type_id = ?";
    params.push(parseInt(typeId, 10));
  }

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM attendance a
     WHERE a.class_id = ?
       AND a.attendance_context = 'CLASS'
       ${where}`,
    params,
  );

  const [rows] = await pool.query(
    `SELECT
       a.attendance_id                            AS attendanceId,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendanceDate,
       a.student_id                               AS studentId,
       s.student_code                             AS studentCode,
       ua.full_name                               AS fullName,
       ua.avatar,
       at.attendance_type_id                      AS typeId,
       at.type_name                               AS typeName,
       a.note,
       a.created_at                               AS createdAt,
       CASE WHEN a.created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)
            THEN 1 ELSE 0 END                     AS isEditable
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     INNER JOIN student s
       ON s.student_id = a.student_id
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
     WHERE a.class_id = ?
       AND a.attendance_context = 'CLASS'
       ${where}
     ORDER BY a.attendance_date DESC, ua.full_name ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { total: Number(total), rows };
}

async function findClassAttendanceAnalytics(classId, startDate, endDate) {
  const [typeSummary] = await pool.query(
    `SELECT at.type_name AS typeName, COUNT(*) AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.class_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     GROUP BY at.attendance_type_id, at.type_name
     ORDER BY at.attendance_type_id ASC`,
    [classId, startDate, endDate],
  );

  const [timeline] = await pool.query(
    `SELECT
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
       at.type_name                               AS typeName,
       COUNT(*)                                   AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.class_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     GROUP BY a.attendance_date, at.attendance_type_id, at.type_name
     ORDER BY a.attendance_date ASC`,
    [classId, startDate, endDate],
  );

  const [students] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       COUNT(a.attendance_id) AS total,
       SUM(CASE WHEN at.type_name = 'PRESENT'          THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN at.type_name = 'LATE'             THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN at.type_name = 'ABSENT_EXCUSED'   THEN 1 ELSE 0 END) AS absentExcused,
       SUM(CASE WHEN at.type_name = 'ABSENT_UNEXCUSED' THEN 1 ELSE 0 END) AS absentUnexcused,
       SUM(CASE WHEN at.type_name = 'EARLY_LEAVE'      THEN 1 ELSE 0 END) AS earlyLeave
     FROM class_enrollment ce
     INNER JOIN student s
       ON s.student_id = ce.student_id
       AND s.status = 'ACTIVE'
     INNER JOIN user_account ua
       ON ua.user_id = s.user_id
       AND ua.status = 'ACTIVE'
     LEFT JOIN attendance a
       ON a.student_id = s.student_id
       AND a.class_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     LEFT JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'
     GROUP BY s.student_id, s.student_code, ua.full_name
     ORDER BY ua.full_name ASC`,
    [classId, startDate, endDate, classId],
  );

  return { typeSummary, timeline, students };
}

// ── Parent-facing: per-student analytics ─────────────────────────────────────

async function findStudentAttendanceAnalytics(studentId, startDate, endDate, context) {
  const contextClause = context ? " AND a.attendance_context = ?" : "";
  const baseParams = [studentId, startDate, endDate];
  if (context) baseParams.push(context);

  const [typeSummary] = await pool.query(
    `SELECT at.type_name AS typeName, COUNT(*) AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ?
       AND a.attendance_date BETWEEN ? AND ?
       ${contextClause}
     GROUP BY at.attendance_type_id, at.type_name
     ORDER BY at.attendance_type_id ASC`,
    baseParams,
  );

  const [timeline] = await pool.query(
    `SELECT
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
       at.type_name                               AS typeName,
       COUNT(*)                                   AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ?
       AND a.attendance_date BETWEEN ? AND ?
       ${contextClause}
     GROUP BY a.attendance_date, at.attendance_type_id, at.type_name
     ORDER BY a.attendance_date ASC`,
    baseParams,
  );

  return { typeSummary, timeline };
}

// ── Notifications ─────────────────────────────────────────────────────────────

async function findStudentParentUserIds(studentIds) {
  if (!studentIds.length) return [];
  const placeholders = studentIds.map(() => "?").join(",");
  const [rows] = await pool.query(
    `SELECT sp.student_id AS studentId, ua.user_id AS parentUserId
     FROM student_parent sp
     INNER JOIN parent_profile pp
       ON pp.parent_id = sp.parent_id
     INNER JOIN user_account ua
       ON ua.user_id = pp.user_id
       AND ua.status = 'ACTIVE'
     WHERE sp.student_id IN (${placeholders})`,
    studentIds,
  );
  return rows;
}

async function createAbsenceNotifications(notifications) {
  if (!notifications.length) return;
  const values = notifications.map((n) => [
    n.receiverId,
    n.title,
    n.content,
    "ATTENDANCE",
    "STUDENT",
    n.relatedId ?? null,
    false,
  ]);
  await pool.query(
    `INSERT INTO notification
       (receiver_id, title, content, type, related_type, related_id, is_read)
     VALUES ?`,
    [values],
  );
}

module.exports = {
  findStatsByStudentId,
  findHistoryByStudentId,
  findStudentAttendanceAnalytics,
  findAttendanceTypes,
  findEnrolledStudents,
  findAttendanceByClassAndDate,
  bulkUpsertAttendance,
  findAttendanceRecordById,
  updateAttendanceRecord,
  findClassAttendanceHistory,
  findClassAttendanceAnalytics,
  findStudentParentUserIds,
  createAbsenceNotifications,
};
