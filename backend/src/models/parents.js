const { pool } = require("../config/db");
const { buildOverallScoreSummary } = require("../services/gpa.service");

async function findProfileByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        ua.user_id    AS userId,
        ua.username,
        ua.email,
        ua.full_name  AS fullName,
        ua.phone,
        ua.avatar,

        pp.parent_id  AS parentId,
        pp.relationship,
        pp.is_primary AS isPrimary

      FROM user_account ua
      INNER JOIN parent_profile pp
        ON pp.user_id = ua.user_id

      WHERE ua.user_id = ?
        AND ua.status  = 'ACTIVE'

      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

async function findLinkedStudentsByUserId(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        -- Student user info
        sua.user_id        AS studentUserId,
        sua.full_name      AS studentFullName,
        sua.email          AS studentEmail,
        sua.phone          AS studentPhone,
        sua.avatar         AS studentAvatar,

        -- Student profile
        s.student_id       AS studentId,
        s.student_code     AS studentCode,
        DATE_FORMAT(
          s.date_of_birth,
          '%Y-%m-%d'
        )                  AS dateOfBirth,
        s.gender,
        s.address,
        s.status           AS studentStatus,

        -- Relationship info
        sp.relationship,
        sp.is_primary      AS isPrimary,

        -- Class info
        sc.class_id        AS classId,
        sc.class_name      AS className,
        sc.room_name       AS roomName,

        -- Grade info
        g.grade_id         AS gradeId,
        g.grade_name       AS gradeName,

        -- School year info
        sy.school_year_id  AS schoolYearId,
        sy.year_name       AS schoolYearName

      FROM user_account ua
      INNER JOIN parent_profile pp
        ON pp.user_id = ua.user_id

      INNER JOIN student_parent sp
        ON sp.parent_id = pp.parent_id

      INNER JOIN student s
        ON s.student_id = sp.student_id
        AND s.status    = 'ACTIVE'

      INNER JOIN user_account sua
        ON sua.user_id = s.user_id
        AND sua.status = 'ACTIVE'

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status    = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status  = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      WHERE ua.user_id  = ?
        AND ua.status   = 'ACTIVE'

      ORDER BY
        sp.is_primary      DESC,
        sy.is_active       DESC,
        sy.start_date      DESC,
        ce.enrollment_date DESC
    `,
    [userId],
  );

  // A student can temporarily have more than one ACTIVE class_enrollment
  // row (e.g. mid school-year transition, before promotion closes the old
  // one), which would multiply that student's row in the join above.
  // Rows are already ordered so the best match comes first, so just keep
  // the first row seen per student.
  const seen = new Set();
  const deduped = [];
  for (const row of rows) {
    if (seen.has(row.studentId)) continue;
    seen.add(row.studentId);
    deduped.push(row);
  }

  return deduped;
}

async function findStudentDetailByStudentId(studentId) {
  const [rows] = await pool.query(
    `
      SELECT
        s.student_id   AS studentId,
        s.student_code AS studentCode,
        ua.full_name   AS fullName,
        ua.email,
        ua.phone,
        ua.avatar,
        DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
        s.gender,
        s.address,
        s.status       AS studentStatus,

        sc.class_id    AS classId,
        sc.class_name  AS className,
        sc.room_name   AS roomName,
        g.grade_name   AS gradeName,
        sy.year_name   AS schoolYearName,

        ht.teacher_id  AS homeroomTeacherId,
        htu.full_name  AS homeroomTeacherName,
        htu.email      AS homeroomTeacherEmail,
        htu.phone      AS homeroomTeacherPhone,
        htu.avatar     AS homeroomTeacherAvatar

      FROM student s
      INNER JOIN user_account ua
        ON ua.user_id = s.user_id

      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status    = 'ACTIVE'

      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
        AND sc.status  = 'ACTIVE'

      LEFT JOIN grade g
        ON g.grade_id = sc.grade_id

      LEFT JOIN school_year sy
        ON sy.school_year_id = sc.school_year_id

      LEFT JOIN teacher_class htc
        ON htc.class_id      = sc.class_id
        AND htc.role_in_class = 'HOMEROOM_TEACHER'
        AND htc.end_date      IS NULL

      LEFT JOIN teacher ht
        ON ht.teacher_id = htc.teacher_id

      LEFT JOIN user_account htu
        ON htu.user_id = ht.user_id

      WHERE s.student_id = ?
        AND s.status     = 'ACTIVE'
        AND ua.status    = 'ACTIVE'

      ORDER BY
        sy.is_active       DESC,
        sy.start_date      DESC,
        ce.enrollment_date DESC

      LIMIT 1
    `,
    [studentId],
  );

  return rows[0] || null;
}

async function findGradesByStudentId(studentId) {
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
        ar.max_score AS maxScore,
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
    [studentId],
  );

  return {
    summary: buildOverallScoreSummary(grades),
    subjects,
    schoolYears,
    grades,
  };
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

  const totalNotifications = Number(summary?.totalNotifications || 0);
  const unreadNotifications = Number(summary?.unreadNotifications || 0);

  return {
    summary: { totalNotifications, unreadNotifications },
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

// Feed "Thông báo nhà trường" cho Trung tâm thông báo của phụ huynh — chỉ thông
// báo toàn trường (không gắn lớp) hoặc gắn đúng lớp của con, và audience có phụ huynh.
async function findAnnouncementFeedForClass(classId) {
  const [rows] = await pool.query(
    `SELECT a.announcement_id AS announcementId, a.title, a.content, a.audience,
            a.is_pinned AS isPinned, a.published_at AS ts,
            COALESCE(sc.class_name, 'Toàn trường') AS className,
            ua.full_name AS createdByName
     FROM announcement a
     LEFT JOIN school_class sc ON sc.class_id = a.class_id
     INNER JOIN user_account ua ON ua.user_id = a.created_by
     WHERE a.status = 'PUBLISHED'
       AND a.audience IN ('CLASS_ALL', 'CLASS_PARENTS')
       AND (a.class_id IS NULL OR a.class_id = ?)
     ORDER BY a.is_pinned DESC, a.published_at DESC
     LIMIT 30`,
    [classId],
  );
  return rows.map((r) => ({ ...r, createdAt: r.ts }));
}

// Feed "Cảnh báo học sinh" cho Trung tâm thông báo của phụ huynh — gộp 3 loại
// cảnh báo (học lực / hạnh kiểm / chuyên cần) của một học sinh (con của phụ huynh).
async function findWarningAlertsForStudent(studentId) {
  const [academic] = await pool.query(
    `SELECT warning_id AS warningId, 'ACADEMIC' AS source, warning_type AS warningType,
            note, status, created_at AS ts
     FROM academic_warning
     WHERE student_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [studentId],
  );
  const [behaviour] = await pool.query(
    `SELECT warning_id AS warningId, 'BEHAVIOUR' AS source, warning_type AS warningType,
            note, status, created_at AS ts
     FROM behavior_warning
     WHERE student_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [studentId],
  );
  const [attendance] = await pool.query(
    `SELECT warning_id AS warningId, 'ATTENDANCE' AS source, 'ABSENCE_RISK' AS warningType,
            note, status, created_at AS ts
     FROM attendance_warning
     WHERE student_id = ?
     ORDER BY created_at DESC LIMIT 30`,
    [studentId],
  );

  return [...academic, ...behaviour, ...attendance]
    .map((r) => ({ ...r, createdAt: r.ts }))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

async function findTeacherContactsByUserId(userId) {
  const [teachers] = await pool.query(
    `
      SELECT DISTINCT
        t.teacher_id  AS teacherId,
        t.user_id     AS teacherUserId,
        ua.full_name  AS teacherName,
        ua.email,
        ua.phone,
        ua.avatar,
        tc.role_in_class AS roleInClass,
        sb.subject_name  AS subjectName,
        sc.class_id      AS classId,
        sc.class_name    AS className,
        s.student_id     AS studentId,
        sua.full_name    AS studentName

      FROM parent_profile pp
      INNER JOIN student_parent sp
        ON sp.parent_id = pp.parent_id

      INNER JOIN student s
        ON s.student_id = sp.student_id
        AND s.status    = 'ACTIVE'

      INNER JOIN user_account sua
        ON sua.user_id = s.user_id

      INNER JOIN class_enrollment ce
        ON ce.student_id = s.student_id
        AND ce.status    = 'ACTIVE'

      INNER JOIN school_class sc
        ON sc.class_id = ce.class_id

      INNER JOIN teacher_class tc
        ON tc.class_id = sc.class_id
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())

      LEFT JOIN subject sb
        ON sb.subject_id = tc.subject_id

      INNER JOIN teacher t
        ON t.teacher_id = tc.teacher_id

      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'

      WHERE pp.user_id = ?

      ORDER BY
        sua.full_name ASC,
        CASE tc.role_in_class WHEN 'HOMEROOM_TEACHER' THEN 0 ELSE 1 END,
        ua.full_name ASC
    `,
    [userId],
  );

  const studentMap = new Map();

  teachers.forEach((row) => {
    if (!studentMap.has(row.studentId)) {
      studentMap.set(row.studentId, {
        studentId: row.studentId,
        studentName: row.studentName,
        classId: row.classId,
        className: row.className,
      });
    }
  });

  return {
    students: Array.from(studentMap.values()),
    teachers,
  };
}

async function findEventsByStudentId({ studentUserId, studentId, classId }, filters = {}) {
  const { status, search } = filters;
  const params = [studentUserId, studentId, classId];
  let where = "WHERE (e.class_id IS NULL OR e.class_id = ?)";

  if (status) {
    where += " AND e.status = ?";
    params.push(status);
  } else {
    where += " AND e.status IN ('ACTIVE', 'PUBLISHED', 'SCHEDULED', 'COMPLETED', 'CANCELLED')";
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

  return events.map((event) => ({
    ...event,
    registeredCount: Number(event.registeredCount || 0),
    isRegistered: Boolean(event.registrationId),
  }));
}

async function findEventForChild(eventId, classId) {
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
    [eventId, classId],
  );

  if (!event) {
    return null;
  }

  return {
    ...event,
    registeredCount: Number(event.registeredCount || 0),
  };
}

// Kiểm tra sức chứa phải nằm CÙNG transaction với lệnh ghi và khóa dòng event
// (FOR UPDATE) — bản cũ đếm ở controller rồi mới insert nên hai phụ huynh bấm
// cùng lúc đều lọt qua và sự kiện vượt sức chứa.
async function registerEventForChild({ studentUserId, studentId, eventId, registeredBy }) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[event]] = await connection.query(
      "SELECT event_id AS eventId, capacity FROM event WHERE event_id = ? LIMIT 1 FOR UPDATE",
      [eventId],
    );

    if (!event) {
      const error = new Error("Không tìm thấy sự kiện");
      error.statusCode = 404;
      throw error;
    }

    if (event.capacity) {
      const [[countRow]] = await connection.query(
        `
          SELECT COUNT(*) AS registeredCount
          FROM event_registration
          WHERE event_id = ?
            AND user_id <> ?
            AND COALESCE(attend_status, 'REGISTERED') <> 'CANCELLED'
        `,
        [eventId, studentUserId],
      );

      if (Number(countRow.registeredCount || 0) >= Number(event.capacity)) {
        const error = new Error("Sự kiện đã đủ số lượng đăng ký");
        error.statusCode = 409;
        throw error;
      }
    }

    const [result] = await connection.query(
      `
        INSERT INTO event_registration
          (event_id, user_id, participant_type, student_id, registered_by, attend_status)
        VALUES (?, ?, 'STUDENT', ?, ?, 'REGISTERED')
        ON DUPLICATE KEY UPDATE
          attend_status = 'REGISTERED'
      `,
      [eventId, studentUserId, studentId, registeredBy],
    );

    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  findProfileByUserId,
  findLinkedStudentsByUserId,
  findStudentDetailByStudentId,
  findGradesByStudentId,
  findNotificationsByUserId,
  markNotificationRead,
  markAllNotificationsRead,
  findAnnouncementFeedForClass,
  findWarningAlertsForStudent,
  findTeacherContactsByUserId,
  findEventsByStudentId,
  findEventForChild,
  registerEventForChild,
};
