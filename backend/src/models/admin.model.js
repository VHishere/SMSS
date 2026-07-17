const { pool } = require("../config/db");

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
  setUserStatus,
};
