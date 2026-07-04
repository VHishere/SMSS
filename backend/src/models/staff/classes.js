const { pool } = require("../../config/db");

async function listClasses(filters = {}) {
  const conditions = ["sc.status = 'ACTIVE'"];
  const params = [];

  if (filters.schoolYearId) {
    conditions.push("sc.school_year_id = ?");
    params.push(filters.schoolYearId);
  }

  if (filters.gradeId) {
    conditions.push("sc.grade_id = ?");
    params.push(filters.gradeId);
  }

  const [rows] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,
        sc.grade_id AS gradeId,
        g.grade_name AS gradeName,
        sc.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        (
          SELECT COUNT(*)
          FROM class_enrollment ce
          WHERE ce.class_id = sc.class_id AND ce.status = 'ACTIVE'
        ) AS studentCount,
        (
          SELECT COUNT(*)
          FROM teacher_class tc
          WHERE tc.class_id = sc.class_id AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
        ) AS teacherCount
      FROM school_class sc
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY g.grade_id, sc.class_name
    `,
    params,
  );

  return rows;
}

async function getClassById(classId) {
  const [classRows] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,
        sc.grade_id AS gradeId,
        g.grade_name AS gradeName,
        sc.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        sc.status
      FROM school_class sc
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      WHERE sc.class_id = ?
      LIMIT 1
    `,
    [classId],
  );

  const classInfo = classRows[0];
  if (!classInfo) return null;

  const [students] = await pool.query(
    `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        ua.full_name AS fullName,
        ce.enrollment_id AS enrollmentId,
        DATE_FORMAT(ce.enrollment_date, '%d/%m/%Y') AS enrollmentDate
      FROM class_enrollment ce
      INNER JOIN student s ON s.student_id = ce.student_id
      INNER JOIN user_account ua ON ua.user_id = s.user_id
      WHERE ce.class_id = ? AND ce.status = 'ACTIVE'
      ORDER BY s.student_code
    `,
    [classId],
  );

  const [teachers] = await pool.query(
    `
      SELECT
        tc.teacher_class_id AS teacherClassId,
        t.teacher_id AS teacherId,
        t.teacher_code AS teacherCode,
        ua.full_name AS fullName,
        tc.role_in_class AS roleInClass,
        sub.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        DATE_FORMAT(tc.assign_date, '%d/%m/%Y') AS assignDate
      FROM teacher_class tc
      INNER JOIN teacher t ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua ON ua.user_id = t.user_id
      LEFT JOIN subject sub ON sub.subject_id = tc.subject_id
      WHERE tc.class_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      ORDER BY tc.role_in_class, ua.full_name
    `,
    [classId],
  );

  return { ...classInfo, students, teachers };
}

async function createClass(data) {
  const [result] = await pool.query(
    `
      INSERT INTO school_class (grade_id, school_year_id, class_name, room_name, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `,
    [data.gradeId, data.schoolYearId, data.className, data.roomName || null],
  );

  return getClassById(result.insertId);
}

