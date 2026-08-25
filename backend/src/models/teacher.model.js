const { pool } = require("../config/db");

async function findProfileByUserId(userId) {
  const [[teacher]] = await pool.query(
    `SELECT
       t.teacher_id          AS teacherId,
       t.teacher_code        AS teacherCode,
       t.subject_specialize  AS subjectSpecialize,
       ua.user_id            AS userId,
       ua.full_name          AS fullName,
       ua.email,
       ua.phone,
       ua.avatar
     FROM teacher t
     INNER JOIN user_account ua ON ua.user_id = t.user_id
     WHERE t.user_id = ?
       AND ua.status = 'ACTIVE'`,
    [userId],
  );

  if (!teacher) return null;

  const [classes] = await pool.query(
    `SELECT
       sc.class_id          AS classId,
       sc.class_name        AS className,
       sc.room_name         AS roomName,
       g.grade_name         AS gradeName,
       sy.school_year_id    AS schoolYearId,
       sy.year_name         AS schoolYearName,
       CASE WHEN MAX(tc.role_in_class = 'HOMEROOM_TEACHER') = 1
            THEN 'HOMEROOM_TEACHER' ELSE 'SUBJECT_TEACHER' END AS roleInClass,
       COUNT(DISTINCT ce.student_id) AS studentCount
     FROM teacher_class tc
     INNER JOIN school_class sc
       ON sc.class_id = tc.class_id
       AND sc.status = 'ACTIVE'
     INNER JOIN grade g
       ON g.grade_id = sc.grade_id
     INNER JOIN school_year sy
       ON sy.school_year_id = sc.school_year_id
       AND sy.is_active = TRUE
     LEFT JOIN class_enrollment ce
       ON ce.class_id = sc.class_id
       AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ?
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     GROUP BY
       sc.class_id, sc.class_name, sc.room_name,
       g.grade_name, sy.school_year_id, sy.year_name
     ORDER BY
       MAX(tc.role_in_class = 'HOMEROOM_TEACHER') DESC,
       sc.class_name ASC`,
    [teacher.teacherId],
  );

  return {
    ...teacher,
    classes: classes.map((c) => ({ ...c, studentCount: Number(c.studentCount) })),
  };
}

async function findTodayAttendanceSummary(classId, date) {
  const [rows] = await pool.query(
    `SELECT
       at.type_name AS typeName,
       COUNT(*)     AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.class_id = ?
       AND a.attendance_date = ?
       AND a.attendance_context = 'CLASS'
       AND a.timetable_id IS NOT NULL
     GROUP BY at.attendance_type_id, at.type_name`,
    [classId, date],
  );

  const summary = {
    present: 0,
    late: 0,
    absentExcused: 0,
    absentUnexcused: 0,
    earlyLeave: 0,
  };

  const typeMap = {
    PRESENT: "present",
    LATE: "late",
    ABSENT_EXCUSED: "absentExcused",
    ABSENT_UNEXCUSED: "absentUnexcused",
    EARLY_LEAVE: "earlyLeave",
  };

  for (const row of rows) {
    const key = typeMap[row.typeName];
    if (key) summary[key] = Number(row.count);
  }

  summary.total = summary.present + summary.late + summary.absentExcused +
    summary.absentUnexcused + summary.earlyLeave;

  return summary;
}

async function findWeeklyAttendance(classId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS date,
       at.type_name                               AS typeName,
       COUNT(*)                                   AS count
     FROM attendance a
     INNER JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE a.class_id = ?
       AND a.attendance_date BETWEEN ? AND ?
       AND a.attendance_context = 'CLASS'
       AND a.timetable_id IS NOT NULL
     GROUP BY
       a.attendance_date,
       at.attendance_type_id,
       at.type_name
     ORDER BY a.attendance_date ASC`,
    [classId, startDate, endDate],
  );

  const byDate = {};

  for (const row of rows) {
    if (!byDate[row.date]) {
      byDate[row.date] = { date: row.date, present: 0, late: 0, absent: 0, total: 0 };
    }

    const count = Number(row.count);

    if (row.typeName === "PRESENT" || row.typeName === "EARLY_LEAVE") {
      byDate[row.date].present += count;
    } else if (row.typeName === "LATE") {
      byDate[row.date].late += count;
    } else {
      byDate[row.date].absent += count;
    }

    byDate[row.date].total += count;
  }

  return Object.values(byDate);
}

async function findPendingLeaveRequestCount(teacherId) {
  const [[{ count }]] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM leave_request
     WHERE homeroom_teacher_id = ?
       AND status = 'PENDING'`,
    [teacherId],
  );
  return Number(count);
}

