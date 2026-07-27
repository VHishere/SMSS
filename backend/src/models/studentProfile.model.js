const { pool } = require("../config/db");

// ── Permission ────────────────────────────────────────────────────────────────

async function isTeacherForClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class WHERE teacher_id = ? AND class_id = ? LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

async function isTeacherForStudent(teacherId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND ce.student_id = ?
     LIMIT 1`,
    [teacherId, studentId],
  );
  return Boolean(row);
}

// Homeroom-only variants (cho Mục tiêu, Hỗ trợ HS...): chỉ GVCN của lớp/hs.
async function isHomeroomOfClass(teacherId, classId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok FROM teacher_class
     WHERE teacher_id = ? AND class_id = ? AND role_in_class = 'HOMEROOM_TEACHER' LIMIT 1`,
    [teacherId, classId],
  );
  return Boolean(row);
}

async function isHomeroomOfStudent(teacherId, studentId) {
  const [[row]] = await pool.query(
    `SELECT 1 AS ok
     FROM teacher_class tc
     INNER JOIN class_enrollment ce ON ce.class_id = tc.class_id AND ce.status = 'ACTIVE'
     WHERE tc.teacher_id = ? AND ce.student_id = ? AND tc.role_in_class = 'HOMEROOM_TEACHER'
     LIMIT 1`,
    [teacherId, studentId],
  );
  return Boolean(row);
}

// "Học sinh" dùng chung cho cả GVBM (xem lớp dạy) lẫn GVCN → trả MỌI lớp dạy,
// kèm roleInClass để trang chỉ-GVCN (Mục tiêu, Hỗ trợ) tự lọc lớp chủ nhiệm.
async function findTeacherClasses(teacherId) {
  const [rows] = await pool.query(
    `SELECT sc.class_id AS classId, sc.class_name AS className, g.grade_name AS gradeName,
       CASE WHEN MAX(tc.role_in_class = 'HOMEROOM_TEACHER') = 1
            THEN 'HOMEROOM_TEACHER' ELSE 'SUBJECT_TEACHER' END AS roleInClass
     FROM teacher_class tc
     INNER JOIN school_class sc ON sc.class_id = tc.class_id AND sc.status = 'ACTIVE'
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     WHERE tc.teacher_id = ?
     GROUP BY sc.class_id, sc.class_name, g.grade_name
     ORDER BY sc.class_name ASC`,
    [teacherId],
  );
  return rows;
}

// School-wide class list for admin (no teacher_class ownership filter) —
// admin manages every class, not just ones they're assigned to.
async function findAllClasses() {
  const [rows] = await pool.query(
    `SELECT sc.class_id AS classId, sc.class_name AS className,
       sc.grade_id AS gradeId, g.grade_name AS gradeName,
       sc.school_year_id AS schoolYearId, sy.year_name AS schoolYearName
     FROM school_class sc
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
     WHERE sc.status = 'ACTIVE'
     ORDER BY sy.is_active DESC, g.grade_id ASC, sc.class_name ASC`,
  );
  return rows;
}

async function findSemesters() {
  const [rows] = await pool.query(
    `SELECT
       sem.semester_id AS semesterId, sem.semester_name AS semesterName,
       DATE_FORMAT(sem.start_date, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(sem.end_date, '%Y-%m-%d')   AS endDate,
       sy.school_year_id AS schoolYearId,
       sy.year_name AS schoolYearName, sy.is_active AS isActiveYear
     FROM semester sem
     INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
     ORDER BY sy.is_active DESC, sy.start_date DESC, sem.start_date ASC`,
  );
  return rows.map((r) => ({ ...r, isActiveYear: Boolean(r.isActiveYear) }));
}

async function findSemesterById(semesterId) {
  const [[row]] = await pool.query(
    `SELECT sem.semester_id AS semesterId, sem.semester_name AS semesterName,
       DATE_FORMAT(sem.start_date, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(sem.end_date, '%Y-%m-%d')   AS endDate,
       sy.school_year_id AS schoolYearId, sy.year_name AS schoolYearName
     FROM semester sem
     INNER JOIN school_year sy ON sy.school_year_id = sem.school_year_id
     WHERE sem.semester_id = ?`,
    [semesterId],
  );
  return row || null;
}

// ── 360 profile ───────────────────────────────────────────────────────────────