async function updateClass(classId, data) {
  const [result] = await pool.query(
    `
      UPDATE school_class
      SET class_name = ?, room_name = ?, grade_id = ?, status = ?
      WHERE class_id = ?
    `,
    [
      data.className,
      data.roomName || null,
      data.gradeId,
      data.status || "ACTIVE",
      classId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy lớp học");
    error.statusCode = 404;
    throw error;
  }

  return getClassById(classId);
}

async function enrollStudent(classId, studentId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE class_enrollment
        SET status = 'INACTIVE'
        WHERE student_id = ? AND status = 'ACTIVE'
      `,
      [studentId],
    );

    await connection.query(
      `
        INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
        VALUES (?, ?, CURDATE(), 'ACTIVE')
        ON DUPLICATE KEY UPDATE status = 'ACTIVE', enrollment_date = CURDATE()
      `,
      [classId, studentId],
    );

    await connection.commit();
    return getClassById(classId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function removeStudent(classId, studentId) {
  await pool.query(
    `
      UPDATE class_enrollment
      SET status = 'INACTIVE'
      WHERE class_id = ? AND student_id = ? AND status = 'ACTIVE'
    `,
    [classId, studentId],
  );

  return getClassById(classId);
}

async function assignTeacher(classId, data) {
  await pool.query(
    `
      INSERT INTO teacher_class (class_id, teacher_id, subject_id, role_in_class, assign_date)
      VALUES (?, ?, ?, ?, CURDATE())
    `,
    [
      classId,
      data.teacherId,
      data.subjectId || null,
      data.roleInClass,
    ],
  );

  return getClassById(classId);
}

async function removeTeacher(teacherClassId) {
  const [rows] = await pool.query(
    "SELECT class_id AS classId FROM teacher_class WHERE teacher_class_id = ?",
    [teacherClassId],
  );

  if (!rows[0]) {
    const error = new Error("Không tìm thấy phân công giáo viên");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    "DELETE FROM teacher_class WHERE teacher_class_id = ?",
    [teacherClassId],
  );

  return getClassById(rows[0].classId);
}

async function listClassTimetable(classId) {
  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        tt.class_id AS classId,
        sc.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        tt.day_of_week AS dayOfWeek,
        tt.period_no AS periodNo,
        COALESCE(tt.room_name, sc.room_name) AS roomName,
        tt.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        sub.subject_code AS subjectCode,
        tt.teacher_id AS teacherId,
        t.teacher_code AS teacherCode,
        ua.full_name AS teacherName,
        tt.status
      FROM timetable tt
      INNER JOIN school_class sc ON sc.class_id = tt.class_id
      INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      INNER JOIN subject sub ON sub.subject_id = tt.subject_id
      INNER JOIN teacher t ON t.teacher_id = tt.teacher_id
      INNER JOIN user_account ua ON ua.user_id = t.user_id
      WHERE tt.class_id = ?
        AND tt.status = 'ACTIVE'
      ORDER BY tt.day_of_week, tt.period_no
    `,
    [classId],
  );

  return rows;
}

async function assertClassExists(classId) {
  const [rows] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.school_year_id AS schoolYearId
      FROM school_class sc
      WHERE sc.class_id = ?
        AND sc.status = 'ACTIVE'
      LIMIT 1
    `,
    [classId],
  );

  if (!rows[0]) {
    const error = new Error("KhÃ´ng tÃ¬m tháº¥y lá»›p há»c");
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function validateTimetableAssignment(classId, data) {
  if (!data.dayOfWeek || !data.periodNo || !data.subjectId || !data.teacherId) {
    const error = new Error("Vui lÃ²ng chá»n thá»©, tiáº¿t, mÃ´n há»c vÃ  giÃ¡o viÃªn");
    error.statusCode = 400;
    throw error;
  }

  const dayOfWeek = Number(data.dayOfWeek);
  const periodNo = Number(data.periodNo);
  const subjectId = Number(data.subjectId);
  const teacherId = Number(data.teacherId);

  if (dayOfWeek < 2 || dayOfWeek > 7 || periodNo < 1 || periodNo > 8) {
    const error = new Error("Thá»© hoáº·c tiáº¿t há»c khÃ´ng há»£p lá»‡");
    error.statusCode = 400;
    throw error;
  }

  const [assignments] = await pool.query(
    `
      SELECT 1 AS ok
      FROM teacher_class
      WHERE class_id = ?
        AND teacher_id = ?
        AND (subject_id = ? OR role_in_class = 'HOMEROOM_TEACHER')
        AND (end_date IS NULL OR end_date >= CURDATE())
      LIMIT 1
    `,
    [classId, teacherId, subjectId],
  );

  if (!assignments[0]) {
    const error = new Error("GiÃ¡o viÃªn chÆ°a Ä‘Æ°á»£c phÃ¢n cÃ´ng cho mÃ´n/lá»›p nÃ y");
    error.statusCode = 400;
    throw error;
  }

  return {
    dayOfWeek,
    periodNo,
    subjectId,
    teacherId,
    roomName: data.roomName || null,
  };
}

async function createClassTimetableLesson(classId, data) {
  await assertClassExists(classId);
  const lesson = await validateTimetableAssignment(classId, data);

  const [occupied] = await pool.query(
    `
      SELECT timetable_id AS timetableId
      FROM timetable
      WHERE class_id = ?
        AND day_of_week = ?
        AND period_no = ?
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [classId, lesson.dayOfWeek, lesson.periodNo],
  );

  if (occupied[0]) {
    const error = new Error("Tiáº¿t nÃ y Ä‘Ã£ cÃ³ lá»‹ch há»c");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.query(
    `
      INSERT INTO timetable (
        class_id, subject_id, teacher_id,
        day_of_week, period_no, room_name, status
      )
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `,
    [
      classId,
      lesson.subjectId,
      lesson.teacherId,
      lesson.dayOfWeek,
      lesson.periodNo,
      lesson.roomName,
    ],
  );

  return result.insertId;
}

