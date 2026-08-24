const { pool } = require("../../config/db");
const {
  assertUnique,
  createHttpError,
  requireText,
  validateDateRange,
  validateEnum,
} = require("./validation");

const SCHOOL_YEAR_STATUSES = ["PLANNED", "ACTIVE", "LOCKED", "CLOSED"];

// Tách khoảng thời gian năm học thành 2 học kỳ. Mốc mặc định là giao thừa
// dương lịch (HK1 kết thúc 31/12, HK2 bắt đầu 01/01) — đúng lịch phổ thông VN.
// Nếu năm học không vắt qua năm dương lịch thì chia đôi khoảng thời gian.
function splitSemesterRanges(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const newYearBoundary = new Date(`${end.getFullYear()}-01-01T00:00:00`);

  let firstEnd;
  let secondStart;

  if (newYearBoundary > start && newYearBoundary <= end) {
    firstEnd = `${start.getFullYear()}-12-31`;
    secondStart = `${end.getFullYear()}-01-01`;
  } else {
    const midpoint = new Date((start.getTime() + end.getTime()) / 2);
    const nextDay = new Date(midpoint.getTime());
    nextDay.setDate(nextDay.getDate() + 1);
    firstEnd = toIsoDate(midpoint);
    secondStart = toIsoDate(nextDay);
  }

  return [
    { name: "Học kỳ 1", startDate, endDate: firstEnd },
    { name: "Học kỳ 2", startDate: secondStart, endDate },
  ];
}

// Định dạng theo giờ địa phương — toISOString() sẽ lệch 1 ngày ở múi giờ +07.
function toIsoDate(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function validateSchoolYearPayload(connection, data, schoolYearId = null) {
  const yearName = requireText(data.yearName, "tên năm học", 20);
  const match = /^(\d{4})-(\d{4})$/.exec(yearName);

  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw createHttpError(
      "Tên năm học phải có định dạng YYYY-YYYY, ví dụ 2025-2026",
    );
  }

  // Form bắt buộc nhập ngày bắt đầu/kết thúc nên phải dùng đúng giá trị đó;
  // chỉ suy ra mốc mặc định khi client không gửi (API cũ).
  const { startDate, endDate } = validateDateRange(
    data.startDate || `${match[1]}-09-15`,
    data.endDate || `${match[2]}-05-31`,
  );

  if (startDate.slice(0, 4) !== match[1] || endDate.slice(0, 4) !== match[2]) {
    throw createHttpError(
      `Năm học ${yearName} phải bắt đầu trong năm ${match[1]} và kết thúc trong năm ${match[2]}`,
    );
  }

  const status = validateEnum(
    data.status,
    SCHOOL_YEAR_STATUSES,
    "trạng thái năm học",
    "PLANNED",
  );

  await assertUnique(
    connection,
    "SELECT school_year_id FROM school_year WHERE year_name = ? AND (? IS NULL OR school_year_id <> ?) LIMIT 1",
    [yearName, schoolYearId, schoolYearId],
    "Năm học đã tồn tại",
  );

  return { endDate, startDate, status, yearName };
}

async function listSchoolYears() {
  const [rows] = await pool.query(
    `
      SELECT
        sy.school_year_id AS schoolYearId,
        sy.year_name AS yearName,
        DATE_FORMAT(sy.start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(sy.end_date, '%Y-%m-%d') AS endDate,
        sy.is_active AS isActive,
        sy.start_date <= CURDATE() AS hasStarted,
        sy.end_date < CURDATE() AS hasEnded,
        sy.status,
        (
          SELECT COUNT(*)
          FROM school_class sc
          WHERE sc.school_year_id = sy.school_year_id AND sc.status = 'ACTIVE'
        ) AS classCount,
        (
          SELECT COUNT(DISTINCT ce.student_id)
          FROM class_enrollment ce
          INNER JOIN school_class sc ON sc.class_id = ce.class_id
          WHERE sc.school_year_id = sy.school_year_id AND ce.status = 'ACTIVE'
        ) AS studentCount
      FROM school_year sy
      ORDER BY sy.start_date DESC
    `,
  );

  return rows.map((row) => ({
    ...row,
    isActive: Boolean(row.isActive),
    hasStarted: Boolean(Number(row.hasStarted)),
    hasEnded: Boolean(Number(row.hasEnded)),
  }));
}

