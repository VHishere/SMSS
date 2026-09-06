const { pool } = require("../config/db");

const TEACHER_SUBJECT_MATCH_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM teacher_class tc_subject
      WHERE tc_subject.teacher_id = t.teacher_id
        AND tc_subject.subject_id = sb.subject_id
    )
    OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sb.subject_name))
    OR LOWER(TRIM(t.subject_specialize)) = LOWER(TRIM(sb.subject_code))
  )
`;

async function teacherCanTeachSubject(teacherId, subjectId, connection = pool) {
  const [rows] = await connection.query(
    `
      SELECT 1 AS ok
      FROM teacher t
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      INNER JOIN subject sb
        ON sb.subject_id = ?
        AND sb.status = 'ACTIVE'
      WHERE t.teacher_id = ?
        AND ${TEACHER_SUBJECT_MATCH_SQL}
      LIMIT 1
    `,
    [subjectId, teacherId],
  );

  return Boolean(rows[0]);
}

async function findTeachersForSubject(
  subjectId,
  { excludeTeacherId = null } = {},
  connection = pool,
) {
  const params = [subjectId];
  const excludeSql = excludeTeacherId ? "AND t.teacher_id <> ?" : "";
  if (excludeTeacherId) params.push(excludeTeacherId);

  const [rows] = await connection.query(
    `
      SELECT
        t.teacher_id AS teacherId,
        t.teacher_code AS teacherCode,
        t.subject_specialize AS subjectSpecialize,
        ua.full_name AS fullName,
        ua.full_name AS name,
        ua.email
      FROM teacher t
      INNER JOIN user_account ua
        ON ua.user_id = t.user_id
        AND ua.status = 'ACTIVE'
      INNER JOIN subject sb
        ON sb.subject_id = ?
        AND sb.status = 'ACTIVE'
      WHERE ${TEACHER_SUBJECT_MATCH_SQL}
        ${excludeSql}
      ORDER BY ua.full_name, t.teacher_id
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    subjectIds: [Number(subjectId)],
  }));
}

module.exports = {
  findTeachersForSubject,
  teacherCanTeachSubject,
};