async function updateClassTimetableLesson(classId, timetableId, data) {
  await assertClassExists(classId);
  const lesson = await validateTimetableAssignment(classId, data);

  const [occupied] = await pool.query(
    `
      SELECT timetable_id AS timetableId
      FROM timetable
      WHERE class_id = ?
        AND day_of_week = ?
        AND period_no = ?
        AND status = 'ACTIVE'
        AND timetable_id <> ?
      LIMIT 1
    `,
    [classId, lesson.dayOfWeek, lesson.periodNo, timetableId],
  );

  if (occupied[0]) {
    const error = new Error("Tiáº¿t nÃ y Ä‘Ã£ cÃ³ lá»‹ch há»c");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.query(
    `
      UPDATE timetable
      SET subject_id = ?,
          teacher_id = ?,
          day_of_week = ?,
          period_no = ?,
          room_name = ?,
          status = 'ACTIVE'
      WHERE timetable_id = ?
        AND class_id = ?
    `,
    [
      lesson.subjectId,
      lesson.teacherId,
      lesson.dayOfWeek,
      lesson.periodNo,
      lesson.roomName,
      timetableId,
      classId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("KhÃ´ng tÃ¬m tháº¥y tiáº¿t há»c");
    error.statusCode = 404;
    throw error;
  }
}

async function deleteClassTimetableLesson(classId, timetableId) {
  const [result] = await pool.query(
    `
      UPDATE timetable
      SET status = 'INACTIVE'
      WHERE timetable_id = ?
        AND class_id = ?
    `,
    [timetableId, classId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("KhÃ´ng tÃ¬m tháº¥y tiáº¿t há»c");
    error.statusCode = 404;
    throw error;
  }
}

async function listStaffActivities(filters = {}) {
  const conditions = ["e.status <> 'ARCHIVED'"];
  const params = [];

  if (filters.schoolYearId) {
    conditions.push("(sc.school_year_id = ? OR e.class_id IS NULL)");
    params.push(filters.schoolYearId);
  }

  if (filters.gradeId) {
    conditions.push("(sc.grade_id = ? OR e.class_id IS NULL)");
    params.push(filters.gradeId);
  }

  if (filters.classId) {
    conditions.push("(e.class_id = ? OR e.class_id IS NULL)");
    params.push(filters.classId);
  }

  const [rows] = await pool.query(
    `
      SELECT
        e.event_id AS eventId,
        e.title,
        e.event_type AS eventType,
        e.category,
        e.class_id AS classId,
        sc.class_name AS className,
        sc.grade_id AS gradeId,
        g.grade_name AS gradeName,
        sc.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        e.description,
        DATE_FORMAT(e.start_date, '%Y-%m-%dT%H:%i') AS startDate,
        DATE_FORMAT(e.end_date, '%Y-%m-%dT%H:%i') AS endDate,
        e.location,
        e.organizer,
        e.status
      FROM event e
      LEFT JOIN school_class sc ON sc.class_id = e.class_id
      LEFT JOIN grade g ON g.grade_id = sc.grade_id
      LEFT JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      WHERE ${conditions.join(" AND ")}
        AND (e.category = 'EXTRACURRICULAR' OR e.event_type = 'EXTRACURRICULAR')
      ORDER BY e.start_date DESC, e.event_id DESC
      LIMIT 100
    `,
    params,
  );

  return rows;
}

async function findActivityTargetClasses(data) {
  const conditions = ["sc.status = 'ACTIVE'"];
  const params = [];

  if (data.scope === "SCHOOL") {
    if (!data.schoolYearId) {
      const error = new Error("Vui lòng chọn năm học");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    params.push(data.schoolYearId);
  }

  if (data.scope === "CLASS") {
    if (!data.classId) {
      const error = new Error("Vui lòng chọn lớp");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.class_id = ?");
    params.push(data.classId);
  }

  if (data.scope === "GRADE") {
    if (!data.schoolYearId || !data.gradeId) {
      const error = new Error("Vui lòng chọn năm học và khối");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    conditions.push("sc.grade_id = ?");
    params.push(data.schoolYearId, data.gradeId);
  }

  const [rows] = await pool.query(
    `
      SELECT sc.class_id AS classId
      FROM school_class sc
      WHERE ${conditions.join(" AND ")}
      ORDER BY sc.class_id
    `,
    params,
  );

  if (rows.length === 0) {
    const error = new Error("Không tìm thấy lớp phù hợp");
    error.statusCode = 404;
    throw error;
  }

  return rows;
}

function normalizeDateTime(value) {
  if (!value) return null;
  return String(value).replace("T", " ");
}

async function createStaffActivity(data, createdBy) {
  const scope = data.scope || "CLASS";

  if (!["CLASS", "GRADE", "SCHOOL"].includes(scope)) {
    const error = new Error("Phạm vi hoạt động không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  if (!data.title || !data.startDate) {
    const error = new Error("Vui lòng nhập tên hoạt động và thời gian bắt đầu");
    error.statusCode = 400;
    throw error;
  }

  const targets = await findActivityTargetClasses({ ...data, scope });

  const values = targets.map((target) => [
    data.title.trim(),
    "EXTRACURRICULAR",
    "EXTRACURRICULAR",
    target.classId,
    data.description || null,
    normalizeDateTime(data.startDate),
    normalizeDateTime(data.endDate),
    data.location || null,
    data.organizer || "Staff",
    data.capacity ? Number(data.capacity) : null,
    createdBy,
  ]);

  const [result] = await pool.query(
    `
      INSERT INTO event (
        title, event_type, category, class_id, description,
        start_date, end_date, location, organizer, capacity, created_by, status
      )
      VALUES ?
    `,
    [values.map((item) => [...item, "ACTIVE"])],
  );

  return {
    createdCount: result.affectedRows,
    scope,
  };
}

async function deleteStaffActivity(eventId) {
  const [result] = await pool.query(
    `
      UPDATE event
      SET status = 'ARCHIVED'
      WHERE event_id = ?
        AND (category = 'EXTRACURRICULAR' OR event_type = 'EXTRACURRICULAR')
    `,
    [eventId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy hoạt động ngoại khóa");
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  listClasses,
  getClassById,
  createClass,
  updateClass,
  enrollStudent,
  removeStudent,
  assignTeacher,
  removeTeacher,
  listClassTimetable,
  createClassTimetableLesson,
  updateClassTimetableLesson,
  deleteClassTimetableLesson,
  listStaffActivities,
  createStaffActivity,
  deleteStaffActivity,
};
