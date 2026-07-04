const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");

const HOMEROOM_TEACHER_ROLE_ID = 3;
const SUBJECT_TEACHER_ROLE_ID = 4;
const TEACHER_ROLE_IDS = [HOMEROOM_TEACHER_ROLE_ID, SUBJECT_TEACHER_ROLE_ID];

const teacherSelect = `
  SELECT
    t.teacher_id AS teacherId,
    t.user_id AS userId,
    t.teacher_code AS teacherCode,
    t.subject_specialize AS subjectSpecialize,
    ua.username,
    ua.full_name AS fullName,
    ua.email,
    ua.phone,
    ua.status,
    (
      SELECT COUNT(*)
      FROM teacher_class tc
      WHERE tc.teacher_id = t.teacher_id
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
    ) AS classCount,
    EXISTS(
      SELECT 1 FROM user_role ur
      WHERE ur.user_id = t.user_id AND ur.role_id = ${HOMEROOM_TEACHER_ROLE_ID}
    ) AS isHomeroom,
    EXISTS(
      SELECT 1 FROM user_role ur
      WHERE ur.user_id = t.user_id AND ur.role_id = ${SUBJECT_TEACHER_ROLE_ID}
    ) AS isSubjectTeacher
  FROM teacher t
  INNER JOIN user_account ua ON ua.user_id = t.user_id
`;

async function listTeachers(search = "") {
  const keyword = `%${search.trim()}%`;

  const [rows] = await pool.query(
    `
      ${teacherSelect}
      WHERE (
        ? = ''
        OR ua.full_name LIKE ?
        OR t.teacher_code LIKE ?
        OR ua.email LIKE ?
        OR ua.phone LIKE ?
        OR t.subject_specialize LIKE ?
      )
      ORDER BY t.teacher_code
    `,
    [search.trim(), keyword, keyword, keyword, keyword, keyword],
  );

  return rows.map((row) => ({
    ...row,
    isHomeroom: Boolean(row.isHomeroom),
    isSubjectTeacher: Boolean(row.isSubjectTeacher),
  }));
}

async function getTeacherById(teacherId) {
  const [rows] = await pool.query(
    `${teacherSelect} WHERE t.teacher_id = ? LIMIT 1`,
    [teacherId],
  );

  const teacher = rows[0];
  if (!teacher) return null;

  const [classes] = await pool.query(
    `
      SELECT
        tc.teacher_class_id AS teacherClassId,
        sc.class_id AS classId,
        sc.class_name AS className,
        g.grade_name AS gradeName,
        sy.year_name AS schoolYearName,
        tc.role_in_class AS roleInClass,
        sub.subject_name AS subjectName
      FROM teacher_class tc
      INNER JOIN school_class sc ON sc.class_id = tc.class_id
      INNER JOIN grade g ON g.grade_id = sc.grade_id
      INNER JOIN school_year sy ON sy.school_year_id = sc.school_year_id
      LEFT JOIN subject sub ON sub.subject_id = tc.subject_id
      WHERE tc.teacher_id = ?
        AND (tc.end_date IS NULL OR tc.end_date >= CURDATE())
      ORDER BY sy.start_date DESC, sc.class_name
    `,
    [teacherId],
  );

  return {
    ...teacher,
    isHomeroom: Boolean(teacher.isHomeroom),
    isSubjectTeacher: Boolean(teacher.isSubjectTeacher),
    classes,
  };
}

async function syncTeacherRoles(connection, userId, isHomeroom) {
  await connection.query(
    `
      DELETE FROM user_role
      WHERE user_id = ? AND role_id IN (?, ?)
    `,
    [userId, HOMEROOM_TEACHER_ROLE_ID, SUBJECT_TEACHER_ROLE_ID],
  );

  if (isHomeroom) {
    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?), (?, ?)",
      [
        userId,
        HOMEROOM_TEACHER_ROLE_ID,
        userId,
        SUBJECT_TEACHER_ROLE_ID,
      ],
    );
  } else {
    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, SUBJECT_TEACHER_ROLE_ID],
    );
  }
}

async function createTeacher(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const username =
      data.username ||
      data.teacherCode.toLowerCase().replace(/[^a-z0-9]/gi, "");
    const passwordHash = hashPassword(data.password);
    const isHomeroom = Boolean(data.isHomeroom);

    const [userResult] = await connection.query(
      `
        INSERT INTO user_account (username, password_hash, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        username,
        passwordHash,
        data.email,
        data.fullName,
        data.phone || null,
      ],
    );

    const userId = userResult.insertId;

    const [teacherResult] = await connection.query(
      `
        INSERT INTO teacher (user_id, teacher_code, subject_specialize)
        VALUES (?, ?, ?)
      `,
      [userId, data.teacherCode, data.subjectSpecialize || null],
    );

    await syncTeacherRoles(connection, userId, isHomeroom);

    await connection.commit();
    return getTeacherById(teacherResult.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateTeacher(teacherId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT user_id AS userId FROM teacher WHERE teacher_id = ?",
      [teacherId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy giáo viên");
      error.statusCode = 404;
      throw error;
    }

    const userId = rows[0].userId;

    await connection.query(
      `
        UPDATE user_account
        SET full_name = ?, email = ?, phone = ?, status = ?, updated_at = NOW()
        WHERE user_id = ?
      `,
      [
        data.fullName,
        data.email,
        data.phone || null,
        data.status || "ACTIVE",
        userId,
      ],
    );

    await connection.query(
      `
        UPDATE teacher
        SET teacher_code = ?, subject_specialize = ?
        WHERE teacher_id = ?
      `,
      [data.teacherCode, data.subjectSpecialize || null, teacherId],
    );

    if (data.isHomeroom !== undefined) {
      await syncTeacherRoles(connection, userId, Boolean(data.isHomeroom));
    }

    await connection.commit();
    return getTeacherById(teacherId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listTeachers,
  getTeacherById,
  createTeacher,
  updateTeacher,
};
