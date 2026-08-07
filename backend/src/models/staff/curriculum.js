const { pool } = require("../../config/db");
const { TIMETABLE_SLOTS } = require("../../config/timetable.config");
const {
  assertExists,
  assertUnique,
  cleanText,
  createHttpError,
  optionalText,
  requireText,
  validateEnum,
  validatePositiveInt,
} = require("./validation");

const CURRICULUM_STATUSES = ["ACTIVE", "INACTIVE"];
const SESSION_PARTS = ["MORNING", "AFTERNOON"];

function slotByPeriod(periodNo) {
  return (
    TIMETABLE_SLOTS.find((slot) => slot.periodNo === periodNo) ||
    TIMETABLE_SLOTS[0]
  );
}

async function validateCurriculumPayload(
  connection,
  data,
  { curriculumId = null, current = null } = {},
) {
  const schoolYearId = validatePositiveInt(
    data.schoolYearId || current?.schoolYearId,
    "năm học",
  );
  const semesterId = validatePositiveInt(
    data.semesterId || current?.semesterId,
    "học kỳ",
  );
  const subjectId = validatePositiveInt(
    data.subjectId || current?.subjectId,
    "môn học",
  );
  const gradeId = cleanText(data.gradeId ?? current?.gradeId)
    ? validatePositiveInt(data.gradeId ?? current?.gradeId, "khối")
    : null;
  const periodsPerWeek = validatePositiveInt(
    data.periodsPerWeek || current?.periodsPerWeek || 2,
    "số buổi mỗi tuần",
    { min: 1, max: 8 },
  );
  const note = optionalText(data.note, "ghi chú", 255);
  const status = validateEnum(
    data.status,
    CURRICULUM_STATUSES,
    "trạng thái chương trình học",
    "ACTIVE",
  );

  await assertExists(
    connection,
    "SELECT school_year_id FROM school_year WHERE school_year_id = ? LIMIT 1",
    [schoolYearId],
    "Không tìm thấy năm học",
  );
  await assertExists(
    connection,
    "SELECT semester_id FROM semester WHERE semester_id = ? AND school_year_id = ? LIMIT 1",
    [semesterId, schoolYearId],
    "Học kỳ không thuộc năm học đã chọn",
  );
  const subject = await assertExists(
    connection,
    "SELECT subject_name AS subjectName FROM subject WHERE subject_id = ? AND status = 'ACTIVE' LIMIT 1",
    [subjectId],
    "Không tìm thấy môn học đang hoạt động",
  );

  if (gradeId) {
    await assertExists(
      connection,
      "SELECT grade_id FROM grade WHERE grade_id = ? AND status = 'ACTIVE' LIMIT 1",
      [gradeId],
      "Không tìm thấy khối đang hoạt động",
    );
  }

  await assertUnique(
    connection,
    `SELECT curriculum_id
     FROM school_year_curriculum
     WHERE school_year_id = ?
       AND semester_id = ?
       AND subject_id = ?
       AND (grade_id <=> ?)
       AND status = 'ACTIVE'
       AND (? IS NULL OR curriculum_id <> ?)
     LIMIT 1`,
    [schoolYearId, semesterId, subjectId, gradeId, curriculumId, curriculumId],
    "Môn học này đã có trong chương trình học",
  );

  return {
    gradeId,
    note,
    periodsPerWeek,
    schoolYearId,
    semesterId,
    status,
    subjectId,
    subjectName: subject.subjectName,
  };
}

async function listCurriculum(filters = {}) {
  const conditions = ["c.status = 'ACTIVE'"];
  const params = [];

  if (filters.schoolYearId) {
    conditions.push("c.school_year_id = ?");
    params.push(filters.schoolYearId);
  }

  if (filters.semesterId) {
    conditions.push("c.semester_id = ?");
    params.push(filters.semesterId);
  }

  if (filters.gradeId) {
    conditions.push("(c.grade_id = ? OR c.grade_id IS NULL)");
    params.push(filters.gradeId);
  }

  const [rows] = await pool.query(
    `
      SELECT
        c.curriculum_id AS curriculumId,
        c.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        c.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        c.grade_id AS gradeId,
        g.grade_name AS gradeName,
        c.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        sub.subject_code AS subjectCode,
        c.periods_per_week AS periodsPerWeek,
        c.note,
        c.status,
        (
          SELECT COUNT(*)
          FROM study_session ss
          WHERE ss.curriculum_id = c.curriculum_id AND ss.status = 'ACTIVE'
        ) AS sessionCount
      FROM school_year_curriculum c
      INNER JOIN school_year sy ON sy.school_year_id = c.school_year_id
      INNER JOIN semester sem ON sem.semester_id = c.semester_id
      INNER JOIN subject sub ON sub.subject_id = c.subject_id
      LEFT JOIN grade g ON g.grade_id = c.grade_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY sub.subject_name, g.grade_id, sem.start_date
    `,
    params,
  );

  return rows;
}

