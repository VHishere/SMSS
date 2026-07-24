const { pool } = require("../config/db");
const { CONDUCT_GRADE_LABEL } = require("../config/behaviour.config");

async function findProfileByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        ua.user_id AS userId,
        ua.username,
        ua.email,
        ua.full_name AS fullName,
        ua.phone,
        ua.avatar,

        s.student_id AS studentId,
        s.student_code AS studentCode,
        DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
        s.gender,
        s.address,
        s.status AS studentStatus,

        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,

        g.grade_id AS gradeId,
        g.grade_name AS gradeName,

        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,

        ht.teacher_id AS homeroomTeacherId,
        htu.full_name AS homeroomTeacherName,
        htu.email AS homeroomTeacherEmail,
        htu.phone AS homeroomTeacherPhone

      FROM user_account ua

      INNER JOIN student s
        ON s.user_id = ua.user_id

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      LEFT JOIN teacher_class htc
        ON htc.class_id = sc.class_id
        AND htc.role_in_class = 'HOMEROOM_TEACHER'
        AND htc.end_date IS NULL

      LEFT JOIN teacher ht
        ON ht.teacher_id = htc.teacher_id

      LEFT JOIN user_account htu
        ON htu.user_id = ht.user_id

      WHERE ua.user_id = ?
        AND ua.status = 'ACTIVE'
        AND s.status = 'ACTIVE'

      ORDER BY
        sy.is_active DESC,
        sy.start_date DESC,
        ce.enrollment_date DESC

      LIMIT 1
    `,
    [userId],
  );

  const profile = rows[0] || null;

  if (!profile) {
    return null;
  }

  const [parents] = await pool.query(
    `
      SELECT
        pp.parent_id AS parentId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        COALESCE(sp.relationship, pp.relationship) AS relationship,
        sp.is_primary AS isPrimary
      FROM student_parent sp
      INNER JOIN parent_profile pp
        ON pp.parent_id = sp.parent_id
      INNER JOIN user_account ua
        ON ua.user_id = pp.user_id
      WHERE sp.student_id = ?
      ORDER BY sp.is_primary DESC, pp.parent_id ASC
    `,
    [profile.studentId],
  );

  return {
    ...profile,
    parents,
  };
}

async function updateProfileByUserId(userId, payload) {
  const {
    fullName,
    phone,
    avatar,
    dateOfBirth,
    gender,
    address,
  } = payload;

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    await conn.query(
      `
        UPDATE user_account
        SET
          full_name = ?,
          phone = ?,
          avatar = ?
        WHERE user_id = ?
          AND status = 'ACTIVE'
      `,
      [
        fullName,
        phone || null,
        avatar || null,
        userId,
      ],
    );

    await conn.query(
      `
        UPDATE student
        SET
          date_of_birth = ?,
          gender = ?,
          address = ?
        WHERE user_id = ?
          AND status = 'ACTIVE'
      `,
      [
        dateOfBirth || null,
        gender || "OTHER",
        address || null,
        userId,
      ],
    );

    await conn.commit();

    return findProfileByUserId(userId);
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function findStudentContextByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        ua.full_name AS fullName,
        ua.avatar,
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,
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

async function findHomeworksByUserId(userId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [homeworks] = await pool.query(
    `
      SELECT
        hw.homework_id AS homeworkId,
        hw.title,
        hw.content,
        DATE_FORMAT(hw.assign_date, '%Y-%m-%d %H:%i:%s') AS assignDate,
        DATE_FORMAT(hw.due_date, '%Y-%m-%d %H:%i:%s') AS dueDate,
        hw.status AS homeworkStatus,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        t.teacher_id AS teacherId,
        tua.full_name AS teacherName,

        hws.submission_id AS submissionId,
        DATE_FORMAT(hws.submit_time, '%Y-%m-%d %H:%i:%s') AS submitTime,
        hws.content AS submissionContent,
        hws.file_url AS fileUrl,
        hws.score,
        hws.feedback,
        hws.status AS submissionStatus,

        CASE
          WHEN hws.submission_id IS NOT NULL THEN 'SUBMITTED'
          WHEN hw.due_date IS NOT NULL AND hw.due_date < NOW() THEN 'OVERDUE'
          ELSE 'PENDING'
        END AS studentHomeworkStatus
      FROM homework hw
      INNER JOIN subject sb
        ON sb.subject_id = hw.subject_id
      INNER JOIN teacher t
        ON t.teacher_id = hw.teacher_id
      INNER JOIN user_account tua
        ON tua.user_id = t.user_id
      LEFT JOIN homework_submission hws
        ON hws.homework_id = hw.homework_id
        AND hws.student_id = ?
      WHERE hw.class_id = ?
      ORDER BY
        CASE
          WHEN hws.submission_id IS NOT NULL THEN 3
          WHEN hw.due_date IS NOT NULL AND hw.due_date < NOW() THEN 2
          ELSE 1
        END ASC,
        hw.due_date ASC,
        hw.assign_date DESC
    `,
    [context.studentId, context.classId],
  );

  return {
    context,
    homeworks,
  };
}

async function findGradesByUserId(userId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [subjects] = await pool.query(
    `
      SELECT
        subject_id AS subjectId,
        subject_name AS subjectName,
        subject_code AS subjectCode,
        description,
        status
      FROM subject
      WHERE status = 'ACTIVE'
      ORDER BY subject_name ASC
    `,
  );

  const [schoolYears] = await pool.query(
    `
      SELECT
        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS schoolYearStartDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS schoolYearEndDate,
        sy.is_active AS isActive,

        sm.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        DATE_FORMAT(sm.start_date, '%Y-%m-%d') AS semesterStartDate,
        DATE_FORMAT(sm.end_date, '%Y-%m-%d') AS semesterEndDate
      FROM school_year sy
      INNER JOIN semester sm
        ON sm.school_year_id = sy.school_year_id
      WHERE sy.status IN ('ACTIVE', 'PLANNED')
        AND sm.status = 'ACTIVE'
      ORDER BY
        sy.start_date DESC,
        sm.start_date ASC,
        sm.semester_id ASC
    `,
  );

  const [grades] = await pool.query(
    `
      SELECT
        ar.result_id AS resultId,
        ar.score_type AS scoreType,
        ar.score_value AS scoreValue,
        ar.comment,
        DATE_FORMAT(ar.created_at, '%Y-%m-%d %H:%i:%s') AS createdAt,

        sb.subject_id AS subjectId,
        sb.subject_name AS subjectName,
        sb.subject_code AS subjectCode,

        sm.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        DATE_FORMAT(sm.start_date, '%Y-%m-%d') AS semesterStartDate,
        DATE_FORMAT(sm.end_date, '%Y-%m-%d') AS semesterEndDate,

        sy.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS schoolYearStartDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS schoolYearEndDate,
        sy.is_active AS schoolYearIsActive
      FROM academic_result ar
      INNER JOIN subject sb
        ON sb.subject_id = ar.subject_id
      INNER JOIN semester sm
        ON sm.semester_id = ar.semester_id
      INNER JOIN school_year sy
        ON sy.school_year_id = sm.school_year_id
      WHERE ar.student_id = ?
      ORDER BY
        sy.start_date DESC,
        sm.start_date ASC,
        sb.subject_name ASC,
        FIELD(
          ar.score_type,
          'TX1',
          'TX2',
          'TX3',
          'ONE_PERIOD',
          'MIDTERM',
          'FINAL'
        ) ASC,
        ar.created_at ASC
    `,
    [context.studentId],
  );

  const [summaryRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalScores,
        ROUND(AVG(score_value), 2) AS averageScore,
        ROUND(MAX(score_value), 2) AS highestScore,
        ROUND(MIN(score_value), 2) AS lowestScore
      FROM academic_result
      WHERE student_id = ?
    `,
    [context.studentId],
  );

  return {
    context,
    summary: summaryRows[0] || {
      totalScores: 0,
      averageScore: null,
      highestScore: null,
      lowestScore: null,
    },
    subjects,
    schoolYears,
    grades,
  };
}

