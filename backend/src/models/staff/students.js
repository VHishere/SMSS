const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");
const {
  assertExists,
  assertUnique,
  cleanText,
  optionalText,
  requireText,
  validateCode,
  validateDate,
  validateEmail,
  validateEnum,
  validateOptionalPhone,
  validatePassword,
  validatePositiveInt,
  validateUsername,
  generateUniqueUsername,
} = require("./validation");

const STUDENT_ROLE_ID = 7;
// TRANSFERRED tồn tại trong DB (học sinh chuyển trường). Thiếu nó thì mở trang
// sửa các học sinh đó là văng ngay "trạng thái không hợp lệ".
const STUDENT_STATUSES = ["ACTIVE", "INACTIVE", "TRANSFERRED"];
const STUDENT_GENDERS = ["MALE", "FEMALE", "OTHER"];

function buildStudentSelect({ schoolYearId } = {}) {
  return `
  SELECT
    s.student_id AS studentId,
    s.user_id AS userId,
    s.student_code AS studentCode,
    ua.username,
    ua.full_name AS fullName,
    ua.email,
    ua.phone,
    ua.avatar,
    DATE_FORMAT(s.date_of_birth, '%Y-%m-%d') AS dateOfBirthRaw,
    DATE_FORMAT(s.date_of_birth, '%d/%m/%Y') AS dateOfBirth,
    s.gender,
    s.address,
    s.status,
    sc.class_id AS classId,
    sc.class_name AS className,
    g.grade_name AS gradeName,
    sy.year_name AS schoolYearName
  FROM student s
  INNER JOIN user_account ua ON ua.user_id = s.user_id
  LEFT JOIN class_enrollment ce
    ON ce.enrollment_id = (
      SELECT ce2.enrollment_id
      FROM class_enrollment ce2
      INNER JOIN school_class sc2 ON sc2.class_id = ce2.class_id
      WHERE ce2.student_id = s.student_id
        AND ce2.status = 'ACTIVE'
        ${schoolYearId ? "AND sc2.school_year_id = ?" : ""}
      ORDER BY ce2.enrollment_date DESC, ce2.enrollment_id DESC
      LIMIT 1
    )
  LEFT JOIN school_class sc
    ON sc.class_id = ce.class_id
  LEFT JOIN grade g ON g.grade_id = sc.grade_id
  LEFT JOIN school_year sy ON sy.school_year_id = sc.school_year_id
`;
}

async function listStudents(filters = "") {
  const normalized =
    typeof filters === "string" ? { search: filters } : filters || {};
  const search = normalized.search || "";
  const keyword = `%${search.trim()}%`;
  const joinParams = normalized.schoolYearId ? [normalized.schoolYearId] : [];
  const conditions = [
    `(
      ? = ''
      OR ua.full_name LIKE ?
      OR s.student_code LIKE ?
      OR ua.email LIKE ?
      OR sc.class_name LIKE ?
    )`,
  ];
  const params = [
    ...joinParams,
    search.trim(),
    keyword,
    keyword,
    keyword,
    keyword,
  ];

  // Mặc định chỉ hiện học sinh đang học, nhưng vẫn cho phép lọc INACTIVE/ALL —
  // trước đây INACTIVE bị ẩn cứng nên chuyển trạng thái xong là mất luôn lối
  // vào trang sửa để bật lại.
  const statusFilter = String(normalized.status || "ACTIVE").toUpperCase();
  if (STUDENT_STATUSES.includes(statusFilter)) {
    conditions.push("s.status = ?");
    params.push(statusFilter);
  }

  if (normalized.gradeId) {
    conditions.push("sc.grade_id = ?");
    params.push(normalized.gradeId);
  }

  if (normalized.classId) {
    conditions.push("sc.class_id = ?");
    params.push(normalized.classId);
  }

  const [rows] = await pool.query(
    `
      ${buildStudentSelect({ schoolYearId: normalized.schoolYearId })}
      WHERE ${conditions.join(" AND ")}
      ORDER BY s.student_id
    `,
    params,
  );

  return rows;
}

