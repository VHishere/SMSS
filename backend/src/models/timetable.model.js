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

async function findCurrentStudentContextByStudentId(studentId) {
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

      WHERE s.student_id = ?
        AND s.status = 'ACTIVE'
        AND ua.status = 'ACTIVE'

      ORDER BY
        sy.is_active DESC,
        sy.start_date DESC,
        ce.enrollment_date DESC

      LIMIT 1
    `,
    [studentId],
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

        TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(tt.end_time, '%H:%i') AS endTime,

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

async function findLessonsByTeacherId(teacherId) {
  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,

        TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(tt.end_time, '%H:%i') AS endTime,

        COALESCE(
          tt.room_name,
          sc.room_name
        ) AS roomName,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        sc.class_id AS classId,
        sc.class_name AS className

      FROM timetable tt

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      WHERE tt.teacher_id = ?
        AND tt.status = 'ACTIVE'

      ORDER BY
        tt.day_of_week ASC,
        tt.period_no ASC
    `,
    [teacherId],
  );

  return rows;
}

async function findLessonById(timetableId) {
  const [[row]] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        tt.class_id AS classId,
        tt.teacher_id AS teacherId,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,

        TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(tt.end_time, '%H:%i') AS endTime,

        COALESCE(
          tt.room_name,
          sc.room_name
        ) AS roomName,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        sc.class_name AS className

      FROM timetable tt

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      WHERE tt.timetable_id = ?

      LIMIT 1
    `,
    [timetableId],
  );

  return row || null;
}

async function findStudentClassAttendanceByDateRange(
  studentId,
  startDate,
  endDate,
) {
  const [rows] = await pool.query(
    `
      SELECT
        a.attendance_id AS attendanceId,
        a.student_id AS studentId,
        a.class_id AS classId,
        a.timetable_id AS timetableId,

        DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendanceDate,
        TIME_FORMAT(a.check_in_time, '%H:%i') AS checkInTime,
        TIME_FORMAT(a.check_out_time, '%H:%i') AS checkOutTime,

        a.attendance_context AS attendanceContext,
        a.note,

        at.attendance_type_id AS attendanceTypeId,
        at.type_name AS attendanceTypeName,
        at.description AS attendanceTypeDescription

      FROM attendance a

      INNER JOIN attendance_type at
        ON at.attendance_type_id = a.attendance_type_id

      WHERE a.student_id = ?
        AND a.attendance_context = 'CLASS'
        AND a.attendance_date BETWEEN ? AND ?

      ORDER BY
        a.attendance_date ASC,
        a.timetable_id ASC,
        a.attendance_id ASC
    `,
    [
      studentId,
      startDate,
      endDate,
    ],
  );

  return rows;
}

async function findTeacherCandidates(excludeTeacherId) {
  const [rows] = await pool.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        ua.full_name AS name,
        t.subject_specialize AS subjectSpecialize

      FROM teacher t

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'

      WHERE t.teacher_id <> ?

      ORDER BY
        ua.full_name ASC
    `,
    [excludeTeacherId],
  );

  return rows;
}

async function findAdminUserIds() {
  const [rows] = await pool.query(
    `
      SELECT
        ur.user_id AS userId

      FROM user_role ur

      INNER JOIN role r
        ON r.role_id = ur.role_id

      WHERE r.role_name = 'ADMIN'
    `,
  );

  return rows.map((row) => row.userId);
}

async function createSubstitution(payload) {
  const [result] = await pool.query(
    `
      INSERT INTO timetable_substitution
        (
          timetable_id,
          requester_id,
          request_type,
          target_date,
          substitute_teacher_id,
          swap_timetable_id,
          reason,
          status
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `,
    [
      payload.timetableId,
      payload.requesterId,
      payload.requestType,
      payload.targetDate,
      payload.substituteTeacherId ?? null,
      payload.swapTimetableId ?? null,
      payload.reason ?? null,
    ],
  );

  return result.insertId;
}

async function findSubstitutionsByRequester(requesterId, filters = {}) {
  const {
    status,
    page = 1,
    limit = 20,
  } = filters;

  const offset = (page - 1) * limit;
  const params = [requesterId];

  let where = "ts.requester_id = ?";

  if (status) {
    where += " AND ts.status = ?";
    params.push(status);
  }

  const [[{ total }]] = await pool.query(
    `
      SELECT
        COUNT(*) AS total

      FROM timetable_substitution ts

      WHERE ${where}
    `,
    params,
  );

  const [rows] = await pool.query(
    `
      SELECT
        ts.substitution_id AS substitutionId,
        ts.request_type AS requestType,
        DATE_FORMAT(ts.target_date, '%Y-%m-%d') AS targetDate,
        ts.reason,
        ts.status,
        ts.review_note AS reviewNote,
        DATE_FORMAT(ts.created_at, '%Y-%m-%d %H:%i') AS createdAt,
        DATE_FORMAT(ts.reviewed_at, '%Y-%m-%d %H:%i') AS reviewedAt,

        sb.subject_name AS subjectName,
        sc.class_name AS className,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,

        subUa.full_name AS substituteName,
        revUa.full_name AS reviewerName

      FROM timetable_substitution ts

      INNER JOIN timetable tt
        ON tt.timetable_id = ts.timetable_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      LEFT JOIN teacher subT
        ON subT.teacher_id = ts.substitute_teacher_id

      LEFT JOIN user_account subUa
        ON subUa.user_id = subT.user_id

      LEFT JOIN user_account revUa
        ON revUa.user_id = ts.reviewed_by

      WHERE ${where}

      ORDER BY
        ts.created_at DESC

      LIMIT ? OFFSET ?
    `,
    [
      ...params,
      Number(limit),
      Number(offset),
    ],
  );

  return {
    total: Number(total),
    rows,
  };
}

async function findSubstitutionById(substitutionId) {
  const [[row]] = await pool.query(
    `
      SELECT
        substitution_id AS substitutionId,
        requester_id AS requesterId,
        status

      FROM timetable_substitution

      WHERE substitution_id = ?

      LIMIT 1
    `,
    [substitutionId],
  );

  return row || null;
}

async function cancelSubstitution(substitutionId, requesterId) {
  const [result] = await pool.query(
    `
      UPDATE timetable_substitution

      SET status = 'CANCELLED'

      WHERE substitution_id = ?
        AND requester_id = ?
        AND status = 'PENDING'
    `,
    [
      substitutionId,
      requesterId,
    ],
  );

  return result.affectedRows;
}

module.exports = {
  findCurrentStudentContext,
  findCurrentStudentContextByStudentId,
  findLessonsByClassId,
  findStudentClassAttendanceByDateRange,
  findLessonsByTeacherId,
  findLessonById,
  findTeacherCandidates,
  findAdminUserIds,
  createSubstitution,
  findSubstitutionsByRequester,
  findSubstitutionById,
  cancelSubstitution,
};