async function find360(studentId) {
  const [[profile]] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS fullName,
       ua.email,
       ua.phone,
       ua.avatar,
       s.gender,
       DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirth,
       s.address,
       s.status       AS studentStatus,
       sc.class_id    AS classId,
       sc.class_name  AS className,
       sc.room_name   AS roomName,
       g.grade_name   AS gradeName,
       sy.year_name   AS schoolYearName,
       DATE_FORMAT(ce.enrollment_date, '%Y-%m-%d') AS enrollmentDate,
       ce.status      AS enrollmentStatus
     FROM student s
     INNER JOIN user_account ua ON ua.user_id = s.user_id
     LEFT JOIN class_enrollment ce ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
     LEFT JOIN school_class sc ON sc.class_id = ce.class_id AND sc.status = 'ACTIVE'
     LEFT JOIN grade g ON g.grade_id = sc.grade_id
     LEFT JOIN school_year sy ON sy.school_year_id = sc.school_year_id
     WHERE s.student_id = ?`,
    [studentId],
  );

  if (!profile) return null;

  const [guardians] = await pool.query(
    `SELECT
       pp.parent_id   AS parentId,
       ua.full_name   AS fullName,
       ua.phone,
       ua.email,
       sp.relationship,
       sp.is_primary  AS isPrimary
     FROM student_parent sp
     INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
     INNER JOIN user_account ua ON ua.user_id = pp.user_id
     WHERE sp.student_id = ?
     ORDER BY sp.is_primary DESC`,
    [studentId],
  );

  return {
    ...profile,
    guardians: guardians.map((g) => ({ ...g, isPrimary: Boolean(g.isPrimary) })),
  };
}

// ── Per-student status snapshots (semester-scoped) ────────────────────────────

async function findAttendanceSummary(studentId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT at.type_name AS typeName, COUNT(*) AS count
     FROM attendance a
     INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ?
       AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     GROUP BY at.attendance_type_id, at.type_name`,
    [studentId, startDate, endDate],
  );

  const summary = { present: 0, late: 0, absentExcused: 0, absentUnexcused: 0, earlyLeave: 0 };
  const map = {
    PRESENT: "present", LATE: "late", ABSENT_EXCUSED: "absentExcused",
    ABSENT_UNEXCUSED: "absentUnexcused", EARLY_LEAVE: "earlyLeave",
  };
  for (const r of rows) {
    const k = map[r.typeName];
    if (k) summary[k] = Number(r.count);
  }
  summary.total = summary.present + summary.late + summary.absentExcused + summary.absentUnexcused + summary.earlyLeave;
  const attended = summary.present + summary.late;
  summary.attendanceRate = summary.total > 0 ? Math.round((attended / summary.total) * 1000) / 10 : null;
  return summary;
}

async function findMonthlyAttendance(studentId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       DATE_FORMAT(a.attendance_date, '%Y-%m') AS month,
       SUM(CASE WHEN at.type_name IN ('PRESENT','LATE') THEN 1 ELSE 0 END) AS attended,
       COUNT(*) AS total
     FROM attendance a
     INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ? AND a.attendance_context = 'CLASS'
       AND a.attendance_date BETWEEN ? AND ?
     GROUP BY DATE_FORMAT(a.attendance_date, '%Y-%m')
     ORDER BY month ASC`,
    [studentId, startDate, endDate],
  );
  return rows.map((r) => ({
    month: r.month,
    rate: Number(r.total) > 0 ? Math.round((Number(r.attended) / Number(r.total)) * 1000) / 10 : 0,
  }));
}

async function findAttendanceHistory(studentId, startDate, endDate, limit = 100) {
  const [rows] = await pool.query(
    `SELECT
       a.attendance_id AS attendanceId,
       DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendanceDate,
       at.type_name AS typeName,
       a.attendance_context AS context,
       a.note
     FROM attendance a
     INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE a.student_id = ? AND a.attendance_date BETWEEN ? AND ?
     ORDER BY a.attendance_date DESC
     LIMIT ?`,
    [studentId, startDate, endDate, limit],
  );
  return rows;
}

// Risk counts for one student in a semester window.
async function findRiskCounts(studentId, semesterId, startDate, endDate) {
  const [[row]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM attendance a
         INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
         WHERE a.student_id = ? AND a.attendance_context = 'CLASS'
           AND a.attendance_date BETWEEN ? AND ?
           AND at.type_name IN ('ABSENT_UNEXCUSED','ABSENT_EXCUSED')) AS absences,
       (SELECT COUNT(*) FROM attendance a
         WHERE a.student_id = ? AND a.attendance_context = 'CLASS'
           AND a.attendance_date BETWEEN ? AND ?) AS totalAttendance,
       (SELECT COUNT(*) FROM academic_warning aw
         WHERE aw.student_id = ? AND aw.semester_id = ? AND aw.status <> 'RESOLVED') AS academicWarnings,
       (SELECT COUNT(*) FROM behavior_warning bw
         WHERE bw.student_id = ? AND bw.semester_id = ? AND bw.status <> 'RESOLVED') AS behaviourWarnings,
       (SELECT final_score FROM conduct_evaluation ce
         WHERE ce.student_id = ? AND ce.semester_id = ?) AS conductScore`,
    [
      studentId, startDate, endDate,
      studentId, startDate, endDate,
      studentId, semesterId,
      studentId, semesterId,
      studentId, semesterId,
    ],
  );
  return {
    absences:          Number(row.absences),
    totalAttendance:   Number(row.totalAttendance),
    academicWarnings:  Number(row.academicWarnings),
    behaviourWarnings: Number(row.behaviourWarnings),
    conductScore:      row.conductScore === null ? null : Number(row.conductScore),
  };
}