function normalizeCountRow(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value === null ? 0 : Number.isNaN(Number(value)) ? value : Number(value),
    ]),
  );
}

async function findDashboardByUserId(userId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [homeworkRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalHomework,
        SUM(CASE WHEN hws.submission_id IS NOT NULL THEN 1 ELSE 0 END) AS submittedHomework,
        SUM(CASE WHEN hws.submission_id IS NULL AND hw.due_date < NOW() THEN 1 ELSE 0 END) AS overdueHomework,
        SUM(CASE WHEN hws.submission_id IS NULL AND hw.due_date >= NOW() THEN 1 ELSE 0 END) AS pendingHomework
      FROM homework hw
      LEFT JOIN homework_submission hws
        ON hws.homework_id = hw.homework_id
        AND hws.student_id = ?
      WHERE hw.class_id = ?
        AND hw.status IN ('OPEN', 'PUBLISHED', 'ACTIVE')
    `,
    [context.studentId, context.classId],
  );

  const [gradeRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalScores,
        ROUND(AVG(score_value), 2) AS averageScore,
        ROUND(MAX(score_value), 2) AS highestScore
      FROM academic_result
      WHERE student_id = ?
    `,
    [context.studentId],
  );

  const [attendanceRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalAttendance,
        SUM(CASE WHEN at.type_name = 'PRESENT' THEN 1 ELSE 0 END) AS presentCount,
        SUM(CASE WHEN at.type_name = 'LATE' THEN 1 ELSE 0 END) AS lateCount,
        SUM(CASE WHEN at.type_name = 'ABSENT_EXCUSED' THEN 1 ELSE 0 END) AS excusedAbsentCount,
        SUM(CASE WHEN at.type_name = 'ABSENT_UNEXCUSED' THEN 1 ELSE 0 END) AS unexcusedAbsentCount
      FROM attendance a
      INNER JOIN attendance_type at
        ON at.attendance_type_id = a.attendance_type_id
      WHERE a.student_id = ?
        AND a.attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
    `,
    [context.studentId],
  );

  const [goalRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalGoals,
        SUM(CASE WHEN status = 'IN_PROGRESS' THEN 1 ELSE 0 END) AS inProgressGoals,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedGoals,
        ROUND(AVG(progress), 0) AS averageProgress
      FROM student_goal
      WHERE student_id = ?
        AND status <> 'ARCHIVED'
    `,
    [context.studentId],
  );

  const [recentNotifications] = await pool.query(
    `
      SELECT
        notification_id AS notificationId,
        title,
        content,
        type,
        related_type AS relatedType,
        related_id AS relatedId,
        is_read AS isRead,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt
      FROM notification
      WHERE receiver_id = ?
      ORDER BY created_at DESC
      LIMIT 6
    `,
    [userId],
  );

  const [upcomingEvents] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.event_type AS eventType,
        e.category,
        DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
        DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i') AS endDate,
        e.location,
        e.status,
        er.registration_id AS registrationId,
        er.attend_status AS attendStatus
      FROM event e
      LEFT JOIN event_registration er
        ON er.event_id = e.event_id
        AND (er.user_id = ? OR er.student_id = ?)
      WHERE (e.class_id IS NULL OR e.class_id = ?)
        AND e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED')
        AND (e.start_date IS NULL OR e.start_date >= DATE_SUB(NOW(), INTERVAL 1 DAY))
      ORDER BY e.start_date ASC, e.event_id DESC
      LIMIT 5
    `,
    [userId, context.studentId, context.classId],
  );

  return {
    context,
    homework: normalizeCountRow(homeworkRows[0]),
    grades: normalizeCountRow(gradeRows[0]),
    attendance: normalizeCountRow(attendanceRows[0]),
    goals: normalizeCountRow(goalRows[0]),
    recentNotifications,
    upcomingEvents: upcomingEvents.map((event) => ({
      ...event,
      isRegistered:
        Boolean(event.registrationId) && event.attendStatus !== "CANCELLED",
    })),
  };
}

async function findBehaviourByUserId(userId, filters = {}) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const { semesterId } = filters;
  const params = [context.studentId];
  let semesterClause = "";

  if (semesterId) {
    semesterClause = " AND br.semester_id = ?";
    params.push(Number(semesterId));
  }

  const [semesters] = await pool.query(
    `
      SELECT
        sm.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(sm.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(sm.end_date, '%Y-%m-%d') AS endDate
      FROM semester sm
      INNER JOIN school_year sy
        ON sy.school_year_id = sm.school_year_id
      WHERE sm.status = 'ACTIVE'
      ORDER BY sy.start_date DESC, sm.start_date ASC
    `,
  );

  const [records] = await pool.query(
    `
      SELECT
        br.behavior_id AS behaviorId,
        br.behavior_type AS behaviorType,
        br.title,
        br.category,
        br.description,
        br.severity_level AS severityLevel,
        br.points,
        DATE_FORMAT(br.record_date, '%Y-%m-%d') AS recordDate,
        br.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        sy.year_name AS schoolYearName,
        br.evidence_url AS evidenceUrl,
        br.status,
        ua.full_name AS createdByName,
        DATE_FORMAT(br.created_at, '%Y-%m-%d %H:%i') AS createdAt
      FROM behavior_record br
      LEFT JOIN semester sm
        ON sm.semester_id = br.semester_id
      LEFT JOIN school_year sy
        ON sy.school_year_id = sm.school_year_id
      LEFT JOIN user_account ua
        ON ua.user_id = br.created_by
      WHERE br.student_id = ?
        AND br.status = 'ACTIVE'
        ${semesterClause}
      ORDER BY br.record_date DESC, br.behavior_id DESC
    `,
    params,
  );

  const [summaryRows] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalRecords,
        SUM(CASE WHEN behavior_type = 'POSITIVE' THEN 1 ELSE 0 END) AS meritCount,
        SUM(CASE WHEN behavior_type = 'VIOLATION' THEN 1 ELSE 0 END) AS violationCount,
        SUM(CASE WHEN behavior_type = 'POSITIVE' THEN points ELSE 0 END) AS meritPoints,
        SUM(CASE WHEN behavior_type = 'VIOLATION' THEN ABS(points) ELSE 0 END) AS demeritPoints
      FROM behavior_record br
      WHERE br.student_id = ?
        AND br.status = 'ACTIVE'
        ${semesterClause}
    `,
    params,
  );

  const conductParams = [context.studentId];
  let conductClause = "";

  if (semesterId) {
    conductClause = " AND ce.semester_id = ?";
    conductParams.push(Number(semesterId));
  }

  const [conductRows] = await pool.query(
    `
      SELECT
        ce.evaluation_id AS evaluationId,
        ce.semester_id AS semesterId,
        sm.semester_name AS semesterName,
        sy.year_name AS schoolYearName,
        ce.merit_points AS meritPoints,
        ce.demerit_points AS demeritPoints,
        ce.base_score AS baseScore,
        ce.adjustment,
        ce.final_score AS finalScore,
        ce.conduct_grade AS conductGrade,
        ce.comment,
        ce.status,
        ua.full_name AS evaluatedByName,
        DATE_FORMAT(ce.updated_at, '%Y-%m-%d %H:%i') AS updatedAt
      FROM conduct_evaluation ce
      INNER JOIN semester sm
        ON sm.semester_id = ce.semester_id
      INNER JOIN school_year sy
        ON sy.school_year_id = sm.school_year_id
      LEFT JOIN user_account ua
        ON ua.user_id = ce.evaluated_by
      WHERE ce.student_id = ?
        ${conductClause}
      ORDER BY sy.start_date DESC, sm.start_date DESC, ce.evaluation_id DESC
      LIMIT 1
    `,
    conductParams,
  );

  // conduct_grade lưu dạng KEY (TOT/KHA/TB/YEU/KEM) → gắn nhãn tiếng Việt cho FE.
  const conductRow = conductRows[0]
    ? { ...conductRows[0], conductGrade: CONDUCT_GRADE_LABEL[conductRows[0].conductGrade] ?? conductRows[0].conductGrade }
    : null;

  return {
    context,
    semesters,
    summary: normalizeCountRow(summaryRows[0]),
    conduct: conductRow,
    records,
  };
}

