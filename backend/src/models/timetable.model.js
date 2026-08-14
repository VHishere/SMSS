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

async function findLessonsByClassId(classId, filters = {}) {
  const conditions = [
    "tt.class_id = ?",
    "tt.status = 'ACTIVE'",
    "sc.status = 'ACTIVE'",
    "sy.is_active = 1",
  ];
  const params = [classId];

  if (filters.startDate && filters.endDate) {
    conditions.push("tt.lesson_date BETWEEN ? AND ?");
    params.push(filters.startDate, filters.endDate);
  }

  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        DATE_FORMAT(tt.lesson_date, '%Y-%m-%d') AS lessonDate,
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

        COALESCE(subT.teacher_id, t.teacher_id) AS teacherId,
        COALESCE(subUa.full_name, ua.full_name) AS teacherName,
        ua.full_name AS baseTeacherName,
        CASE WHEN approvedSub.substitution_id IS NOT NULL THEN 1 ELSE 0 END AS isSubstitute

      FROM timetable tt

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN teacher t
        ON t.teacher_id = tt.teacher_id

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id

      LEFT JOIN timetable_substitution approvedSub
        ON approvedSub.timetable_id = tt.timetable_id
        AND approvedSub.target_date = tt.lesson_date
        AND approvedSub.status = 'APPROVED'
        AND approvedSub.request_type = 'SUBSTITUTE'

      LEFT JOIN teacher subT
        ON subT.teacher_id = approvedSub.substitute_teacher_id

      LEFT JOIN user_account subUa
        ON subUa.user_id = subT.user_id

      WHERE ${conditions.join(" AND ")}

      ORDER BY
        tt.lesson_date ASC,
        tt.day_of_week ASC,
        tt.period_no ASC
    `,
    params,
  );

  return rows;
}

async function findLessonsByTeacherId(teacherId, filters = {}) {
  const conditions = [
    "tt.status = 'ACTIVE'",
    "sc.status = 'ACTIVE'",
    "sy.is_active = 1",
  ];
  const params = [];

  if (filters.startDate && filters.endDate) {
    conditions.push("tt.lesson_date BETWEEN ? AND ?");
    params.push(filters.startDate, filters.endDate);
  }

  conditions.push(`
    (
      (tt.teacher_id = ? AND outgoingSub.substitution_id IS NULL)
      OR incomingSub.substitution_id IS NOT NULL
    )
  `);
  params.push(teacherId);

  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        DATE_FORMAT(tt.lesson_date, '%Y-%m-%d') AS lessonDate,
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
        sc.class_name AS className,

        t.teacher_id AS teacherId,
        COALESCE(subUa.full_name, ua.full_name) AS teacherName,
        ua.full_name AS baseTeacherName,
        CASE WHEN incomingSub.substitution_id IS NOT NULL THEN 1 ELSE 0 END AS isSubstitute

      FROM timetable tt

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN teacher t
        ON t.teacher_id = tt.teacher_id

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id

      LEFT JOIN timetable_substitution incomingSub
        ON incomingSub.timetable_id = tt.timetable_id
        AND incomingSub.target_date = tt.lesson_date
        AND incomingSub.status = 'APPROVED'
        AND incomingSub.request_type = 'SUBSTITUTE'
        AND incomingSub.substitute_teacher_id = ?

      LEFT JOIN teacher subT
        ON subT.teacher_id = incomingSub.substitute_teacher_id

      LEFT JOIN user_account subUa
        ON subUa.user_id = subT.user_id

      LEFT JOIN timetable_substitution outgoingSub
        ON outgoingSub.timetable_id = tt.timetable_id
        AND outgoingSub.target_date = tt.lesson_date
        AND outgoingSub.status = 'APPROVED'
        AND outgoingSub.request_type = 'SUBSTITUTE'

      WHERE ${conditions.join(" AND ")}

      ORDER BY
        tt.lesson_date ASC,
        tt.day_of_week ASC,
        tt.period_no ASC
    `,
    [
      teacherId,
      ...params,
    ],
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
        t.subject_specialize AS subjectSpecialize,
        GROUP_CONCAT(DISTINCT COALESCE(tc.subject_id, specializeSubject.subject_id)) AS subjectIds

      FROM teacher t

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'

      LEFT JOIN subject specializeSubject
        ON (
          LOWER(TRIM(specializeSubject.subject_name)) = LOWER(TRIM(t.subject_specialize))
          OR LOWER(TRIM(specializeSubject.subject_code)) = LOWER(TRIM(t.subject_specialize))
          OR LOWER(TRIM(specializeSubject.subject_name)) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(TRIM(specializeSubject.subject_name)), '%')
        )
        AND specializeSubject.status = 'ACTIVE'

      LEFT JOIN teacher_class tc
        ON tc.teacher_id = t.teacher_id
        AND tc.subject_id IS NOT NULL
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())

      WHERE t.teacher_id <> ?

      GROUP BY
        t.teacher_id,
        ua.full_name,
        t.subject_specialize

      ORDER BY
        ua.full_name ASC
    `,
    [excludeTeacherId],
  );

  return rows.map((row) => ({
    ...row,
    subjectIds: row.subjectIds
      ? row.subjectIds.split(",").map((subjectId) => Number(subjectId))
      : [],
  }));
}

async function teacherCanTeachSubject(teacherId, subjectId) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM teacher t
      INNER JOIN subject sb
        ON sb.subject_id = ?
      WHERE t.teacher_id = ?
        AND (
          EXISTS (
            SELECT 1
            FROM teacher_class tc
            WHERE tc.teacher_id = t.teacher_id
              AND tc.subject_id = sb.subject_id
              AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
          )
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sb.subject_name))
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sb.subject_code))
          OR LOWER(TRIM(sb.subject_name)) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(TRIM(sb.subject_name)), '%')
        )
      LIMIT 1
    `,
    [subjectId, teacherId],
  );

  return Boolean(rows[0]);
}