async function getCurriculumById(curriculumId) {
  const [found] = await pool.query(
      `
        SELECT
          c.curriculum_id AS curriculumId,
          c.school_year_id AS schoolYearId,
          sy.year_name AS schoolYearName,
          c.semester_id AS semesterId,
          sem.semester_name AS semesterName,
          c.grade_id AS gradeId,
          g.grade_name AS gradeName,
          c.subject_id AS subjectId,
          sub.subject_name AS subjectName,
          sub.subject_code AS subjectCode,
          c.periods_per_week AS periodsPerWeek,
          c.note,
          c.status
        FROM school_year_curriculum c
        INNER JOIN school_year sy ON sy.school_year_id = c.school_year_id
        INNER JOIN semester sem ON sem.semester_id = c.semester_id
        INNER JOIN subject sub ON sub.subject_id = c.subject_id
        LEFT JOIN grade g ON g.grade_id = c.grade_id
        WHERE c.curriculum_id = ?
        LIMIT 1
      `,
      [curriculumId],
  );

  if (!found[0]) return null;

  const sessions = await listStudySessions(curriculumId);
  return { ...found[0], sessions };
}

async function listStudySessions(curriculumId) {
  const [rows] = await pool.query(
    `
      SELECT
        ss.session_id AS sessionId,
        ss.curriculum_id AS curriculumId,
        ss.session_no AS sessionNo,
        ss.session_name AS sessionName,
        ss.day_of_week AS dayOfWeek,
        ss.period_no AS periodNo,
        DATE_FORMAT(ss.start_time, '%H:%i') AS startTime,
        DATE_FORMAT(ss.end_time, '%H:%i') AS endTime,
        ss.session_part AS sessionPart,
        ss.status
      FROM study_session ss
      WHERE ss.curriculum_id = ? AND ss.status = 'ACTIVE'
      ORDER BY ss.session_no
    `,
    [curriculumId],
  );

  return rows;
}

async function createDefaultSessions(connection, curriculumId, subjectName, periodsPerWeek) {
  for (let index = 1; index <= periodsPerWeek; index += 1) {
    const slot = slotByPeriod(index);
    await connection.query(
      `
        INSERT INTO study_session (
          curriculum_id, session_no, session_name, period_no,
          start_time, end_time, session_part, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        curriculumId,
        index,
        `Buổi ${index} - ${subjectName}`,
        slot.periodNo,
        slot.startTime,
        slot.endTime,
        slot.session,
      ],
    );
  }
}

async function syncStudySessions(connection, curriculumId, subjectName, periodsPerWeek) {
  const [existing] = await connection.query(
    `
      SELECT session_id AS sessionId, session_no AS sessionNo
      FROM study_session
      WHERE curriculum_id = ? AND status = 'ACTIVE'
      ORDER BY session_no
    `,
    [curriculumId],
  );

  if (existing.length > periodsPerWeek) {
    const removeIds = existing.slice(periodsPerWeek).map((item) => item.sessionId);
    await connection.query(
      `UPDATE study_session SET status = 'INACTIVE' WHERE session_id IN (?)`,
      [removeIds],
    );
  }

  for (let index = 1; index <= periodsPerWeek; index += 1) {
    const current = existing[index - 1];
    const slot = slotByPeriod(index);

    if (current) {
      await connection.query(
        `
          UPDATE study_session
          SET session_name = ?, status = 'ACTIVE'
          WHERE session_id = ?
        `,
        [`Buổi ${index} - ${subjectName}`, current.sessionId],
      );
    } else {
      await connection.query(
        `
          INSERT INTO study_session (
            curriculum_id, session_no, session_name, period_no,
            start_time, end_time, session_part, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          curriculumId,
          index,
          `Buổi ${index} - ${subjectName}`,
          slot.periodNo,
          slot.startTime,
          slot.endTime,
          slot.session,
        ],
      );
    }
  }
}