async function findEventsByUserId(userId, filters = {}) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const { status, search } = filters;
  const params = [userId, context.studentId, context.classId];
  let where = "WHERE (e.class_id IS NULL OR e.class_id = ?)";

  if (status === "COMPLETED") {
    where += " AND e.status IN ('COMPLETED', 'DONE')";
  } else if (status) {
    where += " AND e.status = ?";
    params.push(status);
  } else {
    where += " AND e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED', 'COMPLETED', 'DONE', 'CANCELLED')";
  }

  if (search) {
    where += " AND (e.title LIKE ? OR e.description LIKE ? OR e.location LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [events] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.event_type AS eventType,
        e.category,
        e.description,
        DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
        DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i') AS endDate,
        e.location,
        e.organizer,
        e.capacity,
        e.outcome,
        e.status,
        sc.class_name AS className,
        er.registration_id AS registrationId,
        er.attend_status AS attendStatus,
        DATE_FORMAT(er.register_date, '%Y-%m-%d %H:%i') AS registeredAt,
        (
          SELECT COUNT(*)
          FROM event_registration er2
          WHERE er2.event_id = e.event_id
            AND COALESCE(er2.attend_status, 'REGISTERED') <> 'CANCELLED'
        ) AS registeredCount
      FROM event e
      LEFT JOIN school_class sc
        ON sc.class_id = e.class_id
      LEFT JOIN event_registration er
        ON er.event_id = e.event_id
        AND (er.user_id = ? OR er.student_id = ?)
      ${where}
      ORDER BY
        CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END,
        e.start_date ASC,
        e.event_id DESC
    `,
    params,
  );

  return {
    context,
    events: events.map((event) => ({
      ...event,
      registeredCount: Number(event.registeredCount || 0),
      isRegistered:
        Boolean(event.registrationId) && event.attendStatus !== "CANCELLED",
    })),
  };
}

async function findEventForStudent(userId, eventId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [[event]] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.capacity,
        e.status,
        e.class_id AS classId,
        (
          SELECT COUNT(*)
          FROM event_registration er
          WHERE er.event_id = e.event_id
            AND COALESCE(er.attend_status, 'REGISTERED') <> 'CANCELLED'
        ) AS registeredCount
      FROM event e
      WHERE e.event_id = ?
        AND (e.class_id IS NULL OR e.class_id = ?)
      LIMIT 1
    `,
    [eventId, context.classId],
  );

  if (!event) {
    return null;
  }

  return {
    context,
    event: {
      ...event,
      registeredCount: Number(event.registeredCount || 0),
    },
  };
}

