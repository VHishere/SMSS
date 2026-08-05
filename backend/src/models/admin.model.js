const { pool } = require("../config/db");

async function listUsers({
  search = "",
  role = "",
  status = "",
  dateFrom = "",
  dateTo = "",
  page = 1,
  limit = 20,
} = {}) {
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

  if (role === "NONE") {
    conditions.push(`
      NOT EXISTS (
        SELECT 1 FROM user_role ur2
        WHERE ur2.user_id = ua.user_id
      )
    `);
  } else if (role) {
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

  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (parsedPage - 1) * parsedLimit;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM user_account ua ${whereClause}`,
    params,
  );

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
      LIMIT ? OFFSET ?
    `,
    [...params, parsedLimit, offset],
  );

  return {
    items: rows.map((row) => ({
      ...row,
      roleNames: row.roleNames ? row.roleNames.split(",") : [],
    })),
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.max(1, Math.ceil(total / parsedLimit)),
    },
  };
}

async function getUserStatusCounts() {
  const [rows] = await pool.query(
    "SELECT status, COUNT(*) AS count FROM user_account GROUP BY status",
  );

  const counts = { total: 0, ACTIVE: 0, LOCKED: 0, INACTIVE: 0 };
  for (const row of rows) {
    counts[row.status] = Number(row.count);
    counts.total += Number(row.count);
  }
  return counts;
}

async function listRoles() {
  const [rows] = await pool.query(
    "SELECT role_id AS roleId, role_name AS roleName, description FROM role ORDER BY role_id",
  );

  return rows;
}

