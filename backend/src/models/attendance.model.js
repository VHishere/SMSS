const { pool } = require("../config/db");

// ── Existing: parent/student-facing queries ───────────────────────────────────

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
           note               = VALUES(note)`,
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
         note               = ?
     WHERE attendance_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR)`,
    [typeId, note ?? null, attendanceId],
  );
  return result.affectedRows;
}

// ── Teacher-facing: PER-PERIOD attendance (điểm danh theo tiết) ───────────────

// day_of_week trong timetable: 2=Thứ 2 … 7=Thứ 7, 8=Chủ nhật.
// MySQL DAYOFWEEK: 1=CN,2=T2…7=T7 → khớp T2–T7; chỉ CN khác (1 ↔ 8).
const DOW_EXPR = "(CASE WHEN DAYOFWEEK(?) = 1 THEN 8 ELSE DAYOFWEEK(?) END)";

// Các tiết một giáo viên phụ trách trong 1 ngày:
//  - tiết mình dạy (không bị nhờ dạy thay đã duyệt), CỘNG
//  - tiết mình được phân dạy thay (SUBSTITUTE đã duyệt cho đúng ngày),
//  - TRỪ tiết bị hủy (CANCEL đã duyệt).
async function findTeacherPeriods(teacherId, date) {
  const [rows] = await pool.query(
    `SELECT
       tt.timetable_id  AS timetableId,
       tt.class_id      AS classId,
       sc.class_name    AS className,
       g.grade_name     AS gradeName,
       sub.subject_id   AS subjectId,
       sub.subject_name AS subjectName,
       tt.period_no     AS periodNo,
       TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
       TIME_FORMAT(tt.end_time, '%H:%i')   AS endTime,
       tt.room_name     AS roomName,
       CASE WHEN si.substitution_id IS NOT NULL THEN 1 ELSE 0 END AS isSubstitute,
       (SELECT COUNT(*) FROM class_enrollment ce
         WHERE ce.class_id = tt.class_id AND ce.status = 'ACTIVE') AS studentCount,
       (SELECT COUNT(*) FROM attendance a
         WHERE a.timetable_id = tt.timetable_id AND a.attendance_date = ?) AS markedCount
     FROM timetable tt
     INNER JOIN school_class sc ON sc.class_id = tt.class_id AND sc.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN subject sub ON sub.subject_id = tt.subject_id
     LEFT JOIN timetable_substitution si
       ON si.timetable_id = tt.timetable_id AND si.target_date = ?
       AND si.status = 'APPROVED' AND si.request_type = 'SUBSTITUTE'
       AND si.substitute_teacher_id = ?
     LEFT JOIN timetable_substitution so
       ON so.timetable_id = tt.timetable_id AND so.target_date = ?
       AND so.status = 'APPROVED' AND so.request_type = 'SUBSTITUTE'
     LEFT JOIN timetable_substitution cx
       ON cx.timetable_id = tt.timetable_id AND cx.target_date = ?
       AND cx.status = 'APPROVED' AND cx.request_type = 'CANCEL'
     WHERE tt.status = 'ACTIVE'
       AND tt.day_of_week = ${DOW_EXPR}
       AND cx.substitution_id IS NULL
       AND (
         (tt.teacher_id = ? AND so.substitution_id IS NULL)
         OR si.substitution_id IS NOT NULL
       )
     ORDER BY tt.period_no ASC, sc.class_name ASC`,
    [date, date, teacherId, date, date, date, date, teacherId],
  );
  return rows.map((r) => ({
    ...r,
    studentCount: Number(r.studentCount),
    markedCount:  Number(r.markedCount),
    isSubstitute: Boolean(r.isSubstitute),
  }));
}

// Thông tin + GV phụ trách hiệu lực của một tiết trong một ngày.
async function resolveEffectivePeriod(timetableId, date) {
  const [[tt]] = await pool.query(
    `SELECT
       tt.timetable_id  AS timetableId,
       tt.class_id      AS classId,
       sc.class_name    AS className,
       g.grade_name     AS gradeName,
       sub.subject_id   AS subjectId,
       sub.subject_name AS subjectName,
       tt.teacher_id    AS baseTeacherId,
       tt.period_no     AS periodNo,
       TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
       TIME_FORMAT(tt.end_time, '%H:%i')   AS endTime,
       tt.room_name     AS roomName
     FROM timetable tt
     INNER JOIN school_class sc ON sc.class_id = tt.class_id
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN subject sub ON sub.subject_id = tt.subject_id
     WHERE tt.timetable_id = ?`,
    [timetableId],
  );
  if (!tt) return null;

  const [[cancel]] = await pool.query(
    `SELECT 1 AS ok FROM timetable_substitution
     WHERE timetable_id = ? AND target_date = ? AND status = 'APPROVED' AND request_type = 'CANCEL'
     LIMIT 1`,
    [timetableId, date],
  );
  const [[sub]] = await pool.query(
    `SELECT substitute_teacher_id AS subTeacherId FROM timetable_substitution
     WHERE timetable_id = ? AND target_date = ? AND status = 'APPROVED' AND request_type = 'SUBSTITUTE'
     ORDER BY reviewed_at DESC LIMIT 1`,
    [timetableId, date],
  );

  return {
    ...tt,
    cancelled: Boolean(cancel),
    effectiveTeacherId: sub?.subTeacherId ?? tt.baseTeacherId,
    isSubstitute: Boolean(sub),
  };
}

