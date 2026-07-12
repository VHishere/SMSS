const { pool } = require("../config/db");
const { hashPassword } = require("../utils/password");

const PROFILE_TABLE_BY_ROLE = {
  STUDENT: "student",
  PARENT: "parent_profile",
  STAFF: "staff",
  HOMEROOM_TEACHER: "teacher",
  SUBJECT_TEACHER: "teacher",
  DORM_SUPERVISOR: "dorm_supervisor",
  ADMIN: null,
};

async function listUsers({ search = "", role = "", status = "", dateFrom = "", dateTo = "" } = {}) {
  const conditions = [];
  const params = [];

  if (search.trim()) {
    conditions.push("ua.email LIKE ?");
    params.push(`%${search.trim()}%`);
  }

  if (status) {
    conditions.push("ua.status = ?");
    params.push(status);
  }

  if (role) {
    conditions.push(`
      EXISTS (
        SELECT 1 FROM user_role ur2
        INNER JOIN role r2 ON r2.role_id = ur2.role_id
        WHERE ur2.user_id = ua.user_id AND r2.role_name = ?
      )
    `);
    params.push(role);
  }

  if (dateFrom) {
    conditions.push("DATE(ua.created_at) >= ?");
    params.push(dateFrom);
  }

  if (dateTo) {
    conditions.push("DATE(ua.created_at) <= ?");
    params.push(dateTo);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        ua.user_id AS userId,
        ua.username,
        ua.full_name AS fullName,
        ua.email,
        ua.phone,
        ua.avatar,
        ua.status,
        DATE_FORMAT(ua.created_at, '%d/%m/%Y') AS joinedDate,
        ua.created_at AS createdAt,
        GROUP_CONCAT(DISTINCT r.role_name ORDER BY r.role_id SEPARATOR ',') AS roleNames
      FROM user_account ua
      LEFT JOIN user_role ur ON ur.user_id = ua.user_id
      LEFT JOIN role r ON r.role_id = ur.role_id
      ${whereClause}
      GROUP BY ua.user_id
      ORDER BY ua.created_at DESC
    `,
    params,
  );

  return rows.map((row) => ({
    ...row,
    roleNames: row.roleNames ? row.roleNames.split(",") : [],
  }));
}

const COMBINING_DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

function deriveUsername(email, fullName) {
  const base = (email?.split("@")[0] || fullName || "user")
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_DIACRITICS, "")
    .replace(/[^a-z0-9.]/g, "");

  return base || `user${Date.now()}`;
}

async function createUser(data) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [roleRows] = await connection.query(
      "SELECT role_id AS roleId FROM role WHERE role_name = ? LIMIT 1",
      [data.roleName],
    );

    if (!roleRows[0]) {
      const error = new Error("Vai trò không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    const username = data.username?.trim() || deriveUsername(data.email, data.fullName);
    const passwordHash = hashPassword(data.password);

    const [userResult] = await connection.query(
      `
        INSERT INTO user_account (username, password_hash, email, full_name, phone, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [username, passwordHash, data.email, data.fullName, data.phone || null],
    );

    const userId = userResult.insertId;

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES (?, ?)",
      [userId, roleRows[0].roleId],
    );

    const profileTable = PROFILE_TABLE_BY_ROLE[data.roleName];

    if (profileTable === "student") {
      await connection.query(
        `
          INSERT INTO student (user_id, student_code, date_of_birth, gender, address, status)
          VALUES (?, ?, ?, ?, ?, 'ACTIVE')
        `,
        [
          userId,
          data.studentCode,
          data.dateOfBirth || null,
          data.gender || "OTHER",
          data.address || null,
        ],
      );
    } else if (profileTable === "parent_profile") {
      await connection.query(
        `
          INSERT INTO parent_profile (user_id, relationship, is_primary)
          VALUES (?, ?, ?)
        `,
        [userId, data.relationship || "Father", Boolean(data.isPrimary)],
      );
    } else if (profileTable === "staff") {
      await connection.query(
        `
          INSERT INTO staff (user_id, position, department)
          VALUES (?, ?, ?)
        `,
        [userId, data.position || null, data.department || null],
      );
    } else if (profileTable === "teacher") {
      await connection.query(
        `
          INSERT INTO teacher (user_id, teacher_code, subject_specialize)
          VALUES (?, ?, ?)
        `,
        [userId, data.teacherCode || null, data.subjectSpecialize || null],
      );
    } else if (profileTable === "dorm_supervisor") {
      await connection.query(
        `
          INSERT INTO dorm_supervisor (user_id, phone)
          VALUES (?, ?)
        `,
        [userId, data.phone || null],
      );
    }

    await connection.commit();

    const [rows] = await pool.query(
      `
        SELECT
          ua.user_id AS userId,
          ua.username,
          ua.full_name AS fullName,
          ua.email,
          ua.phone,
          ua.status,
          DATE_FORMAT(ua.created_at, '%d/%m/%Y') AS joinedDate
        FROM user_account ua
        WHERE ua.user_id = ?
      `,
      [userId],
    );

    return rows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setUserStatus(userId, status) {
  const [currentRows] = await pool.query(
    "SELECT status FROM user_account WHERE user_id = ?",
    [userId],
  );

  if (!currentRows[0]) {
    const error = new Error("Không tìm thấy tài khoản");
    error.statusCode = 404;
    throw error;
  }

  if (currentRows[0].status === "INACTIVE") {
    const error = new Error("Tài khoản đã ngưng hoạt động, không thể mở khóa lại");
    error.statusCode = 409;
    throw error;
  }

  const [result] = await pool.query(
    "UPDATE user_account SET status = ?, updated_at = NOW() WHERE user_id = ?",
    [status, userId],
  );

  if (result.affectedRows === 0) {
    const error = new Error("Không tìm thấy tài khoản");
    error.statusCode = 404;
    throw error;
  }

  const [rows] = await pool.query(
    `
      SELECT
        ua.user_id AS userId,
        ua.status,
        DATE_FORMAT(ua.created_at, '%d/%m/%Y') AS joinedDate
      FROM user_account ua
      WHERE ua.user_id = ?
    `,
    [userId],
  );

  return rows[0];
}

module.exports = {
  listUsers,
  createUser,
  setUserStatus,
};
