const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");
const {
  assertExists,
  assertUnique,
  cleanText,
  requireText,
  validateEmail,
  validateEnum,
  validateOptionalPhone,
  validatePassword,
  validatePositiveInt,
  validateUsername,
  generateUniqueUsername,
} = require("./validation");

const PARENT_ROLE_ID = 6;
const PARENT_RELATIONSHIPS = ["Father", "Mother", "Guardian"];
// LOCKED tồn tại trong DB (tài khoản bị khóa) — thiếu thì không sửa được.
const USER_STATUSES = ["ACTIVE", "INACTIVE", "LOCKED"];

// Các con của một nhóm phụ huynh, kèm lớp đang học trong năm học đang chọn.
async function findChildrenByParentIds(parentIds, schoolYearId) {
  if (parentIds.length === 0) return [];

  const params = schoolYearId ? [schoolYearId, parentIds] : [parentIds];
  const [rows] = await pool.query(
    `
      SELECT
        sp.parent_id AS parentId,
        s.student_id AS studentId,
        s.student_code AS studentCode,
        su.full_name AS studentName,
        sp.relationship,
        sp.is_primary AS isPrimary,
        sc.class_name AS className
      FROM student_parent sp
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account su ON su.user_id = s.user_id
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
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE sp.parent_id IN (?)
      ORDER BY s.student_code
    `,
    params,
  );

  return rows;
}

// Trả về MỖI PHỤ HUYNH MỘT DÒNG, các con gom vào mảng `students`. Bản cũ
// LEFT JOIN thẳng student_parent nên phụ huynh có 2 con bị lặp tên 2 lần
// (trong DB đang có 10 phụ huynh như vậy).
async function listParents(filters = "") {
  const normalized =
    typeof filters === "string" ? { search: filters } : filters || {};
  const search = (normalized.search || "").trim();
  const keyword = `%${search}%`;

  const conditions = [
    `(
      ? = ''
      OR ua.full_name LIKE ?
      OR ua.email LIKE ?
      OR ua.phone LIKE ?
      OR EXISTS (
        SELECT 1
        FROM student_parent sp
        INNER JOIN student s ON s.student_id = sp.student_id
        INNER JOIN user_account su ON su.user_id = s.user_id
        WHERE sp.parent_id = pp.parent_id
          AND (su.full_name LIKE ? OR s.student_code LIKE ?)
      )
    )`,
  ];
  const params = [search, keyword, keyword, keyword, keyword, keyword];

  // Lọc khối/lớp = "có ít nhất một con đang học ở đó", giới hạn trong năm học
  // đang chọn giống hành vi cũ.
  const scopeConditions = [];
  const scopeParams = [];

  if (normalized.gradeId) {
    scopeConditions.push("sc.grade_id = ?");
    scopeParams.push(normalized.gradeId);
  }

  if (normalized.classId) {
    scopeConditions.push("sc.class_id = ?");
    scopeParams.push(normalized.classId);
  }

  if (scopeConditions.length > 0) {
    if (normalized.schoolYearId) {
      scopeConditions.push("sc.school_year_id = ?");
      scopeParams.push(normalized.schoolYearId);
    }

    conditions.push(`
      EXISTS (
        SELECT 1
        FROM student_parent sp
        INNER JOIN class_enrollment ce
          ON ce.student_id = sp.student_id AND ce.status = 'ACTIVE'
        INNER JOIN school_class sc ON sc.class_id = ce.class_id
        WHERE sp.parent_id = pp.parent_id
          AND ${scopeConditions.join(" AND ")}
      )
    `);
    params.push(...scopeParams);
  }

  const [parents] = await pool.query(
    `
      SELECT
        pp.parent_id AS parentId,
        pp.user_id AS userId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        ua.status,
        pp.relationship,
        pp.is_primary AS isPrimary
      FROM parent_profile pp
      INNER JOIN user_account ua ON ua.user_id = pp.user_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY pp.parent_id
    `,
    params,
  );

  if (parents.length === 0) return [];

  const children = await findChildrenByParentIds(
    parents.map((parent) => parent.parentId),
    normalized.schoolYearId,
  );

  const byParent = new Map();
  for (const child of children) {
    if (!byParent.has(child.parentId)) byParent.set(child.parentId, []);
    byParent.get(child.parentId).push({
      studentId: child.studentId,
      studentCode: child.studentCode,
      studentName: child.studentName,
      className: child.className,
      relationship: child.relationship,
      isPrimary: Boolean(child.isPrimary),
    });
  }

  return parents.map((parent) => {
    const students = byParent.get(parent.parentId) || [];
    const classNames = [
      ...new Set(students.map((item) => item.className).filter(Boolean)),
    ];

    return {
      ...parent,
      isPrimary: Boolean(parent.isPrimary),
      students,
      studentCount: students.length,
      // Trường phẳng giữ cho màn Tổng quan (đang đọc thẳng row.studentName).
      studentId: students[0]?.studentId ?? null,
      studentCode: students.map((item) => item.studentCode).join(", ") || null,
      studentName: students.map((item) => item.studentName).join(", ") || null,
      className: classNames.join(", ") || null,
    };
  });
}