async function findEventDetailByUserId(userId, eventId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [[event]] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.event_type AS eventType,
        e.category,
        e.description,
        DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
        DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i') AS endDate,
        e.location,
        e.organizer,
        e.capacity,
        e.outcome,
        e.status,
        e.class_id AS classId,
        sc.class_name AS className,
        er.registration_id AS registrationId,
        er.attend_status AS attendStatus,
        DATE_FORMAT(er.register_date, '%Y-%m-%d %H:%i') AS registeredAt,
        (
          SELECT COUNT(*)
          FROM event_registration er2
          WHERE er2.event_id = e.event_id
            AND COALESCE(er2.attend_status, 'REGISTERED') <> 'CANCELLED'
        ) AS registeredCount
      FROM event e
      LEFT JOIN school_class sc
        ON sc.class_id = e.class_id
      LEFT JOIN event_registration er
        ON er.event_id = e.event_id
        AND (er.user_id = ? OR er.student_id = ?)
      WHERE e.event_id = ?
        AND (e.class_id IS NULL OR e.class_id = ?)
        AND e.status IN (
          'ACTIVE',
          'PUBLISHED',
          'SCHEDULED',
          'COMPLETED',
          'DONE',
          'CANCELLED'
        )
      LIMIT 1
    `,
    [userId, context.studentId, eventId, context.classId],
  );

  if (!event) {
    return null;
  }

  const [relatedEvents] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.event_type AS eventType,
        e.category,
        DATE_FORMAT(e.start_date, '%Y-%m-%d %H:%i') AS startDate,
        DATE_FORMAT(e.end_date, '%Y-%m-%d %H:%i') AS endDate,
        e.location,
        e.status
      FROM event e
      WHERE e.event_id <> ?
        AND (e.class_id IS NULL OR e.class_id = ?)
        AND e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED', 'COMPLETED', 'DONE')
      ORDER BY
        CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END,
        ABS(TIMESTAMPDIFF(SECOND, e.start_date, ?)) ASC,
        e.event_id DESC
      LIMIT 4
    `,
    [eventId, context.classId, event.startDate],
  );

  return {
    context,
    event: {
      ...event,
      registeredCount: Number(event.registeredCount || 0),
      isRegistered:
        Boolean(event.registrationId) && event.attendStatus !== "CANCELLED",
    },
    relatedEvents,
  };
}

