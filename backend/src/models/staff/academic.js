const { pool } = require("../../config/db");

async function listAcademicResults(search = "") {
  const keyword = `%${search.trim()}%`;

  const [rows] = await pool.query(
    `
      SELECT
        ar.result_id AS resultId,
        s.student_id AS studentId,
        s.student_code AS studentCode,
        su.full_name AS studentName,
        ar.subject_id AS subjectId,
        sub.subject_name AS subjectName,
        sub.subject_code AS subjectCode,
        ar.semester_id AS semesterId,
        sem.semester_name AS semesterName,
        sy.year_name AS schoolYearName,
        ar.score_type AS scoreType,
        ar.score_value AS scoreValue,
        10 AS maxScore,
        ar.comment,
        DATE_FORMAT(ar.updated_at, '%d/%m/%Y') AS updatedAt
      FROM academic_result ar
      INNER JOIN student s ON s.student_id = ar.student_id
      INNER JOIN user_account su ON su.user_id = s.user_id
      INNER JOIN subject sub ON sub.subject_id = ar.subject_id
      INNER JOIN semester sem ON sem.semester_id = ar.semester_id
      LEFT JOIN school_year sy ON sy.school_year_id = sem.school_year_id
      WHERE (
        ? = ''
        OR su.full_name LIKE ?
        OR s.student_code LIKE ?
        OR sub.subject_name LIKE ?
        OR sem.semester_name LIKE ?
      )
      ORDER BY ar.updated_at DESC, ar.result_id DESC
    `,
    [search.trim(), keyword, keyword, keyword, keyword],
  );

  return rows;
}

async function getAcademicResultById(resultId) {
  const [rows] = await pool.query(
    `
      SELECT
        ar.result_id AS resultId,
        ar.student_id AS studentId,
        ar.subject_id AS subjectId,
        ar.semester_id AS semesterId,
        ar.score_type AS scoreType,
        ar.score_value AS scoreValue,
        10 AS maxScore,
        ar.comment,
        s.student_code AS studentCode,
        su.full_name AS studentName,
        sub.subject_name AS subjectName,
        sem.semester_name AS semesterName
      FROM academic_result ar
      INNER JOIN student s ON s.student_id = ar.student_id
      INNER JOIN user_account su ON su.user_id = s.user_id
      INNER JOIN subject sub ON sub.subject_id = ar.subject_id
      INNER JOIN semester sem ON sem.semester_id = ar.semester_id
      WHERE ar.result_id = ?
      LIMIT 1
    `,
    [resultId],
  );

  return rows[0] || null;
}

async function createAcademicResult(data) {
  try {
    const [result] = await pool.query(
      `
        INSERT INTO academic_result (
          student_id, subject_id, semester_id, score_type,
          score_value, comment
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        data.studentId,
        data.subjectId,
        data.semesterId,
        data.scoreType,
        data.scoreValue,
        data.comment || null,
      ],
    );

    return getAcademicResultById(result.insertId);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      const dupError = new Error(
        "Điểm đã tồn tại cho học sinh, môn học, học kỳ và loại điểm này",
      );
      dupError.statusCode = 409;
      throw dupError;
    }
    throw error;
  }
}

async function updateAcademicResult(resultId, data) {
  const existing = await getAcademicResultById(resultId);

  if (!existing) {
    const error = new Error("Không tìm thấy bản ghi học tập");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    `
      UPDATE academic_result
      SET
        student_id = ?,
        subject_id = ?,
        semester_id = ?,
        score_type = ?,
        score_value = ?,
        comment = ?,
        updated_at = NOW()
      WHERE result_id = ?
    `,
    [
      data.studentId,
      data.subjectId,
      data.semesterId,
      data.scoreType,
      data.scoreValue,
      data.comment || null,
      resultId,
    ],
  );

  return getAcademicResultById(resultId);
}

async function deleteAcademicResult(resultId) {
  const [result] = await pool.query(
    "DELETE FROM academic_result WHERE result_id = ?",
    [resultId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy bản ghi học tập");
    error.statusCode = 404;
    throw error;
  }

  return true;
}

module.exports = {
  listAcademicResults,
  getAcademicResultById,
  createAcademicResult,
  updateAcademicResult,
  deleteAcademicResult,
};