async function getStudentById(studentId) {
  const [rows] = await pool.query(
    `${buildStudentSelect()} WHERE s.student_id = ? LIMIT 1`,
    [studentId],
  );

  const student = rows[0];
  if (!student) return null;

  const [parents] = await pool.query(
    `
      SELECT
        pp.parent_id AS parentId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        sp.relationship,
        sp.is_primary AS isPrimary
      FROM student_parent sp
      INNER JOIN parent_profile pp ON pp.parent_id = sp.parent_id
      INNER JOIN user_account ua ON ua.user_id = pp.user_id
      WHERE sp.student_id = ?
      ORDER BY sp.is_primary DESC
    `,
    [studentId],
  );

  return { ...student, parents };
}

async function validateStudentPayload(
  connection,
  data,
  { studentId = null, userId = null } = {},
) {
  const studentCode = validateCode(data.studentCode, "mã học sinh");
  const fullName = requireText(data.fullName, "họ và tên học sinh", 120);
  const email = validateEmail(data.email);
  const phone = validateOptionalPhone(data.phone);
  // username không bao giờ bị đổi khi cập nhật, nên chỉ cần giải quyết lúc tạo
  // mới hoặc khi staff nhập tay.
  let username = null;
  if (cleanText(data.username)) {
    username = validateUsername(data.username);
    await assertUnique(
      connection,
      "SELECT user_id FROM user_account WHERE username = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
      [username, userId, userId],
      "Tên đăng nhập đã tồn tại",
    );
  } else if (!userId) {
    username = await generateUniqueUsername(connection, studentCode);
  }

  const password = validatePassword(data.password);
  const dateOfBirth = validateDate(data.dateOfBirth, "ngày sinh", {
    notFuture: true,
    minYear: 1990,
  });
  const gender = validateEnum(
    data.gender,
    STUDENT_GENDERS,
    "giới tính",
    "OTHER",
  );
  const status = validateEnum(
    data.status,
    STUDENT_STATUSES,
    "trạng thái",
    "ACTIVE",
  );
  const address = optionalText(data.address, "địa chỉ", 255);
  const classId = cleanText(data.classId)
    ? validatePositiveInt(data.classId, "lớp học")
    : null;

  if (classId) {
    await assertExists(
      connection,
      "SELECT class_id FROM school_class WHERE class_id = ? AND status = 'ACTIVE' LIMIT 1",
      [classId],
      "Không tìm thấy lớp học đang hoạt động",
    );
  }

  await assertUnique(
    connection,
    "SELECT user_id FROM user_account WHERE email = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
    [email, userId, userId],
    "Email đã được sử dụng",
  );
  await assertUnique(
    connection,
    "SELECT student_id FROM student WHERE student_code = ? AND (? IS NULL OR student_id <> ?) LIMIT 1",
    [studentCode, studentId, studentId],
    "Mã học sinh đã tồn tại",
  );

  return {
    address,
    classId,
    dateOfBirth,
    email,
    fullName,
    gender,
    password,
    phone,
    status,
    studentCode,
    username,
  };
}

