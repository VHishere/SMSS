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
} = require("./validation");

const PARENT_ROLE_ID = 6;
const PARENT_RELATIONSHIPS = ["Father", "Mother", "Guardian"];
const USER_STATUSES = ["ACTIVE", "INACTIVE"];

async function listParents(filters = "") {
  const normalized =
    typeof filters === "string" ? { search: filters } : filters || {};
  const search = normalized.search || "";
  const keyword = `%${search.trim()}%`;
  const joinParams = normalized.schoolYearId ? [normalized.schoolYearId] : [];
  const conditions = [
    `(
      ? = ''
      OR ua.full_name LIKE ?
      OR ua.email LIKE ?
      OR ua.phone LIKE ?
      OR su.full_name LIKE ?
      OR s.student_code LIKE ?
    )`,
  ];
  const params = [
    ...joinParams,
    search.trim(),
    keyword,
    keyword,
    keyword,
    keyword,
    keyword,
  ];

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
      SELECT
        pp.parent_id AS parentId,
        pp.user_id AS userId,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        ua.status,
        pp.relationship,
        pp.is_primary AS isPrimary,
        s.student_id AS studentId,
        s.student_code AS studentCode,
        su.full_name AS studentName,
        sc.class_name AS className
      FROM parent_profile pp
      INNER JOIN user_account ua ON ua.user_id = pp.user_id
      LEFT JOIN (
        SELECT
          parent_id,
          student_id,
          MAX(relationship) AS relationship,
          MAX(is_primary) AS is_primary
        FROM student_parent
        GROUP BY parent_id, student_id
      ) sp ON sp.parent_id = pp.parent_id
      LEFT JOIN student s ON s.student_id = sp.student_id
      LEFT JOIN user_account su ON su.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.enrollment_id = (
          SELECT ce2.enrollment_id
          FROM class_enrollment ce2
          INNER JOIN school_class sc2 ON sc2.class_id = ce2.class_id
          WHERE ce2.student_id = s.student_id
            AND ce2.status = 'ACTIVE'
            ${normalized.schoolYearId ? "AND sc2.school_year_id = ?" : ""}
          ORDER BY ce2.enrollment_date DESC, ce2.enrollment_id DESC
          LIMIT 1
        )
      LEFT JOIN school_class sc
        ON sc.class_id = ce.class_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY pp.parent_id
    `,
    params,
  );

  return rows;
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
  const generatedUsername = `ph.${email
    .split("@")[0]
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 20)}`;
  const username = validateUsername(data.username || generatedUsername);
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
  const studentId = cleanText(data.studentId)
    ? validatePositiveInt(data.studentId, "học sinh")
    : null;

  if (studentId) {
    await assertExists(
      connection,
      "SELECT student_id FROM student WHERE student_id = ? AND status = 'ACTIVE' LIMIT 1",
      [studentId],
      "Không tìm thấy học sinh đang hoạt động",
    );
  }

  await assertUnique(
    connection,
    "SELECT user_id FROM user_account WHERE username = ? AND (? IS NULL OR user_id <> ?) LIMIT 1",
    [username, userId, userId],
    "Tên đăng nhập đã tồn tại",
  );
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
    studentId,
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
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        payload.username,
        passwordHash,
        payload.email,
        payload.fullName,
        payload.phone,
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

    if (payload.studentId) {
      await connection.query(
        `
          INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
          VALUES (?, ?, ?, ?)
        `,
        [
          payload.studentId,
          parentId,
          payload.linkRelationship,
          payload.isPrimary,
        ],
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

    if (data.studentId !== undefined) {
      await connection.query(
        "DELETE FROM student_parent WHERE parent_id = ?",
        [parentId],
      );

      if (payload.studentId) {
        await connection.query(
          `
            INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
            VALUES (?, ?, ?, ?)
          `,
          [
            payload.studentId,
            parentId,
            payload.linkRelationship,
            payload.isPrimary,
          ],
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