async function getParentById(parentId) {
  const [rows] = await pool.query(
    `
      SELECT
        pp.parent_id AS parentId,
        pp.user_id AS userId,
        ua.username,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        ua.status,
        pp.relationship,
        pp.is_primary AS isPrimary
      FROM parent_profile pp
      INNER JOIN user_account ua ON ua.user_id = pp.user_id
      WHERE pp.parent_id = ?
      LIMIT 1
    `,
    [parentId],
  );

  const parent = rows[0];
  if (!parent) return null;

  const [students] = await pool.query(
    `
      SELECT
        s.student_id AS studentId,
        s.student_code AS studentCode,
        su.full_name AS studentName,
        sp.relationship,
        sp.is_primary AS isPrimary,
        sc.class_name AS className
      FROM (
        SELECT
          parent_id,
          student_id,
          MAX(relationship) AS relationship,
          MAX(is_primary) AS is_primary
        FROM student_parent
        GROUP BY parent_id, student_id
      ) sp
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account su ON su.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.enrollment_id = (
          SELECT ce2.enrollment_id
          FROM class_enrollment ce2
          WHERE ce2.student_id = s.student_id
            AND ce2.status = 'ACTIVE'
          ORDER BY ce2.enrollment_date DESC, ce2.enrollment_id DESC
          LIMIT 1
        )
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE sp.parent_id = ?
    `,
    [parentId],
  );

  return { ...parent, students };
}

async function validateParentPayload(
  connection,
  data,
  { parentId = null, userId = null } = {},
) {
  const fullName = requireText(data.fullName, "họ và tên phụ huynh", 120);
  const email = validateEmail(data.email);
  const phone = validateOptionalPhone(data.phone);
  // Base cũ chỉ lấy phần trước @ nên an@gmail.com và an@yahoo.com đụng nhau.
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
    username = await generateUniqueUsername(
      connection,
      `ph.${email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20)}`,
    );
  }

  const password = validatePassword(data.password);
  const relationship = validateEnum(
    data.relationship,
    PARENT_RELATIONSHIPS,
    "quan hệ với học sinh",
    "Guardian",
  );
  const linkRelationship = validateEnum(
    data.linkRelationship || relationship,
    PARENT_RELATIONSHIPS,
    "quan hệ liên kết học sinh",
    relationship,
  );
  const status = validateEnum(
    data.status,
    USER_STATUSES,
    "trạng thái",
    "ACTIVE",
  );
  // Một phụ huynh có thể có nhiều con. Client mới gửi `studentIds` (danh sách
  // đầy đủ sau khi chỉnh sửa); `studentId` đơn lẻ vẫn được chấp nhận cho các
  // lời gọi cũ.
  const rawStudentIds = Array.isArray(data.studentIds)
    ? data.studentIds
    : cleanText(data.studentId)
      ? [data.studentId]
      : [];
  const studentIds = [
    ...new Set(
      rawStudentIds
        .filter((value) => cleanText(value))
        .map((value) => validatePositiveInt(value, "học sinh")),
    ),
  ];

  for (const linkedStudentId of studentIds) {
    await assertExists(
      connection,
      "SELECT student_id FROM student WHERE student_id = ? AND status = 'ACTIVE' LIMIT 1",
      [linkedStudentId],
      "Không tìm thấy học sinh đang hoạt động",
    );
  }

  await assertUnique(
    connection,
    "SELECT user_id FROM user_account WHERE email = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
    [email, userId, userId],
    "Email đã được sử dụng",
  );

  return {
    email,
    fullName,
    isPrimary: Boolean(data.isPrimary),
    linkRelationship,
    parentId,
    password,
    phone,
    relationship,
    status,
    studentIds,
    username,
  };
}

async function createParent(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const payload = await validateParentPayload(connection, data);
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

    const [parentResult] = await connection.query(
      `
        INSERT INTO parent_profile (user_id, relationship, is_primary)
        VALUES (?, ?, ?)
      `,
      [userId, payload.relationship, payload.isPrimary],
    );

    const parentId = parentResult.insertId;

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, PARENT_ROLE_ID],
    );

    for (const studentId of payload.studentIds) {
      await connection.query(
        `
          INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
          VALUES (?, ?, ?, ?)
        `,
        [studentId, parentId, payload.linkRelationship, payload.isPrimary],
      );
    }

    await connection.commit();
    return getParentById(parentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateParent(parentId, data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT user_id AS userId FROM parent_profile WHERE parent_id = ?",
      [parentId],
    );

    if (!rows[0]) {
      const error = new Error("Không tìm thấy phụ huynh");
      error.statusCode = 404;
      throw error;
    }

    const userId = rows[0].userId;
    const payload = await validateParentPayload(connection, data, {
      parentId,
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
        UPDATE parent_profile
        SET relationship = ?, is_primary = ?
        WHERE parent_id = ?
      `,
      [payload.relationship, payload.isPrimary, parentId],
    );

    if (data.studentIds !== undefined || data.studentId !== undefined) {
      // Đồng bộ đúng tập liên kết client gửi lên. Trước đây hàm này xóa sạch
      // student_parent rồi chèn lại đúng 1 dòng → phụ huynh có 2 con bị mất 1
      // con mỗi lần bấm Lưu.
      if (payload.studentIds.length) {
        const placeholders = payload.studentIds.map(() => "?").join(", ");
        await connection.query(
          `DELETE FROM student_parent
           WHERE parent_id = ? AND student_id NOT IN (${placeholders})`,
          [parentId, ...payload.studentIds],
        );
      } else {
        await connection.query(
          "DELETE FROM student_parent WHERE parent_id = ?",
          [parentId],
        );
      }

      for (const studentId of payload.studentIds) {
        await connection.query(
          `
            INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              relationship = VALUES(relationship),
              is_primary = VALUES(is_primary)
          `,
          [studentId, parentId, payload.linkRelationship, payload.isPrimary],
        );
      }
    }

    await connection.commit();
    return getParentById(parentId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listParents,
  getParentById,
  createParent,
  updateParent,
};