async function addCurriculumItem(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    if (Array.isArray(data.semesterIds) && data.semesterIds.length > 0) {
      const createdIds = [];

      for (const semesterId of data.semesterIds) {
        const payload = await validateCurriculumPayload(connection, {
          ...data,
          semesterId,
        });

        const [result] = await connection.query(
          `
            INSERT INTO school_year_curriculum (
              school_year_id, semester_id, grade_id, subject_id,
              periods_per_week, note, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
          `,
          [
            payload.schoolYearId,
            payload.semesterId,
            payload.gradeId,
            payload.subjectId,
            payload.periodsPerWeek,
            payload.note,
          ],
        );

        createdIds.push(result.insertId);

        await createDefaultSessions(
          connection,
          result.insertId,
          payload.subjectName,
          payload.periodsPerWeek,
        );
      }

      await connection.commit();
      return Promise.all(createdIds.map((id) => getCurriculumById(id)));
    }

    const payload = await validateCurriculumPayload(connection, data);

    const [subjectRows] = await connection.query(
      "SELECT subject_name AS subjectName FROM subject WHERE subject_id = ?",
      [data.subjectId],
    );

    if (!subjectRows[0]) {
      const error = new Error("Không tìm thấy môn học");
      error.statusCode = 404;
      throw error;
    }

    const [result] = await connection.query(
      `
        INSERT INTO school_year_curriculum (
          school_year_id, semester_id, grade_id, subject_id,
          periods_per_week, note, status
        ) VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        payload.schoolYearId,
        payload.semesterId,
        payload.gradeId,
        payload.subjectId,
        payload.periodsPerWeek,
        payload.note,
      ],
    );

    await createDefaultSessions(
      connection,
      result.insertId,
      payload.subjectName || subjectRows[0].subjectName,
      payload.periodsPerWeek,
    );

    await connection.commit();
    return getCurriculumById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateCurriculumItem(curriculumId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
        SELECT
          c.curriculum_id AS curriculumId,
          c.school_year_id AS schoolYearId,
          c.semester_id AS semesterId,
          c.grade_id AS gradeId,
          c.subject_id AS subjectId,
          c.periods_per_week AS periodsPerWeek,
          sub.subject_name AS subjectName
        FROM school_year_curriculum c
        INNER JOIN subject sub ON sub.subject_id = c.subject_id
        WHERE c.curriculum_id = ?
      `,
      [curriculumId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy chương trình học");
      error.statusCode = 404;
      throw error;
    }

    const payload = await validateCurriculumPayload(connection, data, {
      curriculumId,
      current: rows[0],
    });

    await connection.query(
      `
        UPDATE school_year_curriculum
        SET grade_id = ?, periods_per_week = ?, note = ?, status = ?
        WHERE curriculum_id = ?
      `,
      [
        payload.gradeId,
        payload.periodsPerWeek,
        payload.note,
        payload.status,
        curriculumId,
      ],
    );

    await syncStudySessions(
      connection,
      curriculumId,
      payload.subjectName || rows[0].subjectName,
      payload.periodsPerWeek,
    );

    await connection.commit();
    return getCurriculumById(curriculumId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteCurriculumItem(curriculumId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      "UPDATE study_session SET status = 'INACTIVE' WHERE curriculum_id = ?",
      [curriculumId],
    );

    const [result] = await connection.query(
      "UPDATE school_year_curriculum SET status = 'INACTIVE' WHERE curriculum_id = ?",
      [curriculumId],
    );

    if (result.affectedRows === 0) {
      const error = new Error("Không tìm thấy chương trình học");
      error.statusCode = 404;
      throw error;
    }

    await connection.commit();
    return { deleted: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStudySession(sessionId, data) {
  const normalizedSessionId = validatePositiveInt(sessionId, "buổi học");
  const sessionName = requireText(data.sessionName, "tên buổi học", 120);
  const dayOfWeek = cleanText(data.dayOfWeek)
    ? validatePositiveInt(data.dayOfWeek, "thứ", { min: 2, max: 7 })
    : null;
  const periodNo = cleanText(data.periodNo)
    ? validatePositiveInt(data.periodNo, "tiết học", { min: 1, max: 8 })
    : null;
  const slot = periodNo ? slotByPeriod(periodNo) : null;
  const startTime = data.startTime || slot?.startTime || null;
  const endTime = data.endTime || slot?.endTime || null;
  const sessionPart = validateEnum(
    data.sessionPart || slot?.session,
    SESSION_PARTS,
    "buổi học",
    "MORNING",
  );
  const status = validateEnum(
    data.status,
    CURRICULUM_STATUSES,
    "trạng thái buổi học",
    "ACTIVE",
  );

  if (startTime && endTime && startTime >= endTime) {
    throw createHttpError("Giờ kết thúc phải sau giờ bắt đầu");
  }

  const [result] = await pool.query(
    `
      UPDATE study_session
      SET
        session_name = ?,
        day_of_week = ?,
        period_no = ?,
        start_time = ?,
        end_time = ?,
        session_part = ?,
        status = ?
      WHERE session_id = ?
    `,
    [
      sessionName,
      dayOfWeek,
      periodNo,
      startTime,
      endTime,
      sessionPart,
      status,
      normalizedSessionId,
    ],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy buổi học");
    error.statusCode = 404;
    throw error;
  }

  const [rows] = await pool.query(
    `
      SELECT session_id AS sessionId, curriculum_id AS curriculumId
      FROM study_session WHERE session_id = ?
    `,
    [normalizedSessionId],
  );

  return listStudySessions(rows[0].curriculumId);
}

module.exports = {
  listCurriculum,
  getCurriculumById,
  listStudySessions,
  addCurriculumItem,
  updateCurriculumItem,
  deleteCurriculumItem,
  updateStudySession,
};
