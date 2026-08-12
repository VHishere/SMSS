const { pool } = require("../../config/db");
const {
  assertExists,
  assertUnique,
  cleanText,
  createHttpError,
  optionalText,
  requireText,
  validateDate,
  validateEnum,
  validatePositiveInt,
} = require("./validation");

const CLASS_STATUSES = ["ACTIVE", "INACTIVE"];
const TEACHER_CLASS_ROLES = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER"];

function normalizeClassName(value) {
  return requireText(value, "tên lớp", 50).replace(/\s+/g, " ").toUpperCase();
}

async function validateClassPayload(connection, data, classId = null) {
  const className = normalizeClassName(data.className);
  const roomName = optionalText(data.roomName, "phòng học", 50);
  const gradeId = validatePositiveInt(data.gradeId, "khối");
  const schoolYearId = validatePositiveInt(data.schoolYearId, "năm học");
  const status = validateEnum(
    data.status,
    CLASS_STATUSES,
    "trạng thái lớp",
    "ACTIVE",
  );

  await assertExists(
    connection,
    "SELECT grade_id FROM grade WHERE grade_id = ? AND status = 'ACTIVE' LIMIT 1",
    [gradeId],
    "Không tìm thấy khối đang hoạt động",
  );
  await assertExists(
    connection,
    "SELECT school_year_id FROM school_year WHERE school_year_id = ? LIMIT 1",
    [schoolYearId],
    "Không tìm thấy năm học",
  );
  await assertUnique(
    connection,
    `SELECT class_id
     FROM school_class
     WHERE school_year_id = ?
       AND status = 'ACTIVE'
       AND LOWER(TRIM(class_name)) = LOWER(TRIM(?))
       AND (? IS NULL OR class_id <> ?)
     LIMIT 1`,
    [schoolYearId, className, classId, classId],
    "Lớp học đã tồn tại trong năm học này",
  );

  return { className, gradeId, roomName, schoolYearId, status };
}

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
        ) AS teacherCount,
        (
          SELECT COUNT(*)
          FROM timetable tt
          WHERE tt.class_id = sc.class_id AND tt.status = 'ACTIVE'
        ) AS timetableCount
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
        t.subject_specialize AS subjectSpecialize,
        ua.full_name AS fullName,
        tc.role_in_class AS roleInClass,
        sub.subject_id AS subjectId,
        COALESCE(sub.subject_name, specialize_subject.subject_name, t.subject_specialize) AS subjectName,
        DATE_FORMAT(tc.assign_date, '%d/%m/%Y') AS assignDate
      FROM teacher_class tc
      INNER JOIN teacher t ON t.teacher_id = tc.teacher_id
      INNER JOIN user_account ua ON ua.user_id = t.user_id
      LEFT JOIN subject sub ON sub.subject_id = tc.subject_id
      LEFT JOIN subject specialize_subject
        ON (
          LOWER(specialize_subject.subject_name) = LOWER(t.subject_specialize)
          OR LOWER(specialize_subject.subject_code) = LOWER(t.subject_specialize)
          OR LOWER(specialize_subject.subject_name) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(specialize_subject.subject_name), '%')
        )
        AND specialize_subject.status = 'ACTIVE'
      WHERE tc.class_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      ORDER BY tc.role_in_class, ua.full_name
    `,
    [classId],
  );

  return { ...classInfo, students, teachers };
}

async function createClass(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const payload = await validateClassPayload(connection, data);

    const [result] = await connection.query(
      `
        INSERT INTO school_class (grade_id, school_year_id, class_name, room_name, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        payload.gradeId,
        payload.schoolYearId,
        payload.className,
        payload.roomName,
        payload.status,
      ],
    );

    await connection.commit();
    return getClassById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateClass(classId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const current = await assertExists(
      connection,
      "SELECT school_year_id AS schoolYearId FROM school_class WHERE class_id = ? LIMIT 1",
      [classId],
      "Không tìm thấy lớp học",
    );
    const payload = await validateClassPayload(
      connection,
      { ...data, schoolYearId: data.schoolYearId || current.schoolYearId },
      classId,
    );

    const [result] = await connection.query(
    `
      UPDATE school_class
      SET class_name = ?, room_name = ?, grade_id = ?, school_year_id = ?, status = ?
      WHERE class_id = ?
    `,
    [
      payload.className,
      payload.roomName,
      payload.gradeId,
      payload.schoolYearId,
      payload.status,
      classId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy lớp học");
    error.statusCode = 404;
    throw error;
  }

    await connection.commit();
    return getClassById(classId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteClass(classId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalizedClassId = validatePositiveInt(classId, "lớp học");

    await assertExists(
      connection,
      "SELECT class_id FROM school_class WHERE class_id = ? AND status = 'ACTIVE' LIMIT 1",
      [normalizedClassId],
      "Không tìm thấy lớp học đang hoạt động",
    );

    const [[students]] = await connection.query(
      "SELECT COUNT(*) AS total FROM class_enrollment WHERE class_id = ? AND status = 'ACTIVE'",
      [normalizedClassId],
    );
    const [[teachers]] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM teacher_class
       WHERE class_id = ? AND (end_date IS NULL OR end_date >= CURDATE())`,
      [normalizedClassId],
    );
    const [[timetables]] = await connection.query(
      "SELECT COUNT(*) AS total FROM timetable WHERE class_id = ? AND status = 'ACTIVE'",
      [normalizedClassId],
    );

    if (Number(students.total) > 0 || Number(teachers.total) > 0) {
      throw createHttpError(
        "Chỉ được xóa lớp sau khi đã gỡ hết học sinh và giáo viên",
        409,
      );
    }

    if (Number(timetables.total) > 0) {
      throw createHttpError(
        "Chỉ được xóa lớp sau khi đã xóa hết lịch học của lớp",
        409,
      );
    }

    await connection.query(
      "UPDATE school_class SET status = 'INACTIVE' WHERE class_id = ?",
      [normalizedClassId],
    );

    await connection.commit();
    return { classId: normalizedClassId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function enrollStudent(classId, studentId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const normalizedClassId = validatePositiveInt(classId, "lớp học");
    const normalizedStudentId = validatePositiveInt(studentId, "học sinh");

    await assertExists(
      connection,
      "SELECT class_id FROM school_class WHERE class_id = ? AND status = 'ACTIVE' LIMIT 1",
      [normalizedClassId],
      "Không tìm thấy lớp học đang hoạt động",
    );
    await assertExists(
      connection,
      "SELECT student_id FROM student WHERE student_id = ? AND status = 'ACTIVE' LIMIT 1",
      [normalizedStudentId],
      "Không tìm thấy học sinh đang hoạt động",
    );

    await connection.query(
      `
        UPDATE class_enrollment
        SET status = 'INACTIVE'
        WHERE student_id = ? AND status = 'ACTIVE'
      `,
      [normalizedStudentId],
    );

    await connection.query(
      `
        INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
        VALUES (?, ?, CURDATE(), 'ACTIVE')
        ON DUPLICATE KEY UPDATE status = 'ACTIVE', enrollment_date = CURDATE()
      `,
      [normalizedClassId, normalizedStudentId],
    );

    await connection.commit();
    return getClassById(normalizedClassId);
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
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const normalizedClassId = validatePositiveInt(classId, "lớp học");
    const teacherId = validatePositiveInt(data.teacherId, "giáo viên");
    const roleInClass = validateEnum(
      data.roleInClass,
      TEACHER_CLASS_ROLES,
      "vai trò giáo viên",
      "SUBJECT_TEACHER",
    );
    const subjectId = cleanText(data.subjectId)
      ? validatePositiveInt(data.subjectId, "môn học")
      : null;

    await assertExists(
      conn,
      "SELECT class_id FROM school_class WHERE class_id = ? AND status = 'ACTIVE' LIMIT 1",
      [normalizedClassId],
      "Không tìm thấy lớp học đang hoạt động",
    );
    await assertExists(
      conn,
      `SELECT t.teacher_id
       FROM teacher t
       INNER JOIN user_account ua ON ua.user_id = t.user_id
       WHERE t.teacher_id = ? AND ua.status = 'ACTIVE'
       LIMIT 1`,
      [teacherId],
      "Không tìm thấy giáo viên đang hoạt động",
    );

    if (roleInClass === "SUBJECT_TEACHER" && !subjectId) {
      throw createHttpError("Vui lòng chọn môn học cho giáo viên bộ môn");
    }

    if (subjectId) {
      await assertExists(
        conn,
        "SELECT subject_id FROM subject WHERE subject_id = ? AND status = 'ACTIVE' LIMIT 1",
        [subjectId],
        "Không tìm thấy môn học đang hoạt động",
      );
    }

    if (subjectId) {
      const canTeachSubject = await teacherCanTeachSubject(teacherId, subjectId);
      if (!canTeachSubject) {
        throw createHttpError("Giáo viên không đúng chuyên môn của môn học này");
      }
    }

    if (roleInClass === "HOMEROOM_TEACHER") {
      await assertUnique(
        conn,
        `SELECT teacher_class_id
         FROM teacher_class
         WHERE class_id = ?
           AND role_in_class = 'HOMEROOM_TEACHER'
           AND (end_date IS NULL OR end_date >= CURDATE())
         LIMIT 1`,
        [normalizedClassId],
        "Lớp này đã có giáo viên chủ nhiệm",
      );
    }

    await assertUnique(
      conn,
      `SELECT teacher_class_id
       FROM teacher_class
       WHERE class_id = ?
         AND teacher_id = ?
         AND role_in_class = ?
         AND (subject_id <=> ?)
         AND (end_date IS NULL OR end_date >= CURDATE())
       LIMIT 1`,
      [normalizedClassId, teacherId, roleInClass, subjectId],
      "Phân công giáo viên đã tồn tại",
    );

    await conn.query(
      `
        INSERT INTO teacher_class (class_id, teacher_id, subject_id, role_in_class, assign_date)
        VALUES (?, ?, ?, ?, CURDATE())
      `,
      [normalizedClassId, teacherId, subjectId, roleInClass],
    );

    // Đồng bộ role toàn cục (user_role) theo phân công — CHỈ THÊM, không gỡ —
    // để nav/routing khớp teacher_class (nguồn chân lý). role_id: 3=HOMEROOM, 4=SUBJECT.
    const [[teacher]] = await conn.query(
      "SELECT user_id AS userId FROM teacher WHERE teacher_id = ?",
      [teacherId],
    );
    if (teacher) {
      const roleId = roleInClass === "HOMEROOM_TEACHER" ? 3 : 4;
      await conn.query(
        `INSERT INTO user_role (user_id, role_id)
         SELECT ?, ? FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM user_role WHERE user_id = ? AND role_id = ?
         )`,
        [teacher.userId, roleId, teacher.userId, roleId],
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

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

function mysqlDayOfWeek(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  return day === 0 ? 8 : day + 1;
}

function addIsoDays(isoDate, amount) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function buildTimetableLessonDates(data, dayOfWeek) {
  const lessonDate = validateDate(data.lessonDate, "ngày học", {
    required: true,
    minYear: 2000,
  });

  if (data.scheduleMode !== "SCHOOL_YEAR") {
    return [lessonDate];
  }

  const [rows] = await pool.query(
    `
      SELECT DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate
      FROM school_year
      WHERE school_year_id = ?
      LIMIT 1
    `,
    [data.schoolYearId],
  );
  const endDate = rows[0]?.endDate;
  if (!endDate) return [lessonDate];

  const dates = [];
  for (let current = lessonDate; current <= endDate; current = addIsoDays(current, 7)) {
    if (mysqlDayOfWeek(current) === dayOfWeek) {
      dates.push(current);
    }
  }

  return dates.length ? dates : [lessonDate];
}

async function listClassTimetable(classId, filters = {}) {
  const params = [classId];
  const conditions = ["tt.class_id = ?", "tt.status = 'ACTIVE'"];

  if (filters.startDate && filters.endDate) {
    const startDate = validateDate(filters.startDate, "ngày bắt đầu", {
      required: true,
      minYear: 2000,
    });
    const endDate = validateDate(filters.endDate, "ngày kết thúc", {
      required: true,
      minYear: 2000,
    });
    conditions.push("tt.lesson_date BETWEEN ? AND ?");
    params.push(startDate, endDate);
  } else if (filters.lessonDate) {
    const lessonDate = validateDate(filters.lessonDate, "ngày học", {
      required: true,
      minYear: 2000,
    });
    conditions.push("tt.lesson_date = ?");
    params.push(lessonDate);
  }

  const [rows] = await pool.query(
    `
      SELECT
        tt.timetable_id AS timetableId,
        tt.class_id AS classId,
        sc.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        DATE_FORMAT(tt.lesson_date, '%Y-%m-%d') AS lessonDate,
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
      WHERE ${conditions.join(" AND ")}
      ORDER BY tt.lesson_date, tt.day_of_week, tt.period_no
    `,
    params,
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
    const error = new Error("Không tìm thấy lớp học");
    error.statusCode = 404;
    throw error;
  }

  return rows[0];
}

async function validateTimetableAssignment(classId, data) {
  if (!data.lessonDate || !data.periodNo || !data.subjectId || !data.teacherId) {
    const error = new Error("Vui lòng chọn ngày, tiết, môn học và giáo viên");
    error.statusCode = 400;
    throw error;
  }

  const lessonDate = validateDate(data.lessonDate, "ngày học", {
    required: true,
    minYear: 2000,
  });
  const dayOfWeek = mysqlDayOfWeek(lessonDate);
  const periodNo = Number(data.periodNo);
  const subjectId = Number(data.subjectId);
  const teacherId = Number(data.teacherId);

  if (dayOfWeek < 2 || dayOfWeek > 7 || periodNo < 1 || periodNo > 8) {
    const error = new Error("Ngày hoặc tiết học không hợp lệ");
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
    const error = new Error("Giáo viên chưa được phân công cho môn/lớp này");
    error.statusCode = 400;
    throw error;
  }

  return {
    lessonDate,
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

async function teacherCanTeachSubject(teacherId, subjectId) {
  const [rows] = await pool.query(
    `
      SELECT 1 AS ok
      FROM teacher t
      INNER JOIN subject sub ON sub.subject_id = ?
      WHERE t.teacher_id = ?
        AND (
          EXISTS (
            SELECT 1
            FROM teacher_class tc
            WHERE tc.teacher_id = t.teacher_id
              AND tc.subject_id = sub.subject_id
              AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
          )
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sub.subject_name))
          OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sub.subject_code))
          OR LOWER(TRIM(sub.subject_name)) LIKE CONCAT('%', LOWER(TRIM(t.subject_specialize)), '%')
          OR LOWER(TRIM(t.subject_specialize)) LIKE CONCAT('%', LOWER(TRIM(sub.subject_name)), '%')
        )
      LIMIT 1
    `,
    [subjectId, teacherId],
  );

  return Boolean(rows[0]);
}

function normalizeTimetableConflictReason(reason) {
  const text = String(reason || "");

  if (
    text.includes("phÃ¢n cÃ´ng giÃ¡o viÃªn") ||
    text.includes("phân công giáo viên")
  ) {
    return "Lớp chưa được phân công giáo viên cho môn học này";
  }

  if (text.includes("không đúng chuyên môn")) {
    return "Giáo viên không đúng chuyên môn của môn học này";
  }

  if (text.includes("cÃ³ ti") || text.includes("có tiết")) {
    return "Lớp đã có tiết học ở ô này";
  }

  if (text.includes("chÆ°a") || text.includes("chưa")) {
    return "Giáo viên chưa được phân công cho môn/lớp này";
  }

  if (text.includes("cÃ¹ng ti") || text.includes("cùng tiết")) {
    return "Giáo viên đã được xếp cùng tiết cho lớp khác";
  }

  if (text.includes("GiÃ¡o viÃªn") || text.includes("Giáo viên")) {
    return "Giáo viên đã có tiết ở lớp khác trong cùng thời điểm";
  }

  return "Không thể thêm lịch cho lớp này";
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
  const lessonDate = validateDate(data.lessonDate, "ngày học", {
    required: true,
    minYear: 2000,
  });
  const dayOfWeek = mysqlDayOfWeek(lessonDate);
  const lessonDates = await buildTimetableLessonDates(data, dayOfWeek);
  const periodNo = Number(data.periodNo);
  const subjectId = Number(data.subjectId);
  const teacherMode = data.teacherMode || "SELECTED_TEACHER";

  if (!periodNo || !subjectId) {
    throw createHttpError("Vui lòng chọn ngày, tiết và môn học");
  }

  if (dayOfWeek < 2 || dayOfWeek > 7 || periodNo < 1 || periodNo > 8) {
    throw createHttpError("Ngày hoặc tiết học không hợp lệ");
  }

  if (teacherMode !== "ASSIGNED_TEACHER" && !data.teacherId) {
    throw createHttpError("Vui lòng chọn giáo viên");
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
      if (
        teacherMode === "SELECTED_TEACHER" &&
        await teacherCanTeachSubject(teacherId, subjectId)
      ) {
        // Giáo viên đúng chuyên môn nhưng chưa được phân công lớp: cho phép staff xếp lịch thủ công.
      } else {
        conflicts.push({
          classId,
          className: classItem.className,
          reason: "Giáo viên chưa được phân công cho môn/lớp này",
        });
        continue;
      }
    }

    for (const currentLessonDate of lessonDates) {
      const [classSlot] = await pool.query(
        `
          SELECT tt.timetable_id AS timetableId, sub.subject_name AS subjectName
          FROM timetable tt
          INNER JOIN subject sub ON sub.subject_id = tt.subject_id
          WHERE tt.class_id = ?
            AND tt.lesson_date = ?
            AND tt.period_no = ?
            AND tt.status = 'ACTIVE'
          LIMIT 1
        `,
        [classId, currentLessonDate, periodNo],
      );

      if (classSlot[0]) {
        conflicts.push({
          classId,
          className: classItem.className,
          reason: `Lớp đã có tiết ${classSlot[0].subjectName} ngày ${currentLessonDate}`,
        });
        continue;
      }

      const [teacherSlot] = await pool.query(
        `
          SELECT sc.class_name AS className
          FROM timetable tt
          INNER JOIN school_class sc ON sc.class_id = tt.class_id
          WHERE tt.teacher_id = ?
            AND tt.lesson_date = ?
            AND tt.period_no = ?
            AND tt.status = 'ACTIVE'
            AND sc.school_year_id = ?
          LIMIT 1
        `,
        [teacherId, currentLessonDate, periodNo, classItem.schoolYearId],
      );

      const teacherSlotKey = `${teacherId}-${currentLessonDate}-${periodNo}`;

      if (teacherSlot[0]) {
        conflicts.push({
          classId,
          className: classItem.className,
          reason: `Giáo viên đã có tiết ở lớp ${teacherSlot[0].className} ngày ${currentLessonDate}`,
        });
        continue;
      }

      if (plannedTeacherSlots.has(teacherSlotKey)) {
        conflicts.push({
          classId,
          className: classItem.className,
          reason: `Giáo viên đã được xếp cùng tiết cho lớp ${plannedTeacherSlots.get(teacherSlotKey)} ngày ${currentLessonDate}`,
        });
        continue;
      }

      plannedTeacherSlots.set(teacherSlotKey, classItem.className);
      plannedLessons.push({
        classId,
        subjectId,
        teacherId,
        lessonDate: currentLessonDate,
        dayOfWeek,
        periodNo,
        roomName: data.roomName || classItem.roomName || null,
      });
    }
  }

  if (conflicts.length) {
    const error = createHttpError(
      "Lịch học bị trùng hoặc chưa đủ phân công",
      409,
    );
    error.details = conflicts;
    throw error;
  }

  if (!plannedLessons.length) {
    throw createHttpError("Không có lớp nào đủ điều kiện để thêm lịch");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO timetable (
          class_id, subject_id, teacher_id,
          lesson_date, day_of_week, period_no, room_name, status
        )
        VALUES ?
      `,
      [
        plannedLessons.map((lesson) => [
          lesson.classId,
          lesson.subjectId,
          lesson.teacherId,
          lesson.lessonDate,
          lesson.dayOfWeek,
          lesson.periodNo,
          lesson.roomName,
          "ACTIVE",
        ]),
      ],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return {
    createdCount: plannedLessons.length,
    scheduleMode: data.scheduleMode || "SINGLE_DAY",
    scope: data.scope || "CLASS",
    classIds: [...new Set(plannedLessons.map((lesson) => lesson.classId))],
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
        AND lesson_date = ?
        AND period_no = ?
        AND status = 'ACTIVE'
      LIMIT 1
    `,
    [classId, lesson.dayOfWeek, lesson.lessonDate, lesson.periodNo],
  );

  if (occupied[0]) {
    const error = new Error("Tiết này đã có lịch học");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.query(
    `
      INSERT INTO timetable (
        class_id, subject_id, teacher_id,
        lesson_date, day_of_week, period_no, room_name, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `,
    [
      classId,
      lesson.subjectId,
      lesson.teacherId,
      lesson.lessonDate,
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
        AND lesson_date = ?
        AND period_no = ?
        AND status = 'ACTIVE'
        AND timetable_id <> ?
      LIMIT 1
    `,
    [classId, lesson.dayOfWeek, lesson.lessonDate, lesson.periodNo, timetableId],
  );

  if (occupied[0]) {
    const error = new Error("Tiết này đã có lịch học");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.query(
    `
      UPDATE timetable
      SET subject_id = ?,
          teacher_id = ?,
          lesson_date = ?,
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
      lesson.lessonDate,
      lesson.dayOfWeek,
      lesson.periodNo,
      lesson.roomName,
      timetableId,
      classId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy tiết học");
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
    const error = new Error("Không tìm thấy tiết học");
    error.statusCode = 404;
    throw error;
  }
}

module.exports = {
  listClasses,
  getClassById,
  createClass,
  updateClass,
  deleteClass,
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