async function registerEvent({ userId, studentId, eventId }) {
  const [result] = await pool.query(
    `
      INSERT INTO event_registration
        (event_id, user_id, participant_type, student_id, registered_by, attend_status)
      VALUES (?, ?, 'STUDENT', ?, ?, 'REGISTERED')
      ON DUPLICATE KEY UPDATE
        attend_status = 'REGISTERED'
    `,
    [eventId, userId, studentId, userId],
  );

  return result.insertId;
}

async function findNotificationsByUserId(userId, filters = {}) {
  const limit = Math.min(100, Math.max(1, Number(filters.limit) || 30));
  const unreadOnly = filters.unreadOnly === true || filters.unreadOnly === "true";

  const params = [userId];
  let where = "receiver_id = ?";

  if (unreadOnly) {
    where += " AND is_read = FALSE";
  }

  const [[summary]] = await pool.query(
    `
      SELECT
        COUNT(*) AS totalNotifications,
        SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) AS unreadNotifications
      FROM notification
      WHERE receiver_id = ?
    `,
    [userId],
  );

  const [items] = await pool.query(
    `
      SELECT
        notification_id AS notificationId,
        title,
        content,
        type,
        related_type AS relatedType,
        related_id AS relatedId,
        is_read AS isRead,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS createdAt
      FROM notification
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [...params, limit],
  );

  return {
    summary: normalizeCountRow(summary),
    items,
  };
}

async function markNotificationRead(userId, notificationId) {
  const [result] = await pool.query(
    `
      UPDATE notification
      SET is_read = TRUE
      WHERE receiver_id = ?
        AND notification_id = ?
    `,
    [userId, notificationId],
  );

  return result.affectedRows;
}

async function markAllNotificationsRead(userId) {
  const [result] = await pool.query(
    `
      UPDATE notification
      SET is_read = TRUE
      WHERE receiver_id = ?
        AND is_read = FALSE
    `,
    [userId],
  );

  return result.affectedRows;
}

async function findTeacherContactsByUserId(userId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [teachers] = await pool.query(
    `
      SELECT DISTINCT
        t.teacher_id AS teacherId,
        t.user_id AS teacherUserId,
        ua.full_name AS teacherName,
        ua.email,
        ua.phone,
        ua.avatar,
        tc.role_in_class AS roleInClass,
        sb.subject_name AS subjectName,
        sc.class_name AS className
      FROM teacher_class tc
      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      INNER JOIN school_class sc
        ON sc.class_id = tc.class_id
      LEFT JOIN subject sb
        ON sb.subject_id = tc.subject_id
      WHERE tc.class_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      ORDER BY
        CASE tc.role_in_class WHEN 'HOMEROOM_TEACHER' THEN 0 ELSE 1 END,
        ua.full_name ASC
    `,
    [context.classId],
  );

  return {
    context,
    teachers,
  };
}

async function isTeacherContactForStudent(userId, teacherUserId) {
  const context = await findStudentContextByUserId(userId);

  if (!context) {
    return null;
  }

  const [[teacher]] = await pool.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        t.user_id AS teacherUserId
      FROM teacher_class tc
      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id
      WHERE tc.class_id = ?
        AND t.user_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      LIMIT 1
    `,
    [context.classId, teacherUserId],
  );

  return teacher
    ? {
      context,
      teacher,
    }
    : null;
}

module.exports = {
  findProfileByUserId,
  updateProfileByUserId,
  findStudentContextByUserId,
  findDashboardByUserId,
  findHomeworksByUserId,
  findGradesByUserId,
  findBehaviourByUserId,
  findEventsByUserId,
  findEventForStudent,
  findEventDetailByUserId,
  registerEvent,
  findNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  findTeacherContactsByUserId,
  isTeacherContactForStudent,
};