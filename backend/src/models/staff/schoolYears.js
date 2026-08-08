const { pool } = require("../../config/db");
const {
  assertUnique,
  createHttpError,
  requireText,
  validateDateRange,
  validateEnum,
} = require("./validation");

const SCHOOL_YEAR_STATUSES = ["PLANNED", "ACTIVE", "LOCKED", "CLOSED"];

async function validateSchoolYearPayload(connection, data, schoolYearId = null) {
  const yearName = requireText(data.yearName, "tên năm học", 20);
  const match = /^(\d{4})-(\d{4})$/.exec(yearName);

  if (!match || Number(match[2]) !== Number(match[1]) + 1) {
    throw createHttpError(
      "Tên năm học phải có định dạng YYYY-YYYY, ví dụ 2025-2026",
    );
  }

  const expectedStartDate = `${match[1]}-09-15`;
  const expectedEndDate = `${match[2]}-05-31`;
  const { startDate, endDate } = validateDateRange(
    expectedStartDate,
    expectedEndDate,
  );
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
        sy.end_date < CURDATE() AS hasEnded,
        sy.status,
        (SELECT COUNT(*) FROM school_class sc WHERE sc.school_year_id = sy.school_year_id) AS classCount,
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
      await connection.query(
        `
          INSERT INTO semester (school_year_id, semester_name, start_date, end_date, status)
          VALUES
            (?, 'Học kỳ 1', ?, ?, 'ACTIVE'),
            (?, 'Học kỳ 2', ?, ?, 'ACTIVE')
        `,
        [
          schoolYearId,
          payload.startDate,
          payload.endDate,
          schoolYearId,
          payload.startDate,
          payload.endDate,
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

async function activateSchoolYear(schoolYearId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          school_year_id AS schoolYearId,
          year_name AS yearName,
          is_active AS isActive,
          end_date < CURDATE() AS hasEnded
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

    // Năm học đã qua ngày kết thúc thì không thể được kích hoạt nữa. Năm học
    // đang áp dụng vẫn giữ nguyên (kể cả khi đã kết thúc) cho tới khi admin
    // kích hoạt năm học mới — đây là mặc định trong giai đoạn giao mùa.
    if (Number(target.hasEnded) === 1 && !Number(target.isActive)) {
      throw createHttpError(
        `Năm học ${target.yearName} đã kết thúc nên không thể kích hoạt.`,
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

  if (semesters.length > 0) return semesters;

  await connection.query(
    `
      INSERT INTO semester (school_year_id, semester_name, start_date, end_date, status)
      VALUES
        (?, 'Học kỳ 1', ?, ?, 'ACTIVE'),
        (?, 'Học kỳ 2', ?, ?, 'ACTIVE')
    `,
    [
      targetYear.schoolYearId,
      targetYear.startDate,
      targetYear.endDate,
      targetYear.schoolYearId,
      targetYear.startDate,
      targetYear.endDate,
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
  activateSchoolYear,
  initializeSchoolYearData,
  updateSchoolYear,
};