async function createSchoolYear(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const payload = await validateSchoolYearPayload(connection, data);

    const [result] = await connection.query(
      `
        INSERT INTO school_year (year_name, start_date, end_date, is_active, status)
        VALUES (?, ?, ?, FALSE, ?)
      `,
      [
        payload.yearName,
        payload.startDate,
        payload.endDate,
        payload.status,
      ],
    );

    const schoolYearId = result.insertId;

    if (data.createSemesters !== false) {
      const semesters = splitSemesterRanges(payload.startDate, payload.endDate);
      await connection.query(
        `
          INSERT INTO semester (school_year_id, semester_name, start_date, end_date, status)
          VALUES ?
        `,
        [
          semesters.map((semester) => [
            schoolYearId,
            semester.name,
            semester.startDate,
            semester.endDate,
            "ACTIVE",
          ]),
        ],
      );
    }

    await connection.commit();
    return listSchoolYears().then((years) =>
      years.find((y) => y.schoolYearId === schoolYearId),
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function assertSchoolYearCanActivate(schoolYearId) {
  const [[target]] = await pool.query(
    `
      SELECT
        school_year_id AS schoolYearId,
        year_name AS yearName,
        DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
        DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
        is_active AS isActive,
        start_date <= CURDATE() AS hasStarted,
        end_date < CURDATE() AS hasEnded,
        status
      FROM school_year
      WHERE school_year_id = ?
      LIMIT 1
    `,
    [schoolYearId],
  );

  if (!target) {
    throw createHttpError("Không tìm thấy năm học", 404);
  }

  const normalized = {
    ...target,
    isActive: Boolean(Number(target.isActive)),
    hasStarted: Boolean(Number(target.hasStarted)),
    hasEnded: Boolean(Number(target.hasEnded)),
  };

  if (normalized.isActive) {
    throw createHttpError(`Năm học ${normalized.yearName} đang được kích hoạt.`, 409);
  }

  if (normalized.status === "CLOSED") {
    throw createHttpError(`Năm học ${normalized.yearName} đã đóng nên không thể kích hoạt.`, 409);
  }

  if (!normalized.hasStarted) {
    throw createHttpError(
      `Chưa thể kích hoạt năm học ${normalized.yearName} trước ngày bắt đầu ${normalized.startDate}.`,
      409,
    );
  }

  if (normalized.hasEnded) {
    throw createHttpError(
      `Năm học ${normalized.yearName} đã kết thúc ngày ${normalized.endDate} nên không thể kích hoạt.`,
      409,
    );
  }

  return normalized;
}

async function activateSchoolYear(schoolYearId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          school_year_id AS schoolYearId,
          year_name AS yearName,
          DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
          DATE_FORMAT(end_date, '%Y-%m-%d') AS endDate,
          is_active AS isActive,
          start_date <= CURDATE() AS hasStarted,
          end_date < CURDATE() AS hasEnded,
          status
        FROM school_year
        WHERE school_year_id = ?
      `,
      [schoolYearId],
    );

    const target = rows[0];

    if (!target) {
      const error = new Error("Không tìm thấy năm học");
      error.statusCode = 404;
      throw error;
    }

    // Defense-in-depth: controller đã kiểm tra trước mọi side-effect, nhưng
    // model vẫn phải tự bảo vệ nếu endpoint/model được gọi từ nơi khác.
    if (Number(target.isActive) === 1) {
      throw createHttpError(`Năm học ${target.yearName} đang được kích hoạt.`, 409);
    }
    if (target.status === "CLOSED") {
      throw createHttpError(`Năm học ${target.yearName} đã đóng nên không thể kích hoạt.`, 409);
    }
    if (Number(target.hasStarted) !== 1) {
      throw createHttpError(
        `Chưa thể kích hoạt năm học ${target.yearName} trước ngày bắt đầu ${target.startDate}.`,
        409,
      );
    }
    if (Number(target.hasEnded) === 1) {
      throw createHttpError(
        `Năm học ${target.yearName} đã kết thúc ngày ${target.endDate} nên không thể kích hoạt.`,
        409,
      );
    }

    await connection.query("UPDATE school_year SET is_active = FALSE");
    await connection.query(
      "UPDATE school_year SET is_active = TRUE, status = 'ACTIVE' WHERE school_year_id = ?",
      [schoolYearId],
    );

    await connection.commit();
    return listSchoolYears();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findPreviousSchoolYear(connection, targetYear) {
  const [rows] = await connection.query(
    `
      SELECT school_year_id AS schoolYearId, year_name AS yearName
      FROM school_year
      WHERE start_date < ?
      ORDER BY start_date DESC
      LIMIT 1
    `,
    [targetYear.startDate],
  );

  return rows[0] || null;
}

async function ensureTargetSemesters(connection, targetYear) {
  const [semesters] = await connection.query(
    `
      SELECT semester_id AS semesterId, semester_name AS semesterName
      FROM semester
      WHERE school_year_id = ?
      ORDER BY start_date, semester_id
    `,
    [targetYear.schoolYearId],
  );

  // targetYear.startDate/endDate đến từ cột DATE nên có thể là Date object.
  const ranges = splitSemesterRanges(
    toIsoDate(new Date(targetYear.startDate)),
    toIsoDate(new Date(targetYear.endDate)),
  );

  // Bổ sung học kỳ CÒN THIẾU thay vì bỏ qua khi đã có ít nhất một học kỳ —
  // trong DB có năm học chỉ tạo được Học kỳ 1 rồi mắc kẹt vĩnh viễn.
  const existingNames = new Set(
    semesters.map((semester) =>
      String(semester.semesterName || "").trim().toLowerCase(),
    ),
  );
  const missing = ranges.filter(
    (range) => !existingNames.has(range.name.trim().toLowerCase()),
  );

  if (missing.length === 0) return semesters;

  await connection.query(
    `
      INSERT INTO semester (school_year_id, semester_name, start_date, end_date, status)
      VALUES ?
    `,
    [
      missing.map((range) => [
        targetYear.schoolYearId,
        range.name,
        range.startDate,
        range.endDate,
        "ACTIVE",
      ]),
    ],
  );

  const [created] = await connection.query(
    `
      SELECT semester_id AS semesterId, semester_name AS semesterName
      FROM semester
      WHERE school_year_id = ?
      ORDER BY start_date, semester_id
    `,
    [targetYear.schoolYearId],
  );

  return created;
}

async function buildSemesterMap(connection, sourceYearId, targetYear) {
  const [sourceSemesters] = await connection.query(
    `
      SELECT semester_id AS semesterId, semester_name AS semesterName
      FROM semester
      WHERE school_year_id = ?
      ORDER BY start_date, semester_id
    `,
    [sourceYearId],
  );
  const targetSemesters = await ensureTargetSemesters(connection, targetYear);
  const targetByName = new Map(
    targetSemesters.map((semester) => [
      String(semester.semesterName || "").trim().toLowerCase(),
      semester.semesterId,
    ]),
  );
  const map = new Map();

  sourceSemesters.forEach((semester, index) => {
    const nameKey = String(semester.semesterName || "").trim().toLowerCase();
    const targetSemesterId =
      targetByName.get(nameKey) || targetSemesters[index]?.semesterId;
    if (targetSemesterId) {
      map.set(semester.semesterId, targetSemesterId);
    }
  });

  return map;
}

async function copyClasses(connection, sourceYearId, targetYearId) {
  const [sourceClasses] = await connection.query(
    `
      SELECT class_id AS classId, grade_id AS gradeId, class_name AS className,
             room_name AS roomName, status
      FROM school_class
      WHERE school_year_id = ? AND status = 'ACTIVE'
      ORDER BY class_name
    `,
    [sourceYearId],
  );

  const classMap = new Map();
  let createdCount = 0;

  for (const classItem of sourceClasses) {
    const [existing] = await connection.query(
      `
        SELECT class_id AS classId
        FROM school_class
        WHERE school_year_id = ? AND class_name = ?
        LIMIT 1
      `,
      [targetYearId, classItem.className],
    );

    if (existing[0]) {
      classMap.set(classItem.classId, existing[0].classId);
      continue;
    }

    const [result] = await connection.query(
      `
        INSERT INTO school_class (grade_id, school_year_id, class_name, room_name, status)
        VALUES (?, ?, ?, ?, ?)
      `,
      [
        classItem.gradeId,
        targetYearId,
        classItem.className,
        classItem.roomName,
        classItem.status || "ACTIVE",
      ],
    );

    classMap.set(classItem.classId, result.insertId);
    createdCount += 1;
  }

  return { classMap, createdCount };
}

async function copyCurriculum(connection, sourceYearId, targetYear) {
  const semesterMap = await buildSemesterMap(connection, sourceYearId, targetYear);
  const [sourceItems] = await connection.query(
    `
      SELECT curriculum_id AS curriculumId, semester_id AS semesterId,
             grade_id AS gradeId, subject_id AS subjectId,
             periods_per_week AS periodsPerWeek, note, status
      FROM school_year_curriculum
      WHERE school_year_id = ? AND status = 'ACTIVE'
      ORDER BY curriculum_id
    `,
    [sourceYearId],
  );

  const curriculumMap = new Map();
  let createdCount = 0;
  let sessionCount = 0;

  for (const item of sourceItems) {
    const targetSemesterId = semesterMap.get(item.semesterId);
    if (!targetSemesterId) continue;

    const [existing] = await connection.query(
      `
        SELECT curriculum_id AS curriculumId
        FROM school_year_curriculum
        WHERE school_year_id = ?
          AND semester_id = ?
          AND (grade_id <=> ?)
          AND subject_id = ?
          AND status = 'ACTIVE'
        LIMIT 1
      `,
      [targetYear.schoolYearId, targetSemesterId, item.gradeId, item.subjectId],
    );

    let targetCurriculumId = existing[0]?.curriculumId;

    if (!targetCurriculumId) {
      const [result] = await connection.query(
        `
          INSERT INTO school_year_curriculum (
            school_year_id, semester_id, grade_id, subject_id,
            periods_per_week, note, status
          ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          targetYear.schoolYearId,
          targetSemesterId,
          item.gradeId,
          item.subjectId,
          item.periodsPerWeek,
          item.note,
        ],
      );
      targetCurriculumId = result.insertId;
      createdCount += 1;
    }

    curriculumMap.set(item.curriculumId, targetCurriculumId);

    const [sessions] = await connection.query(
      `
        SELECT session_no AS sessionNo, session_name AS sessionName,
               day_of_week AS dayOfWeek, period_no AS periodNo,
               start_time AS startTime, end_time AS endTime,
               session_part AS sessionPart, status
        FROM study_session
        WHERE curriculum_id = ? AND status = 'ACTIVE'
        ORDER BY session_no
      `,
      [item.curriculumId],
    );

    for (const session of sessions) {
      const [existingSession] = await connection.query(
        `
          SELECT session_id AS sessionId
          FROM study_session
          WHERE curriculum_id = ?
            AND session_no = ?
            AND status = 'ACTIVE'
          LIMIT 1
        `,
        [targetCurriculumId, session.sessionNo],
      );

      if (existingSession[0]) continue;

      await connection.query(
        `
          INSERT INTO study_session (
            curriculum_id, session_no, session_name, day_of_week, period_no,
            start_time, end_time, session_part, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          targetCurriculumId,
          session.sessionNo,
          session.sessionName,
          session.dayOfWeek,
          session.periodNo,
          session.startTime,
          session.endTime,
          session.sessionPart,
          session.status || "ACTIVE",
        ],
      );
      sessionCount += 1;
    }
  }

  return { curriculumMap, createdCount, sessionCount };
}

async function initializeSchoolYearData(schoolYearId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [[targetYear]] = await connection.query(
      `
        SELECT school_year_id AS schoolYearId, year_name AS yearName,
               start_date AS startDate, end_date AS endDate
        FROM school_year
        WHERE school_year_id = ?
        LIMIT 1
      `,
      [schoolYearId],
    );

    if (!targetYear) {
      throw createHttpError("Không tìm thấy năm học", 404);
    }

    const sourceYear = await findPreviousSchoolYear(connection, targetYear);
    if (!sourceYear) {
      await ensureTargetSemesters(connection, targetYear);
      await connection.commit();
      return {
        sourceSchoolYear: null,
        created: {
          classes: 0,
          curriculumItems: 0,
          studySessions: 0,
        },
      };
    }

    await ensureTargetSemesters(connection, targetYear);

    const { createdCount: classes } = await copyClasses(
      connection,
      sourceYear.schoolYearId,
      targetYear.schoolYearId,
    );
    const curriculum = await copyCurriculum(
      connection,
      sourceYear.schoolYearId,
      targetYear,
    );

    await connection.commit();

    return {
      sourceSchoolYear: sourceYear,
      created: {
        classes,
        curriculumItems: curriculum.createdCount,
        studySessions: curriculum.sessionCount,
      },
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateSchoolYear(schoolYearId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const payload = await validateSchoolYearPayload(
      connection,
      data,
      schoolYearId,
    );

    const [result] = await connection.query(
      `
        UPDATE school_year
        SET year_name = ?, start_date = ?, end_date = ?, status = ?
        WHERE school_year_id = ?
      `,
      [
        payload.yearName,
        payload.startDate,
        payload.endDate,
        payload.status,
        schoolYearId,
      ],
    );

    if (result.affectedRows === 0) {
      const error = new Error("Không tìm thấy năm học");
      error.statusCode = 404;
      throw error;
    }

    await connection.commit();
    const years = await listSchoolYears();
    return years.find((y) => y.schoolYearId === Number(schoolYearId));
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listSchoolYears,
  createSchoolYear,
  assertSchoolYearCanActivate,
  activateSchoolYear,
  initializeSchoolYearData,
  updateSchoolYear,
};
