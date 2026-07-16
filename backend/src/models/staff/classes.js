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

async function findAssignedSubjectTeacher(classId, subjectId) {
  const [rows] = await pool.query(
    `
      SELECT teacher_id AS teacherId
      FROM teacher_class
      WHERE class_id = ?
        AND subject_id = ?
        AND (end_date IS NULL OR end_date >= CURDATE())
      ORDER BY start_date DESC, teacher_class_id DESC
      LIMIT 1
    `,
    [classId, subjectId],
  );

  return rows[0]?.teacherId || null;
}

async function findTimetableTargetClasses(data) {
  const scope = data.scope || "CLASS";
  const conditions = ["sc.status = 'ACTIVE'"];
  const params = [];

  if (scope === "CLASS") {
    if (!data.classId) {
      const error = new Error("Vui lòng chọn lớp");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.class_id = ?");
    params.push(data.classId);
  } else if (scope === "GRADE") {
    if (!data.schoolYearId || !data.gradeId) {
      const error = new Error("Vui lòng chọn năm học và khối");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    conditions.push("sc.grade_id = ?");
    params.push(data.schoolYearId, data.gradeId);
  } else if (scope === "SCHOOL") {
    if (!data.schoolYearId) {
      const error = new Error("Vui lòng chọn năm học");
      error.statusCode = 400;
      throw error;
    }
    conditions.push("sc.school_year_id = ?");
    params.push(data.schoolYearId);
  } else {
    const error = new Error("Phạm vi thêm lịch không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  const [rows] = await pool.query(
    `
      SELECT
        sc.class_id AS classId,
        sc.class_name AS className,
        sc.room_name AS roomName,
        sc.school_year_id AS schoolYearId,
        sc.grade_id AS gradeId
      FROM school_class sc
      WHERE ${conditions.join(" AND ")}
      ORDER BY sc.class_name
    `,
    params,
  );

  if (rows.length === 0) {
    const error = new Error("Không tìm thấy lớp phù hợp để thêm lịch");
    error.statusCode = 404;
    throw error;
  }

  return rows;
}

async function createTimetableLessons(data) {
  const dayOfWeek = Number(data.dayOfWeek);
  const periodNo = Number(data.periodNo);
  const subjectId = Number(data.subjectId);
  const teacherMode = data.teacherMode || "SELECTED_TEACHER";

  if (!dayOfWeek || !periodNo || !subjectId) {
    const error = new Error("Vui lòng chọn thứ, tiết và môn học");
    error.statusCode = 400;
    throw error;
  }

  if (dayOfWeek < 2 || dayOfWeek > 7 || periodNo < 1 || periodNo > 8) {
    const error = new Error("Thứ hoặc tiết học không hợp lệ");
    error.statusCode = 400;
    throw error;
  }

  if (teacherMode !== "ASSIGNED_TEACHER" && !data.teacherId) {
    const error = new Error("Vui lòng chọn giáo viên");
    error.statusCode = 400;
    throw error;
  }

  const targetClasses = await findTimetableTargetClasses(data);
  const plannedLessons = [];
  const conflicts = [];
  const plannedTeacherSlots = new Map();

  for (const classItem of targetClasses) {
    const classId = classItem.classId;
    const teacherId =
      teacherMode === "ASSIGNED_TEACHER"
        ? await findAssignedSubjectTeacher(classId, subjectId)
        : Number(data.teacherId);

    if (!teacherId) {
      conflicts.push({
        classId,
        className: classItem.className,
        reason: "Lớp chưa được phân công giáo viên cho môn học này",
      });
      continue;
    }

    const [classSlot] = await pool.query(
      `
        SELECT tt.timetable_id AS timetableId, sub.subject_name AS subjectName
        FROM timetable tt
        INNER JOIN subject sub ON sub.subject_id = tt.subject_id
        WHERE tt.class_id = ?
          AND tt.day_of_week = ?
          AND tt.period_no = ?
          AND tt.status = 'ACTIVE'
        LIMIT 1
      `,
      [classId, dayOfWeek, periodNo],
    );

    if (classSlot[0]) {
      conflicts.push({
        classId,
        className: classItem.className,
        reason: `Lớp đã có tiết ${classSlot[0].subjectName} ở ô này`,
      });
      continue;
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
      conflicts.push({
        classId,
        className: classItem.className,
        reason: "Giáo viên chưa được phân công cho môn/lớp này",
      });
      continue;
    }

    const [teacherSlot] = await pool.query(
      `
        SELECT sc.class_name AS className
        FROM timetable tt
        INNER JOIN school_class sc ON sc.class_id = tt.class_id
        WHERE tt.teacher_id = ?
          AND tt.day_of_week = ?
          AND tt.period_no = ?
          AND tt.status = 'ACTIVE'
          AND sc.school_year_id = ?
        LIMIT 1
      `,
      [teacherId, dayOfWeek, periodNo, classItem.schoolYearId],
    );

    const teacherSlotKey = `${teacherId}-${dayOfWeek}-${periodNo}`;

    if (teacherSlot[0]) {
      conflicts.push({
        classId,
        className: classItem.className,
        reason: `Giáo viên đã có tiết ở lớp ${teacherSlot[0].className}`,
      });
      continue;
    }

    if (plannedTeacherSlots.has(teacherSlotKey)) {
      conflicts.push({
        classId,
        className: classItem.className,
        reason: `Giáo viên đã được xếp cùng tiết cho lớp ${plannedTeacherSlots.get(teacherSlotKey)}`,
      });
      continue;
    }

    plannedTeacherSlots.set(teacherSlotKey, classItem.className);
    plannedLessons.push({
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      periodNo,
      roomName: data.roomName || classItem.roomName || null,
    });
  }

  if (conflicts.length) {
    const error = new Error("Lịch học bị trùng hoặc chưa đủ phân công");
    error.statusCode = 409;
    error.details = conflicts;
    throw error;
  }

  if (!plannedLessons.length) {
    const error = new Error("Không có lớp nào đủ điều kiện để thêm lịch");
    error.statusCode = 400;
    throw error;
  }

  await pool.query(
    `
      INSERT INTO timetable (
        class_id, subject_id, teacher_id,
        day_of_week, period_no, room_name, status
      )
      VALUES ?
    `,
    [
      plannedLessons.map((lesson) => [
        lesson.classId,
        lesson.subjectId,
        lesson.teacherId,
        lesson.dayOfWeek,
        lesson.periodNo,
        lesson.roomName,
        "ACTIVE",
      ]),
    ],
  );

  return {
    createdCount: plannedLessons.length,
    scope: data.scope || "CLASS",
    classIds: plannedLessons.map((lesson) => lesson.classId),
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
  createTimetableLessons,
  createClassTimetableLesson,
  updateClassTimetableLesson,
  deleteClassTimetableLesson,
};