async function findAtRiskStudents(classId, absenceThreshold = 0.2) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       ua.avatar,
       COUNT(a.attendance_id) AS totalDays,
       SUM(
         CASE WHEN at.type_name IN ('ABSENT_UNEXCUSED', 'ABSENT_EXCUSED')
              THEN 1 ELSE 0 END
       ) AS absentCount,
       SUM(
         CASE WHEN at.type_name = 'LATE' THEN 1 ELSE 0 END
       ) AS lateCount
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
       AND a.timetable_id IS NOT NULL
     LEFT JOIN attendance_type at
       ON at.attendance_type_id = a.attendance_type_id
     WHERE ce.class_id = ?
       AND ce.status = 'ACTIVE'
     GROUP BY
       s.student_id, s.student_code, ua.full_name, ua.avatar
     HAVING
       totalDays > 0
       AND (absentCount / totalDays) >= ?
     ORDER BY (absentCount / totalDays) DESC
     LIMIT 10`,
    [classId, classId, absenceThreshold],
  );

  return rows.map((r) => {
    const totalDays = Number(r.totalDays);
    const absentCount = Number(r.absentCount);
    return {
      studentId: r.studentId,
      studentCode: r.studentCode,
      fullName: r.fullName,
      avatar: r.avatar,
      absentCount,
      lateCount: Number(r.lateCount),
      totalDays,
      absenceRate: totalDays > 0 ? Math.round((absentCount / totalDays) * 100) : 0,
    };
  });
}

async function findParentEngagementRate(classId) {
  const [[result]] = await pool.query(
    `SELECT
       COUNT(*)                                               AS total,
       SUM(CASE WHEN n.is_read = TRUE THEN 1 ELSE 0 END)    AS totalRead
     FROM notification n
     INNER JOIN user_account ua
       ON ua.user_id = n.receiver_id
     INNER JOIN parent_profile pp
       ON pp.user_id = ua.user_id
     INNER JOIN student_parent sp
       ON sp.parent_id = pp.parent_id
     INNER JOIN class_enrollment ce
       ON ce.student_id = sp.student_id
       AND ce.class_id = ?
       AND ce.status = 'ACTIVE'
     WHERE n.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    [classId],
  );

  const total = Number(result.total);
  const totalRead = Number(result.totalRead);

  return {
    total,
    totalRead,
    readRate: total > 0 ? Math.round((totalRead / total) * 100) : null,
  };
}

// Feed "Cảnh báo học sinh" cho Trung tâm thông báo của GVCN — gộp 3 loại cảnh báo
// (học lực / hạnh kiểm / chuyên cần) của học sinh thuộc lớp chủ nhiệm.
async function findStudentAlertFeed(teacherId) {
  const homeroomJoin = `
    INNER JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
    INNER JOIN teacher_class tc ON tc.class_id = ce.class_id AND tc.teacher_id = ? AND tc.role_in_class = 'HOMEROOM_TEACHER'
    INNER JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
    INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id AND sy.is_active = 1
    AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())`;

  const [academic] = await pool.query(
    `SELECT aw.warning_id AS warningId, 'ACADEMIC' AS source, aw.warning_type AS warningType,
            aw.note, aw.status, aw.created_at AS ts, s.student_id AS studentId,
            s.student_code AS studentCode, ua.full_name AS studentName, sc.class_name AS className
     FROM academic_warning aw
     INNER JOIN student s ON s.student_id = aw.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     ${homeroomJoin}
     ORDER BY aw.created_at DESC LIMIT 30`,
    [teacherId],
  );
  const [behaviour] = await pool.query(
    `SELECT bw.warning_id AS warningId, 'BEHAVIOUR' AS source, bw.warning_type AS warningType,
            bw.note, bw.status, bw.created_at AS ts, s.student_id AS studentId,
            s.student_code AS studentCode, ua.full_name AS studentName, sc.class_name AS className
     FROM behavior_warning bw
     INNER JOIN student s ON s.student_id = bw.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     ${homeroomJoin}
     ORDER BY bw.created_at DESC LIMIT 30`,
    [teacherId],
  );
  const [attendance] = await pool.query(
    `SELECT aw.warning_id AS warningId, 'ATTENDANCE' AS source, 'ABSENCE_RISK' AS warningType,
            aw.note, aw.status, aw.created_at AS ts, s.student_id AS studentId,
            s.student_code AS studentCode, ua.full_name AS studentName, sc.class_name AS className
     FROM attendance_warning aw
     INNER JOIN student s ON s.student_id = aw.student_id
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     ${homeroomJoin}
     ORDER BY aw.created_at DESC LIMIT 30`,
    [teacherId],
  );

  return [...academic, ...behaviour, ...attendance]
    .map((r) => ({ ...r, createdAt: r.ts }))
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

// Feed "Thông báo nhà trường" — bảng tin của (các) lớp chủ nhiệm: mọi thông báo
// đã phát hành gửi tới lớp GV chủ nhiệm (kể cả thông báo do nhân sự/BGH đăng).
async function findHomeroomAnnouncements(teacherId) {
  const [rows] = await pool.query(
    `SELECT a.announcement_id AS announcementId, a.title, a.content, a.audience,
            a.is_pinned AS isPinned, a.published_at AS ts, sc.class_name AS className,
            ua.full_name AS createdByName
     FROM announcement a
     INNER JOIN teacher_class tc ON tc.class_id = a.class_id
       AND tc.teacher_id = ? AND tc.role_in_class = 'HOMEROOM_TEACHER'
     INNER JOIN school_class sc ON sc.class_id = a.class_id AND sc.status = 'ACTIVE'
     INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id AND sy.is_active = 1
     INNER JOIN user_account ua ON ua.user_id = a.created_by
     WHERE a.status = 'PUBLISHED'
       AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
     ORDER BY a.is_pinned DESC, a.published_at DESC
     LIMIT 30`,
    [teacherId],
  );
  return rows.map((r) => ({ ...r, createdAt: r.ts }));
}

module.exports = {
  findProfileByUserId,
  findTodayAttendanceSummary,
  findWeeklyAttendance,
  findPendingLeaveRequestCount,
  findAtRiskStudents,
  findParentEngagementRate,
  findStudentAlertFeed,
  findHomeroomAnnouncements,
};