async function findPeriodAttendance(timetableId, date) {
  const [rows] = await pool.query(
    `SELECT
       a.attendance_id      AS attendanceId,
       a.student_id         AS studentId,
       a.attendance_type_id AS typeId,
       at.type_name         AS typeName,
       a.note,
       a.created_at         AS createdAt
     FROM attendance a
     INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE a.timetable_id = ? AND a.attendance_date = ? AND a.attendance_context = 'CLASS'`,
    [timetableId, date],
  );
  return rows;
}

async function bulkUpsertPeriodAttendance({ timetableId, classId, date, records, createdBy }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const r of records) {
      await conn.query(
        `INSERT INTO attendance
           (student_id, class_id, timetable_id, attendance_date, attendance_context,
            attendance_type_id, note, created_by)
         VALUES (?, ?, ?, ?, 'CLASS', ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           attendance_type_id = VALUES(attendance_type_id),
           note               = VALUES(note),
           class_id           = VALUES(class_id)`,
        [r.studentId, classId, timetableId, date, r.typeId, r.note ?? null, createdBy],
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

// ── GVCN: tổng hợp điểm danh lớp chủ nhiệm + ngưỡng nghỉ ──────────────────────

async function findActiveSchoolYear() {
  const [[row]] = await pool.query(
    `SELECT school_year_id AS schoolYearId, year_name AS yearName,
            DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
     FROM school_year WHERE is_active = 1 LIMIT 1`,
  );
  return row || null;
}

async function findAbsencePolicy(schoolYearId) {
  const [[row]] = await pool.query(
    `SELECT periods_per_session AS periodsPerSession, max_absent_sessions AS maxAbsentSessions,
            warn_ratio AS warnRatio, count_excused AS countExcused
     FROM attendance_policy WHERE school_year_id = ?`,
    [schoolYearId],
  );
  // Mặc định nếu chưa cấu hình.
  return row
    ? { ...row, warnRatio: Number(row.warnRatio), countExcused: Boolean(row.countExcused) }
    : { periodsPerSession: 5, maxAbsentSessions: 45, warnRatio: 0.8, countExcused: true };
}

// Tổng hợp điểm danh theo TẤT CẢ tiết/môn của lớp trong khoảng năm học.
async function findClassAttendanceOverview(classId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       ua.avatar,
       COUNT(a.attendance_id) AS totalPeriods,
       SUM(CASE WHEN at.type_name = 'PRESENT'          THEN 1 ELSE 0 END) AS present,
       SUM(CASE WHEN at.type_name = 'LATE'             THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN at.type_name = 'ABSENT_EXCUSED'   THEN 1 ELSE 0 END) AS absentExcused,
       SUM(CASE WHEN at.type_name = 'ABSENT_UNEXCUSED' THEN 1 ELSE 0 END) AS absentUnexcused,
       SUM(CASE WHEN at.type_name = 'EARLY_LEAVE'      THEN 1 ELSE 0 END) AS earlyLeave
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     LEFT JOIN attendance a
       ON a.student_id = s.student_id AND a.class_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     LEFT JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     GROUP BY s.student_id, s.student_code, ua.full_name, ua.avatar
     ORDER BY ua.full_name ASC`,
    [classId, startDate, endDate, classId],
  );
  return rows.map((r) => ({
    studentId:       r.studentId,
    studentCode:     r.studentCode,
    fullName:        r.fullName,
    avatar:          r.avatar,
    totalPeriods:    Number(r.totalPeriods),
    present:         Number(r.present),
    late:            Number(r.late),
    absentExcused:   Number(r.absentExcused),
    absentUnexcused: Number(r.absentUnexcused),
    earlyLeave:      Number(r.earlyLeave),
  }));
}

async function upsertAbsenceWarning(w) {
  await pool.query(
    `INSERT INTO attendance_warning
       (student_id, school_year_id, absent_periods, absent_sessions, threshold_sessions, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       absent_periods = VALUES(absent_periods),
       absent_sessions = VALUES(absent_sessions),
       threshold_sessions = VALUES(threshold_sessions),
       note = VALUES(note)`,
    [w.studentId, w.schoolYearId, w.absentPeriods, w.absentSessions, w.thresholdSessions, w.note ?? null, w.createdBy ?? null],
  );
}

async function findAbsenceWarnings(classId, schoolYearId) {
  const [rows] = await pool.query(
    `SELECT aw.student_id AS studentId, aw.absent_periods AS absentPeriods,
            aw.absent_sessions AS absentSessions, aw.threshold_sessions AS thresholdSessions,
            aw.status, aw.note
     FROM attendance_warning aw
     INNER JOIN class_enrollment ce ON ce.student_id = aw.student_id AND ce.class_id = ? AND ce.status = 'ACTIVE'
     WHERE aw.school_year_id = ?`,
    [classId, schoolYearId],
  );
  return rows.map((r) => ({ ...r, absentSessions: Number(r.absentSessions) }));
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
  findHistoryByStudentId,
  findStudentAttendanceAnalytics,
  findAttendanceTypes,
  findEnrolledStudents,
  findAttendanceByClassAndDate,
  bulkUpsertAttendance,
  findAttendanceRecordById,
  updateAttendanceRecord,
  findTeacherPeriods,
  resolveEffectivePeriod,
  findPeriodAttendance,
  bulkUpsertPeriodAttendance,
  findActiveSchoolYear,
  findAbsencePolicy,
  findClassAttendanceOverview,
  upsertAbsenceWarning,
  findAbsenceWarnings,
  findClassAttendanceHistory,
  findClassAttendanceAnalytics,
  findStudentParentUserIds,
  createAbsenceNotifications,
};
