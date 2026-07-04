const { pool } = require("../../config/db");

function toDateString(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

async function resolveSemesterId(connection, schoolYearId, scheduleDate) {
  const [rows] = await connection.query(
    `
      SELECT semester_id AS semesterId
      FROM semester
      WHERE school_year_id = ?
        AND (? BETWEEN start_date AND end_date OR start_date IS NULL)
      ORDER BY start_date
      LIMIT 1
    `,
    [schoolYearId, scheduleDate],
  );

  return rows[0]?.semesterId || null;
}

async function listYearSchedule(filters = {}) {
  const conditions = ["e.status = 'ACTIVE'"];
  const params = [];

  if (filters.schoolYearId) {
    conditions.push("e.school_year_id = ?");
    params.push(filters.schoolYearId);
  }

  if (filters.fromDate) {
    conditions.push("e.schedule_date >= ?");
    params.push(filters.fromDate);
  }

  if (filters.toDate) {
    conditions.push("e.schedule_date <= ?");
    params.push(filters.toDate);
  }

  if (filters.entryType) {
    conditions.push("e.entry_type = ?");
    params.push(filters.entryType);
  }

  if (filters.month) {
    conditions.push("DATE_FORMAT(e.schedule_date, '%Y-%m') = ?");
    params.push(filters.month);
  }

  const [rows] = await pool.query(
    `
      SELECT
        e.entry_id AS entryId,
        e.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        e.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        DATE_FORMAT(e.schedule_date, '%Y-%m-%d') AS scheduleDate,
        DATE_FORMAT(e.schedule_date, '%d/%m/%Y') AS scheduleDateLabel,
        e.entry_type AS entryType,
        e.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        e.title,
        e.description,
        DATE_FORMAT(e.start_time, '%H:%i') AS startTime,
        DATE_FORMAT(e.end_time, '%H:%i') AS endTime,
        e.location,
        e.grade_id AS gradeId,
        g.grade_name AS gradeName,
        e.status
      FROM year_schedule_entry e
      INNER JOIN school_year sy ON sy.school_year_id = e.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = e.semester_id
      LEFT JOIN subject sub ON sub.subject_id = e.subject_id
      LEFT JOIN grade g ON g.grade_id = e.grade_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY e.schedule_date, e.start_time, e.entry_id
    `,
    params,
  );

  return rows;
}

async function getYearScheduleEntry(entryId) {
  const [rows] = await pool.query(
    `
      SELECT
        e.entry_id AS entryId,
        e.school_year_id AS schoolYearId,
        sy.year_name AS schoolYearName,
        e.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        DATE_FORMAT(e.schedule_date, '%Y-%m-%d') AS scheduleDate,
        e.entry_type AS entryType,
        e.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        e.title,
        e.description,
        DATE_FORMAT(e.start_time, '%H:%i') AS startTime,
        DATE_FORMAT(e.end_time, '%H:%i') AS endTime,
        e.location,
        e.grade_id AS gradeId,
        g.grade_name AS gradeName,
        e.status
      FROM year_schedule_entry e
      INNER JOIN school_year sy ON sy.school_year_id = e.school_year_id
      LEFT JOIN semester sem ON sem.semester_id = e.semester_id
      LEFT JOIN subject sub ON sub.subject_id = e.subject_id
      LEFT JOIN grade g ON g.grade_id = e.grade_id
      WHERE e.entry_id = ?
      LIMIT 1
    `,
    [entryId],
  );

  return rows[0] || null;
}

async function createYearScheduleEntry(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let title = data.title?.trim();
    let subjectId = data.subjectId || null;

    if (data.entryType === "SUBJECT") {
      if (!subjectId) {
        const error = new Error("Vui lòng chọn môn học");
        error.statusCode = 400;
        throw error;
      }

      const [subjectRows] = await connection.query(
        "SELECT subject_name AS subjectName FROM subject WHERE subject_id = ?",
        [subjectId],
      );

      if (!subjectRows[0]) {
        const error = new Error("Không tìm thấy môn học");
        error.statusCode = 404;
        throw error;
      }

      title = title || subjectRows[0].subjectName;
    } else if (!title) {
      const error = new Error("Vui lòng nhập tên hoạt động ngoại khóa");
      error.statusCode = 400;
      throw error;
    }

    const semesterId =
      data.semesterId ||
      (await resolveSemesterId(connection, data.schoolYearId, data.scheduleDate));

    const [result] = await connection.query(
      `
        INSERT INTO year_schedule_entry (
          school_year_id, semester_id, schedule_date, entry_type,
          subject_id, title, description, start_time, end_time,
          location, grade_id, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        data.schoolYearId,
        semesterId,
        data.scheduleDate,
        data.entryType || "SUBJECT",
        data.entryType === "SUBJECT" ? subjectId : null,
        title,
        data.description || null,
        data.startTime || null,
        data.endTime || null,
        data.location || null,
        data.gradeId || null,
      ],
    );

    await connection.commit();
    return getYearScheduleEntry(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateYearScheduleEntry(entryId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [existing] = await connection.query(
      "SELECT entry_id AS entryId, school_year_id AS schoolYearId FROM year_schedule_entry WHERE entry_id = ?",
      [entryId],
    );

    if (!existing[0]) {
      const error = new Error("Không tìm thấy lịch học");
      error.statusCode = 404;
      throw error;
    }

    let title = data.title?.trim();
    let subjectId = data.subjectId || null;

    if (data.entryType === "SUBJECT") {
      const [subjectRows] = await connection.query(
        "SELECT subject_name AS subjectName FROM subject WHERE subject_id = ?",
        [subjectId],
      );
      title = title || subjectRows[0]?.subjectName;
    }

    const semesterId =
      data.semesterId ||
      (await resolveSemesterId(
        connection,
        existing[0].schoolYearId,
        data.scheduleDate,
      ));

    await connection.query(
      `
        UPDATE year_schedule_entry
        SET
          semester_id = ?,
          schedule_date = ?,
          entry_type = ?,
          subject_id = ?,
          title = ?,
          description = ?,
          start_time = ?,
          end_time = ?,
          location = ?,
          grade_id = ?,
          status = ?
        WHERE entry_id = ?
      `,
      [
        semesterId,
        data.scheduleDate,
        data.entryType,
        data.entryType === "SUBJECT" ? subjectId : null,
        title,
        data.description || null,
        data.startTime || null,
        data.endTime || null,
        data.location || null,
        data.gradeId || null,
        data.status || "ACTIVE",
        entryId,
      ],
    );

    await connection.commit();
    return getYearScheduleEntry(entryId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteYearScheduleEntry(entryId) {
  const [result] = await pool.query(
    "UPDATE year_schedule_entry SET status = 'INACTIVE' WHERE entry_id = ?",
    [entryId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy lịch học");
    error.statusCode = 404;
    throw error;
  }

  return { deleted: true };
}

function datesForWeekdayInRange(startDate, endDate, dayOfWeek) {
  const dates = [];
  const current = new Date(`${toDateString(startDate)}T00:00:00`);
  const end = new Date(`${toDateString(endDate)}T00:00:00`);

  while (current.getDay() + 1 !== Number(dayOfWeek) && current <= end) {
    current.setDate(current.getDate() + 1);
  }

  while (current <= end) {
    dates.push(toDateString(current));
    current.setDate(current.getDate() + 7);
  }

  return dates;
}

async function generateYearScheduleFromCurriculum(schoolYearId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [sessions] = await connection.query(
      `
        SELECT
          c.school_year_id AS schoolYearId,
          c.semester_id AS semesterId,
          c.grade_id AS gradeId,
          c.subject_id AS subjectId,
          sub.subject_name AS subjectName,
          ss.session_name AS sessionName,
          ss.day_of_week AS dayOfWeek,
          DATE_FORMAT(ss.start_time, '%H:%i') AS startTime,
          DATE_FORMAT(ss.end_time, '%H:%i') AS endTime,
          DATE_FORMAT(sem.start_date, '%Y-%m-%d') AS semesterStart,
          DATE_FORMAT(sem.end_date, '%Y-%m-%d') AS semesterEnd
        FROM study_session ss
        INNER JOIN school_year_curriculum c ON c.curriculum_id = ss.curriculum_id
        INNER JOIN subject sub ON sub.subject_id = c.subject_id
        INNER JOIN semester sem ON sem.semester_id = c.semester_id
        WHERE c.school_year_id = ?
          AND c.status = 'ACTIVE'
          AND ss.status = 'ACTIVE'
          AND ss.day_of_week IS NOT NULL
          AND sem.start_date IS NOT NULL
          AND sem.end_date IS NOT NULL
      `,
      [schoolYearId],
    );

    let createdCount = 0;

    for (const session of sessions) {
      const dates = datesForWeekdayInRange(
        session.semesterStart,
        session.semesterEnd,
        session.dayOfWeek,
      );

      for (const scheduleDate of dates) {
        const [exists] = await connection.query(
          `
            SELECT entry_id
            FROM year_schedule_entry
            WHERE school_year_id = ?
              AND schedule_date = ?
              AND entry_type = 'SUBJECT'
              AND subject_id = ?
              AND start_time = ?
              AND status = 'ACTIVE'
            LIMIT 1
          `,
          [
            schoolYearId,
            scheduleDate,
            session.subjectId,
            session.startTime ? `${session.startTime}:00` : null,
          ],
        );

        if (exists[0]) continue;

        await connection.query(
          `
            INSERT INTO year_schedule_entry (
              school_year_id, semester_id, schedule_date, entry_type,
              subject_id, title, start_time, end_time, grade_id, status
            ) VALUES (?, ?, ?, 'SUBJECT', ?, ?, ?, ?, ?, 'ACTIVE')
          `,
          [
            schoolYearId,
            session.semesterId,
            scheduleDate,
            session.subjectId,
            session.subjectName,
            session.startTime || null,
            session.endTime || null,
            session.gradeId || null,
          ],
        );

        createdCount += 1;
      }
    }

    await connection.commit();
    return { createdCount };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listYearSchedule,
  getYearScheduleEntry,
  createYearScheduleEntry,
  updateYearScheduleEntry,
  deleteYearScheduleEntry,
  generateYearScheduleFromCurriculum,
};