async function hasOpenSubstitutionForLesson(timetableId, targetDate) {
  const [[row]] = await pool.query(
    `
      SELECT substitution_id AS substitutionId
      FROM timetable_substitution
      WHERE timetable_id = ?
        AND target_date = ?
        AND status IN ('PENDING', 'APPROVED')
      LIMIT 1
    `,
    [timetableId, targetDate],
  );

  return Boolean(row);
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

async function findStaffUserIds() {
  const [rows] = await pool.query(
    `
      SELECT DISTINCT ur.user_id AS userId
      FROM user_role ur
      INNER JOIN role r
        ON r.role_id = ur.role_id
      INNER JOIN user_account ua
        ON ua.user_id = ur.user_id
        AND ua.status = 'ACTIVE'
      WHERE r.role_name = 'STAFF'
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

async function findSubstitutionsForStaff(filters = {}) {
  const {
    status,
    page = 1,
    limit = 20,
  } = filters;

  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ["1 = 1"];

  if (status) {
    conditions.push("ts.status = ?");
    params.push(status);
  }

  const where = conditions.join(" AND ");

  const [[{ total }]] = await pool.query(
    `
      SELECT COUNT(*) AS total
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

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sc.class_id AS classId,
        sc.class_name AS className,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,
        TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(tt.end_time, '%H:%i') AS endTime,
        COALESCE(tt.room_name, sc.room_name) AS roomName,

        reqUa.full_name AS requesterName,
        subT.teacher_id AS substituteTeacherId,
        subUa.full_name AS substituteName,
        revUa.full_name AS reviewerName

      FROM timetable_substitution ts

      INNER JOIN timetable tt
        ON tt.timetable_id = ts.timetable_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN user_account reqUa
        ON reqUa.user_id = ts.requester_id

      LEFT JOIN teacher subT
        ON subT.teacher_id = ts.substitute_teacher_id

      LEFT JOIN user_account subUa
        ON subUa.user_id = subT.user_id

      LEFT JOIN user_account revUa
        ON revUa.user_id = ts.reviewed_by

      WHERE ${where}

      ORDER BY
        FIELD(ts.status, 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
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

async function findSubstitutionForStaffById(substitutionId) {
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

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,
        sc.class_id AS classId,
        sc.class_name AS className,
        sy.year_name AS schoolYearName,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,
        TIME_FORMAT(tt.start_time, '%H:%i') AS startTime,
        TIME_FORMAT(tt.end_time, '%H:%i') AS endTime,
        COALESCE(tt.room_name, sc.room_name) AS roomName,

        reqUa.user_id AS requesterUserId,
        reqUa.full_name AS requesterName,
        reqUa.email AS requesterEmail,
        reqT.teacher_id AS requesterTeacherId,
        reqT.teacher_code AS requesterTeacherCode,
        reqT.subject_specialize AS requesterSubjectSpecialize,

        subT.teacher_id AS substituteTeacherId,
        subT.teacher_code AS substituteTeacherCode,
        subT.subject_specialize AS substituteSubjectSpecialize,
        subUa.full_name AS substituteName,
        subUa.email AS substituteEmail,

        revUa.full_name AS reviewerName

      FROM timetable_substitution ts

      INNER JOIN timetable tt
        ON tt.timetable_id = ts.timetable_id

      INNER JOIN subject sb
        ON sb.subject_id = tt.subject_id

      INNER JOIN school_class sc
        ON sc.class_id = tt.class_id

      INNER JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      INNER JOIN user_account reqUa
        ON reqUa.user_id = ts.requester_id

      LEFT JOIN teacher reqT
        ON reqT.user_id = reqUa.user_id

      LEFT JOIN teacher subT
        ON subT.teacher_id = ts.substitute_teacher_id

      LEFT JOIN user_account subUa
        ON subUa.user_id = subT.user_id

      LEFT JOIN user_account revUa
        ON revUa.user_id = ts.reviewed_by

      WHERE ts.substitution_id = ?

      LIMIT 1
    `,
    [substitutionId],
  );

  const detail = rows[0] || null;
  if (!detail) return null;

  const [candidates] = await pool.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        t.teacher_code AS teacherCode,
        t.subject_specialize AS subjectSpecialize,
        ua.full_name AS fullName,
        ua.email
      FROM teacher t
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      WHERE t.teacher_id <> ?
        AND (
          EXISTS (
            SELECT 1
            FROM teacher_class tc
            WHERE tc.teacher_id = t.teacher_id
              AND tc.subject_id = ?
              AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
          )
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(?))
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(?))
          OR LOWER(TRIM(?)) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(TRIM(?)), '%')
        )
      ORDER BY ua.full_name
    `,
    [
      detail.requesterTeacherId || 0,
      detail.subjectId,
      detail.subjectName,
      detail.subjectCode,
      detail.subjectName,
      detail.subjectName,
    ],
  );

  return {
    ...detail,
    substituteCandidates: candidates,
  };
}

async function reviewSubstitution(substitutionId, reviewerId, decision, reviewNote = null, substituteTeacherId = null) {
  const nextStatus = decision === "APPROVE" ? "APPROVED" : "REJECTED";
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[substitution]] = await connection.query(
      `
        SELECT
          ts.substitution_id AS substitutionId,
          ts.request_type AS requestType,
          DATE_FORMAT(ts.target_date, '%Y-%m-%d') AS targetDate,
          ts.substitute_teacher_id AS substituteTeacherId,
          ts.status,
          ts.reason,
          tt.timetable_id AS timetableId,
          tt.teacher_id AS baseTeacherId,
          tt.subject_id AS subjectId,
          tt.period_no AS periodNo,
          sb.subject_name AS subjectName,
          sc.class_name AS className
        FROM timetable_substitution ts
        INNER JOIN timetable tt
          ON tt.timetable_id = ts.timetable_id
        INNER JOIN subject sb
          ON sb.subject_id = tt.subject_id
        INNER JOIN school_class sc
          ON sc.class_id = tt.class_id
        WHERE ts.substitution_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [substitutionId],
    );

    if (!substitution) {
      const error = new Error("Không tìm thấy yêu cầu đổi tiết");
      error.statusCode = 404;
      throw error;
    }

    if (substitution.status !== "PENDING") {
      const error = new Error("Chỉ xử lý được yêu cầu đang chờ duyệt");
      error.statusCode = 409;
      throw error;
    }

    const effectiveSubstituteTeacherId = substituteTeacherId
      ? Number(substituteTeacherId)
      : substitution.substituteTeacherId;

    const shouldArrangeSubstitute = nextStatus === "APPROVED"
      && (Boolean(effectiveSubstituteTeacherId) || ["SUBSTITUTE", "CANCEL"].includes(substitution.requestType));

    if (shouldArrangeSubstitute) {
      if (!effectiveSubstituteTeacherId) {
        const error = new Error("Yêu cầu chưa có giáo viên dạy thay");
        error.statusCode = 400;
        throw error;
      }

      if (effectiveSubstituteTeacherId === substitution.baseTeacherId) {
        const error = new Error("Giáo viên dạy thay phải khác giáo viên hiện tại");
        error.statusCode = 400;
        throw error;
      }

      const canTeach = await teacherCanTeachSubject(
        effectiveSubstituteTeacherId,
        substitution.subjectId,
      );
      if (!canTeach) {
        const error = new Error("Giáo viên dạy thay không đúng chuyên môn của tiết học");
        error.statusCode = 400;
        throw error;
      }

      const [[approvedDuplicate]] = await connection.query(
        `
          SELECT substitution_id AS substitutionId
          FROM timetable_substitution
          WHERE timetable_id = ?
            AND target_date = ?
            AND status = 'APPROVED'
            AND substitution_id <> ?
          LIMIT 1
        `,
        [
          substitution.timetableId,
          substitution.targetDate,
          substitution.substitutionId,
        ],
      );
      if (approvedDuplicate) {
        const error = new Error("Tiết học này đã có yêu cầu đổi tiết được duyệt");
        error.statusCode = 409;
        throw error;
      }

      const [[teacherConflict]] = await connection.query(
        `
          SELECT tt.timetable_id AS timetableId
          FROM timetable tt
          LEFT JOIN timetable_substitution so
            ON so.timetable_id = tt.timetable_id
            AND so.target_date = ?
            AND so.status = 'APPROVED'
            AND so.request_type = 'SUBSTITUTE'
          WHERE tt.status = 'ACTIVE'
            AND tt.period_no = ?
            AND (
              tt.lesson_date = ?
              OR (tt.lesson_date IS NULL AND tt.day_of_week = DAYOFWEEK(?))
            )
            AND (
              (tt.teacher_id = ? AND so.substitution_id IS NULL)
              OR so.substitute_teacher_id = ?
            )
          LIMIT 1
        `,
        [
          substitution.targetDate,
          substitution.periodNo,
          substitution.targetDate,
          substitution.targetDate,
          effectiveSubstituteTeacherId,
          effectiveSubstituteTeacherId,
        ],
      );
      if (teacherConflict) {
        const error = new Error("Giáo viên dạy thay đã có lịch ở tiết này");
        error.statusCode = 409;
        throw error;
      }
    }

    await connection.query(
      `
        UPDATE timetable_substitution
        SET status = ?,
            request_type = CASE WHEN ? IS NOT NULL THEN 'SUBSTITUTE' ELSE request_type END,
            substitute_teacher_id = COALESCE(?, substitute_teacher_id),
            reviewed_by = ?,
            reviewed_at = NOW(),
            review_note = ?
        WHERE substitution_id = ?
          AND status = 'PENDING'
      `,
      [
        nextStatus,
        substituteTeacherId ? Number(substituteTeacherId) : null,
        substituteTeacherId ? Number(substituteTeacherId) : null,
        reviewerId,
        reviewNote,
        substitutionId,
      ],
    );

    await connection.commit();
    return {
      ...substitution,
      status: nextStatus,
      reviewNote,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  teacherCanTeachSubject,
  hasOpenSubstitutionForLesson,
  findAdminUserIds,
  findStaffUserIds,
  createSubstitution,
  findSubstitutionsByRequester,
  findSubstitutionsForStaff,
  findSubstitutionForStaffById,
  reviewSubstitution,
  findSubstitutionById,
  cancelSubstitution,
};