async function getUserDetail(userId) {
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
        ua.created_at AS createdAt
      FROM user_account ua
      WHERE ua.user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  const user = rows[0];
  if (!user) return null;

  const [roles] = await pool.query(
    `
      SELECT r.role_id AS roleId, r.role_name AS roleName
      FROM user_role ur
      INNER JOIN role r ON r.role_id = ur.role_id
      WHERE ur.user_id = ?
      ORDER BY r.role_id
    `,
    [userId],
  );

  const [parentRows] = await pool.query(
    "SELECT parent_id AS parentId FROM parent_profile WHERE user_id = ? LIMIT 1",
    [userId],
  );
  const parentId = parentRows[0]?.parentId || null;

  let children = [];
  if (parentId) {
    const [childRows] = await pool.query(
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
        ORDER BY sp.is_primary DESC, s.student_id
      `,
      [parentId],
    );
    children = childRows;
  }

  return {
    ...user,
    roles,
    roleNames: roles.map((role) => role.roleName),
    parentId,
    children,
  };
}

async function updateUserRoles(userId, roleIds, actorUserId) {
  const ids = Array.from(
    new Set((Array.isArray(roleIds) ? roleIds : []).map(Number)),
  ).filter((id) => Number.isInteger(id) && id > 0);

  if (ids.length === 0) {
    const error = new Error("Phải chọn ít nhất một vai trò");
    error.statusCode = 400;
    throw error;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT user_id AS userId, status FROM user_account WHERE user_id = ? FOR UPDATE",
      [userId],
    );

    if (!userRows[0]) {
      const error = new Error("Không tìm thấy tài khoản");
      error.statusCode = 404;
      throw error;
    }

    if (userRows[0].status !== "ACTIVE") {
      const error = new Error(
        userRows[0].status === "LOCKED"
          ? "Tài khoản đang bị khóa, hãy mở khóa trước khi sửa vai trò"
          : "Tài khoản đã ngưng hoạt động, không thể sửa vai trò",
      );
      error.statusCode = 409;
      throw error;
    }

    const [roleRows] = await connection.query(
      `SELECT role_id AS roleId, role_name AS roleName FROM role WHERE role_id IN (${ids
        .map(() => "?")
        .join(",")})`,
      ids,
    );

    if (roleRows.length !== ids.length) {
      const error = new Error("Có vai trò không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    if (Number(userId) === Number(actorUserId)) {
      const [currentAdminRows] = await connection.query(
        `
          SELECT 1 FROM user_role ur
          INNER JOIN role r ON r.role_id = ur.role_id
          WHERE ur.user_id = ? AND r.role_name = 'ADMIN'
          LIMIT 1
        `,
        [userId],
      );

      const keepsAdmin = roleRows.some((role) => role.roleName === "ADMIN");

      if (currentAdminRows[0] && !keepsAdmin) {
        const error = new Error(
          "Không thể tự gỡ vai trò Admin của chính mình",
        );
        error.statusCode = 400;
        throw error;
      }
    }

    await connection.query("DELETE FROM user_role WHERE user_id = ?", [
      userId,
    ]);

    await connection.query(
      "INSERT INTO user_role (user_id, role_id) VALUES ?",
      [ids.map((roleId) => [userId, roleId])],
    );

    const hasParentRole = roleRows.some((role) => role.roleName === "PARENT");

    if (hasParentRole) {
      const [existingParentRows] = await connection.query(
        "SELECT parent_id AS parentId FROM parent_profile WHERE user_id = ? LIMIT 1",
        [userId],
      );

      if (!existingParentRows[0]) {
        await connection.query(
          "INSERT INTO parent_profile (user_id, relationship, is_primary) VALUES (?, 'Guardian', 0)",
          [userId],
        );
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getUserDetail(userId);
}

async function updateUserChildren(userId, children) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [parentRows] = await connection.query(
      `
        SELECT pp.parent_id AS parentId, ua.status
        FROM parent_profile pp
        INNER JOIN user_account ua ON ua.user_id = pp.user_id
        WHERE pp.user_id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [userId],
    );

    if (!parentRows[0]) {
      const error = new Error("Người dùng chưa có vai trò Phụ huynh");
      error.statusCode = 400;
      throw error;
    }

    if (parentRows[0].status !== "ACTIVE") {
      const error = new Error(
        parentRows[0].status === "LOCKED"
          ? "Tài khoản đang bị khóa, hãy mở khóa trước khi sửa danh sách con"
          : "Tài khoản đã ngưng hoạt động, không thể sửa danh sách con",
      );
      error.statusCode = 409;
      throw error;
    }

    const parentId = parentRows[0].parentId;
    const list = Array.isArray(children) ? children : [];

    const studentIds = Array.from(
      new Set(list.map((child) => Number(child.studentId)).filter(Boolean)),
    );

    if (studentIds.length !== list.length) {
      const error = new Error("Danh sách học sinh không hợp lệ");
      error.statusCode = 400;
      throw error;
    }

    await connection.query("DELETE FROM student_parent WHERE parent_id = ?", [
      parentId,
    ]);

    if (list.length > 0) {
      await connection.query(
        "INSERT INTO student_parent (student_id, parent_id, relationship, is_primary) VALUES ?",
        [
          list.map((child) => [
            Number(child.studentId),
            parentId,
            child.relationship || "Guardian",
            Boolean(child.isPrimary),
          ]),
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getUserDetail(userId);
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

// ── UC-106: School-wide operations dashboard ────────────────────────────────

async function getOperationsSummary() {
  const [[schoolYearRow]] = await pool.query(
    `SELECT school_year_id AS schoolYearId, year_name AS yearName,
       DATE_FORMAT(start_date, '%Y-%m-%d') AS startDate,
       DATE_FORMAT(end_date, '%Y-%m-%d')   AS endDate
     FROM school_year WHERE is_active = 1 LIMIT 1`,
  );

  const [[counts]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM student WHERE status = 'ACTIVE') AS totalStudents,
       (SELECT COUNT(*) FROM school_class WHERE status = 'ACTIVE') AS totalClasses,
       (SELECT COUNT(DISTINCT t.teacher_id) FROM teacher t
          INNER JOIN user_account ua ON ua.user_id = t.user_id WHERE ua.status = 'ACTIVE') AS totalTeachers,
       (SELECT COUNT(*) FROM academic_warning WHERE status = 'OPEN') AS openAcademicWarnings,
       (SELECT COUNT(*) FROM behavior_warning WHERE status = 'OPEN') AS openBehaviourWarnings,
       (SELECT COUNT(*) FROM attendance_warning WHERE status = 'OPEN') AS openAttendanceWarnings`,
  );

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = today.toISOString().slice(0, 10);

  const [[attendance]] = await pool.query(
    `SELECT
       SUM(CASE WHEN at.type_name IN ('PRESENT', 'LATE') THEN 1 ELSE 0 END) AS attended,
       COUNT(a.attendance_id) AS total
     FROM attendance a
     INNER JOIN attendance_type at ON at.attendance_type_id = a.attendance_type_id
     WHERE a.attendance_context = 'CLASS' AND a.attendance_date BETWEEN ? AND ?`,
    [monthStart, monthEnd],
  );

  const attendanceRate = Number(attendance.total) > 0
    ? Math.round((Number(attendance.attended) / Number(attendance.total)) * 1000) / 10
    : null;

  const [gradeBreakdown] = await pool.query(
    `SELECT g.grade_id AS gradeId, g.grade_name AS gradeName, COUNT(DISTINCT ce.student_id) AS studentCount
     FROM school_class sc
     INNER JOIN grade g ON g.grade_id = sc.grade_id
     INNER JOIN class_enrollment ce ON ce.class_id = sc.class_id AND ce.status = 'ACTIVE'
     WHERE sc.status = 'ACTIVE'
     GROUP BY g.grade_id, g.grade_name
     ORDER BY g.grade_id ASC`,
  );

  return {
    schoolYear: schoolYearRow
      ? { schoolYearId: schoolYearRow.schoolYearId, yearName: schoolYearRow.yearName, startDate: schoolYearRow.startDate, endDate: schoolYearRow.endDate }
      : null,
    totals: {
      students: Number(counts.totalStudents),
      classes: Number(counts.totalClasses),
      teachers: Number(counts.totalTeachers),
    },
    attendance: {
      rate: attendanceRate,
      period: { startDate: monthStart, endDate: monthEnd },
    },
    warnings: {
      academic: Number(counts.openAcademicWarnings),
      behaviour: Number(counts.openBehaviourWarnings),
      attendance: Number(counts.openAttendanceWarnings),
      total: Number(counts.openAcademicWarnings) + Number(counts.openBehaviourWarnings) + Number(counts.openAttendanceWarnings),
    },
    gradeBreakdown: gradeBreakdown.map((g) => ({ gradeId: g.gradeId, gradeName: g.gradeName, studentCount: Number(g.studentCount) })),
  };
}

module.exports = {
  listUsers,
  getUserStatusCounts,
  listRoles,
  getUserDetail,
  updateUserRoles,
  updateUserChildren,
  setUserStatus,
  getOperationsSummary,
};
