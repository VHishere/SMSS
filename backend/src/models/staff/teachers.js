const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");
const {
  assertUnique,
  optionalText,
  requireText,
  validateCode,
  validateEmail,
  validateEnum,
  validateOptionalPhone,
  validatePassword,
  validateUsername,
  generateUniqueUsername,
} = require("./validation");

const HOMEROOM_TEACHER_ROLE_ID = 3;
const SUBJECT_TEACHER_ROLE_ID = 4;
const TEACHER_ROLE_IDS = [HOMEROOM_TEACHER_ROLE_ID, SUBJECT_TEACHER_ROLE_ID];
// LOCKED tồn tại trong DB (tài khoản bị khóa) — thiếu thì không sửa được.
const USER_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"];

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
      INNER JOIN school_class sc_count ON sc_count.class_id = tc.class_id
      INNER JOIN school_year sy_count ON sy_count.school_year_id = sc_count.school_year_id
      WHERE tc.teacher_id = t.teacher_id
        AND sy_count.is_active = TRUE
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

async function listTeachers(filters = "") {
  const normalized =
    typeof filters === "string" ? { search: filters } : filters || {};
  const search = normalized.search || "";
  const keyword = `%${search.trim()}%`;
  const conditions = [
    `(
      ? = ''
      OR ua.full_name LIKE ?
      OR t.teacher_code LIKE ?
      OR ua.email LIKE ?
      OR ua.phone LIKE ?
      OR t.subject_specialize LIKE ?
    )`,
  ];
  const params = [search.trim(), keyword, keyword, keyword, keyword, keyword];

  if (normalized.gradeId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM teacher_class tc_filter
        INNER JOIN school_class sc_filter ON sc_filter.class_id = tc_filter.class_id
        WHERE tc_filter.teacher_id = t.teacher_id
          AND sc_filter.grade_id = ?
          AND (tc_filter.end_date IS NULL OR tc_filter.end_date >= CURDATE())
      )
    `);
    params.push(normalized.gradeId);
  }

  if (normalized.schoolYearId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM teacher_class tc_filter
        INNER JOIN school_class sc_filter ON sc_filter.class_id = tc_filter.class_id
        WHERE tc_filter.teacher_id = t.teacher_id
          AND sc_filter.school_year_id = ?
          AND (tc_filter.end_date IS NULL OR tc_filter.end_date >= CURDATE())
      )
    `);
    params.push(normalized.schoolYearId);
  }

  if (normalized.classId) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM teacher_class tc_filter
        WHERE tc_filter.teacher_id = t.teacher_id
          AND tc_filter.class_id = ?
          AND (tc_filter.end_date IS NULL OR tc_filter.end_date >= CURDATE())
      )
    `);
    params.push(normalized.classId);
  }

  const [rows] = await pool.query(
    `
      ${teacherSelect}
      WHERE ${conditions.join(" AND ")}
      ORDER BY t.teacher_code
    `,
    params,
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
        AND sy.is_active = TRUE
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

async function validateTeacherPayload(
  connection,
  data,
  { teacherId = null, userId = null } = {},
) {
  const teacherCode = validateCode(data.teacherCode, "mã giáo viên");
  const fullName = requireText(data.fullName, "họ và tên giáo viên", 120);
  const email = validateEmail(data.email);
  const phone = validateOptionalPhone(data.phone);
  let username = null;
  if (String(data.username ?? "").trim()) {
    username = validateUsername(data.username);
    await assertUnique(
      connection,
      "SELECT user_id FROM user_account WHERE username = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
      [username, userId, userId],
      "Tên đăng nhập đã tồn tại",
    );
  } else if (!userId) {
    username = await generateUniqueUsername(connection, teacherCode);
  }

  const password = validatePassword(data.password);
  const subjectSpecialize = optionalText(
    data.subjectSpecialize,
    "chuyên môn",
    120,
  );
  const status = validateEnum(
    data.status,
    USER_STATUSES,
    "trạng thái",
    "ACTIVE",
  );

  await assertUnique(
    connection,
    "SELECT user_id FROM user_account WHERE email = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
    [email, userId, userId],
    "Email đã được sử dụng",
  );
  await assertUnique(
    connection,
    "SELECT teacher_id FROM teacher WHERE teacher_code = ? AND (? IS NULL OR teacher_id <> ?) LIMIT 1",
    [teacherCode, teacherId, teacherId],
    "Mã giáo viên đã tồn tại",
  );

  return {
    email,
    fullName,
    isHomeroom: Boolean(data.isHomeroom),
    password,
    phone,
    status,
    subjectSpecialize,
    teacherCode,
    username,
  };
}

async function createTeacher(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const payload = await validateTeacherPayload(connection, data);
    const passwordHash = hashPassword(payload.password);

    const [userResult] = await connection.query(
      `
        INSERT INTO user_account (username, password_hash, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        payload.username,
        passwordHash,
        payload.email,
        payload.fullName,
        payload.phone,
        payload.status,
      ],
    );

    const userId = userResult.insertId;

    const [teacherResult] = await connection.query(
      `
        INSERT INTO teacher (user_id, teacher_code, subject_specialize)
        VALUES (?, ?, ?)
      `,
      [userId, payload.teacherCode, payload.subjectSpecialize],
    );

    await syncTeacherRoles(connection, userId, payload.isHomeroom);

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
    const payload = await validateTeacherPayload(connection, data, {
      teacherId,
      userId,
    });

    await connection.query(
      `
        UPDATE user_account
        SET full_name = ?, email = ?, phone = ?, status = ?, updated_at = NOW()
        WHERE user_id = ?
      `,
      [
        payload.fullName,
        payload.email,
        payload.phone,
        payload.status,
        userId,
      ],
    );

    await connection.query(
      `
        UPDATE teacher
        SET teacher_code = ?, subject_specialize = ?
        WHERE teacher_id = ?
      `,
      [payload.teacherCode, payload.subjectSpecialize, teacherId],
    );

    if (data.isHomeroom !== undefined) {
      await syncTeacherRoles(connection, userId, payload.isHomeroom);
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