// Class-wide risk overview (one row per enrolled student).
async function findClassRiskOverview(classId, semesterId, startDate, endDate) {
  const [rows] = await pool.query(
    `SELECT
       s.student_id   AS studentId,
       s.student_code AS studentCode,
       ua.full_name   AS studentName,
       ua.avatar      AS studentAvatar,
       (SELECT COUNT(*) FROM attendance a
         INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
         WHERE a.student_id = s.student_id AND a.attendance_context = 'CLASS'
           AND a.attendance_date BETWEEN ? AND ?
           AND at.type_name IN ('ABSENT_UNEXCUSED','ABSENT_EXCUSED')) AS absences,
       (SELECT COUNT(*) FROM attendance a
         WHERE a.student_id = s.student_id AND a.attendance_context = 'CLASS'
           AND a.attendance_date BETWEEN ? AND ?) AS totalAttendance,
       (SELECT COUNT(*) FROM academic_warning aw
         WHERE aw.student_id = s.student_id AND aw.semester_id = ? AND aw.status <> 'RESOLVED') AS academicWarnings,
       (SELECT COUNT(*) FROM behavior_warning bw
         WHERE bw.student_id = s.student_id AND bw.semester_id = ? AND bw.status <> 'RESOLVED') AS behaviourWarnings,
       (SELECT final_score FROM conduct_evaluation ce
         WHERE ce.student_id = s.student_id AND ce.semester_id = ?) AS conductScore,
       (SELECT COUNT(*) FROM student_goal sg
         WHERE sg.student_id = s.student_id AND sg.status = 'IN_PROGRESS') AS activeGoals
     FROM class_enrollment ce
     INNER JOIN student s ON s.student_id = ce.student_id AND s.status = 'ACTIVE'
     INNER JOIN user_account ua ON ua.user_id = s.user_id AND ua.status = 'ACTIVE'
     WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
     ORDER BY ua.full_name ASC`,
    [startDate, endDate, startDate, endDate, semesterId, semesterId, semesterId, classId],
  );

  return rows.map((r) => ({
    studentId:         r.studentId,
    studentCode:       r.studentCode,
    studentName:       r.studentName,
    studentAvatar:     r.studentAvatar,
    absences:          Number(r.absences),
    totalAttendance:   Number(r.totalAttendance),
    academicWarnings:  Number(r.academicWarnings),
    behaviourWarnings: Number(r.behaviourWarnings),
    conductScore:      r.conductScore === null ? null : Number(r.conductScore),
    activeGoals:       Number(r.activeGoals),
  }));
}

module.exports = {
  isTeacherForClass,
  isTeacherForStudent,
  isHomeroomOfClass,
  isHomeroomOfStudent,
  findTeacherClasses,
  findAllClasses,
  findSemesters,
  findSemesterById,
  find360,
  findAttendanceSummary,
  findMonthlyAttendance,
  findAttendanceHistory,
  findRiskCounts,
  findClassRiskOverview,
};
