const { pool } = require("../../config/db");
const { TIMETABLE_SLOTS } = require("../../config/timetable.config");

function slotByPeriod(periodNo) {
  return (
    TIMETABLE_SLOTS.find((slot) => slot.periodNo === periodNo) ||
    TIMETABLE_SLOTS[0]
  );
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
      ORDER BY sem.start_date, g.grade_id, sub.subject_name
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
        data.schoolYearId,
        data.semesterId,
        data.gradeId || null,
        data.subjectId,
        data.periodsPerWeek || 2,
        data.note || null,
      ],
    );

    await createDefaultSessions(
      connection,
      result.insertId,
      subjectRows[0].subjectName,
      data.periodsPerWeek || 2,
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
        SELECT c.curriculum_id AS curriculumId, sub.subject_name AS subjectName
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

    const periodsPerWeek = data.periodsPerWeek || 2;

    await connection.query(
      `
        UPDATE school_year_curriculum
        SET grade_id = ?, periods_per_week = ?, note = ?, status = ?
        WHERE curriculum_id = ?
      `,
      [
        data.gradeId || null,
        periodsPerWeek,
        data.note || null,
        data.status || "ACTIVE",
        curriculumId,
      ],
    );

    await syncStudySessions(
      connection,
      curriculumId,
      rows[0].subjectName,
      periodsPerWeek,
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
  const slot = data.periodNo ? slotByPeriod(Number(data.periodNo)) : null;

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
      data.sessionName,
      data.dayOfWeek || null,
      data.periodNo || null,
      data.startTime || slot?.startTime || null,
      data.endTime || slot?.endTime || null,
      data.sessionPart || slot?.session || "MORNING",
      data.status || "ACTIVE",
      sessionId,
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
    [sessionId],
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
