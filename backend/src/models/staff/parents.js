const { pool } = require("../../config/db");
const { hashPassword } = require("../../utils/password");

const PARENT_ROLE_ID = 6;

async function listParents(filters = "") {
  const normalized =
    typeof filters === "string" ? { search: filters } : filters || {};
  const search = normalized.search || "";
  const keyword = `%${search.trim()}%`;
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
  const params = [search.trim(), keyword, keyword, keyword, keyword, keyword];

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
      LEFT JOIN student_parent sp ON sp.parent_id = pp.parent_id
      LEFT JOIN student s ON s.student_id = sp.student_id
      LEFT JOIN user_account su ON su.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
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
      FROM student_parent sp
      INNER JOIN student s ON s.student_id = sp.student_id
      INNER JOIN user_account su ON su.user_id = s.user_id
      LEFT JOIN class_enrollment ce
        ON ce.student_id = s.student_id AND ce.status = 'ACTIVE'
      LEFT JOIN school_class sc ON sc.class_id = ce.class_id
      WHERE sp.parent_id = ?
    `,
    [parentId],
  );

  return { ...parent, students };
}

async function createParent(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const username =
      data.username ||
      `ph.${data.email.split("@")[0].replace(/[^a-z0-9]/gi, "").slice(0, 20)}`;
    const passwordHash = hashPassword(data.password);

    const [userResult] = await connection.query(
      `
        INSERT INTO user_account (username, password_hash, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [username, passwordHash, data.email, data.fullName, data.phone || null],
    );

    const userId = userResult.insertId;

    const [parentResult] = await connection.query(
      `
        INSERT INTO parent_profile (user_id, relationship, is_primary)
        VALUES (?, ?, ?)
      `,
      [userId, data.relationship || "Guardian", Boolean(data.isPrimary)],
    );

    const parentId = parentResult.insertId;

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, PARENT_ROLE_ID],
    );

    if (data.studentId) {
      await connection.query(
        `
          INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
          VALUES (?, ?, ?, ?)
        `,
        [
          data.studentId,
          parentId,
          data.linkRelationship || data.relationship || "Guardian",
          Boolean(data.isPrimary),
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
        UPDATE parent_profile
        SET relationship = ?, is_primary = ?
        WHERE parent_id = ?
      `,
      [data.relationship || "Guardian", Boolean(data.isPrimary), parentId],
    );

    if (data.studentId !== undefined) {
      await connection.query(
        "DELETE FROM student_parent WHERE parent_id = ?",
        [parentId],
      );

      if (data.studentId) {
        await connection.query(
          `
            INSERT INTO student_parent (student_id, parent_id, relationship, is_primary)
            VALUES (?, ?, ?, ?)
          `,
          [
            data.studentId,
            parentId,
            data.linkRelationship || data.relationship || "Guardian",
            Boolean(data.isPrimary),
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