async function createStudent(data, actorUserId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const payload = await validateStudentPayload(connection, data);
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

    const [studentResult] = await connection.query(
      `
        INSERT INTO student (user_id, student_code, date_of_birth, gender, address, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        payload.studentCode,
        payload.dateOfBirth,
        payload.gender,
        payload.address,
        payload.status,
      ],
    );

    const studentId = studentResult.insertId;

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, STUDENT_ROLE_ID],
    );

    if (payload.classId) {
      await connection.query(
        `
          INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
          VALUES (?, ?, CURDATE(), 'ACTIVE')
        `,
        [payload.classId, studentId],
      );
    }

    await connection.commit();
    return getStudentById(studentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStudent(studentId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT user_id AS userId FROM student WHERE student_id = ?",
      [studentId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy học sinh");
      error.statusCode = 404;
      throw error;
    }

    const userId = rows[0].userId;
    const payload = await validateStudentPayload(connection, data, {
      studentId,
      userId,
    });

    // status phải đi cùng user_account: chỉ đổi student.status thì học sinh
    // "Ngưng học" vẫn đăng nhập được như thường.
    await connection.query(
      `
        UPDATE user_account
        SET full_name = ?, email = ?, phone = ?, status = ?, updated_at = NOW()
        WHERE user_id = ?
      `,
      [payload.fullName, payload.email, payload.phone, payload.status, userId],
    );

    await connection.query(
      `
        UPDATE student
        SET student_code = ?, date_of_birth = ?, gender = ?, address = ?, status = ?
        WHERE student_id = ?
      `,
      [
        payload.studentCode,
        payload.dateOfBirth,
        payload.gender,
        payload.address,
        payload.status,
        studentId,
      ],
    );

    if (data.classId !== undefined) {
      let targetSchoolYearId = data.schoolYearId
        ? validatePositiveInt(data.schoolYearId, "năm học")
        : null;

      if (payload.classId) {
        const [classRows] = await connection.query(
          "SELECT school_year_id AS schoolYearId FROM school_class WHERE class_id = ? LIMIT 1",
          [payload.classId],
        );
        targetSchoolYearId = classRows[0]?.schoolYearId || targetSchoolYearId;
      }

      // Form luôn gửi classId kể cả khi không đổi lớp, nên phải so với lớp hiện
      // tại trước: nếu giữ nguyên thì không đụng gì cả. Trước đây mỗi lần lưu
      // đều hủy rồi INSERT lại → đụng unique key (class_id, student_id) và báo
      // nhầm thành "email/mã/username trùng", hoặc nhân bản enrollment.
      const [currentRows] = await connection.query(
        `
          SELECT ce.class_id AS classId
          FROM class_enrollment ce
          INNER JOIN school_class sc ON sc.class_id = ce.class_id
          WHERE ce.student_id = ?
            AND ce.status = 'ACTIVE'
            AND (? IS NULL OR sc.school_year_id = ?)
          ORDER BY ce.enrollment_date DESC, ce.enrollment_id DESC
          LIMIT 1
        `,
        [studentId, targetSchoolYearId, targetSchoolYearId],
      );
      const currentClassId = currentRows[0]?.classId ?? null;
      const nextClassId = payload.classId ?? null;

      if (currentClassId !== nextClassId) {
        if (targetSchoolYearId) {
          await connection.query(
            `
              UPDATE class_enrollment ce
              INNER JOIN school_class sc ON sc.class_id = ce.class_id
              SET ce.status = 'INACTIVE'
              WHERE ce.student_id = ?
                AND ce.status = 'ACTIVE'
                AND sc.school_year_id = ?
            `,
            [studentId, targetSchoolYearId],
          );
        }

        if (nextClassId) {
          // Học sinh có thể từng học lớp này rồi (chuyển đi rồi quay lại) —
          // upsert để tái kích hoạt dòng cũ thay vì chèn dòng trùng.
          await connection.query(
            `
              INSERT INTO class_enrollment (class_id, student_id, enrollment_date, status)
              VALUES (?, ?, CURDATE(), 'ACTIVE')
              ON DUPLICATE KEY UPDATE status = 'ACTIVE', enrollment_date = CURDATE()
            `,
            [nextClassId, studentId],
          );
        }
      }
    }

    await connection.commit();
    return getStudentById(studentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setStudentAvatar(studentId, avatarUrl) {
  const [rows] = await pool.query(
    "SELECT user_id AS userId FROM student WHERE student_id = ?",
    [studentId],
  );

  if (!rows[0]) {
    const error = new Error("Không tìm thấy học sinh");
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    "UPDATE user_account SET avatar = ?, updated_at = NOW() WHERE user_id = ?",
    [avatarUrl, rows[0].userId],
  );

  return getStudentById(studentId);
}

module.exports = {
  listStudents,
  getStudentById,
  createStudent,
  updateStudent,
  setStudentAvatar,
};
