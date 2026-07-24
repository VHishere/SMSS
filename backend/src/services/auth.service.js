// const { pool } = require("../config/db");

// const {
//   verifyPassword,
// } = require("../utils/password");

// const {
//   isSchoolEmail,
// } = require("../utils/email");

// const {
//   signToken,
// } = require("../utils/jwt");

// const {
//   SCHOOL_ROLES,
//   getDashboardPath,
// } = require("../constants/roles");

// async function findUserByEmail(email) {
//   const [rows] = await pool.query(
//     `
//       SELECT
//         user_id,
//         username,
//         password_hash,
//         email,
//         full_name,
//         phone,
//         avatar,
//         status
//       FROM user_account
//       WHERE LOWER(email) = ?
//     `,
//     [email.trim().toLowerCase()],
//   );

//   return rows[0] || null;
// }

// async function getUserRoles(userId) {
//   const [rows] = await pool.query(
//     `
//       SELECT
//         r.role_id,
//         r.role_name,
//         r.description
//       FROM user_role ur
//       INNER JOIN role r
//         ON ur.role_id = r.role_id
//       WHERE ur.user_id = ?
//     `,
//     [userId],
//   );

//   return rows;
// }

// function validatePortalAccess(
//   portal,
//   email,
//   roleNames,
// ) {
//   const schoolEmail = isSchoolEmail(email);

//   if (portal === "school") {
//     if (!schoolEmail) {
//       return (
//         "Cổng trường chỉ dành cho email " +
//         "@edu.fpt.vn hoặc @fptschool.edu.vn"
//       );
//     }

//     const canAccessSchool =
//       roleNames.some((role) =>
//         SCHOOL_ROLES.includes(role),
//       );

//     if (!canAccessSchool) {
//       return (
//         "Tài khoản này không có quyền " +
//         "truy cập cổng trường"
//       );
//     }

//     return null;
//   }

//   if (portal === "parent") {
//     if (schoolEmail) {
//       return (
//         "Phụ huynh vui lòng đăng nhập bằng " +
//         "email cá nhân được cấp"
//       );
//     }

//     if (!roleNames.includes("PARENT")) {
//       return (
//         "Tài khoản này không có quyền " +
//         "truy cập cổng phụ huynh"
//       );
//     }

//     return null;
//   }

//   return "Cổng đăng nhập không hợp lệ";
// }

// async function login({
//   email,
//   password,
//   portal,
// }) {
//   if (!email || !password) {
//     const error = new Error(
//       "Vui lòng nhập email và mật khẩu",
//     );

//     error.statusCode = 400;
//     throw error;
//   }

//   const user = await findUserByEmail(email);

//   if (!user) {
//     const error = new Error(
//       "Email hoặc mật khẩu không đúng",
//     );

//     error.statusCode = 401;
//     throw error;
//   }

//   if (user.status !== "ACTIVE") {
//     const error = new Error(
//       "Tài khoản đã bị khóa hoặc chưa được kích hoạt",
//     );

//     error.statusCode = 403;
//     throw error;
//   }

//   const passwordValid =
//     await verifyPassword(
//       password,
//       user.password_hash,
//     );

//   if (!passwordValid) {
//     const error = new Error(
//       "Email hoặc mật khẩu không đúng",
//     );

//     error.statusCode = 401;
//     throw error;
//   }

//   const roles = await getUserRoles(
//     user.user_id,
//   );

//   const roleNames = roles.map(
//     (role) => role.role_name,
//   );

//   const portalError =
//     validatePortalAccess(
//       portal,
//       user.email,
//       roleNames,
//     );

//   if (portalError) {
//     const error = new Error(portalError);

//     error.statusCode = 403;
//     throw error;
//   }

//   const token = signToken({
//     userId: user.user_id,
//     email: user.email,
//     roles: roleNames,
//     portal,
//   });

//   return {
//     token,

//     user: {
//       userId: user.user_id,
//       username: user.username,
//       email: user.email,
//       fullName: user.full_name,
//       phone: user.phone,
//       avatar: user.avatar,

//       roles: roles.map((role) => ({
//         roleId: role.role_id,
//         roleName: role.role_name,
//         description: role.description,
//       })),

//       portal,
//       dashboardPath:
//         getDashboardPath(roleNames),
//     },
//   };
// }

// async function getProfile(userId, portal) {
//   const [rows] = await pool.query(
//     `
//       SELECT
//         user_id,
//         username,
//         email,
//         full_name,
//         phone,
//         avatar,
//         status
//       FROM user_account
//       WHERE user_id = ?
//     `,
//     [userId],
//   );

//   const user = rows[0];

//   if (!user || user.status !== "ACTIVE") {
//     const error = new Error(
//       "Không tìm thấy người dùng",
//     );

//     error.statusCode = 404;
//     throw error;
//   }

//   const roles = await getUserRoles(userId);

//   const roleNames = roles.map(
//     (role) => role.role_name,
//   );

//   return {
//     userId: user.user_id,
//     username: user.username,
//     email: user.email,
//     fullName: user.full_name,
//     phone: user.phone,
//     avatar: user.avatar,

//     roles: roles.map((role) => ({
//       roleId: role.role_id,
//       roleName: role.role_name,
//       description: role.description,
//     })),

//     portal: portal || null,

//     dashboardPath: getDashboardPath(roleNames),
//   };
// }
// module.exports = {
//   login,
//   getProfile,
// };

const crypto = require("crypto");

const { pool } = require("../config/db");

const {
  verifyPassword,
  hashPassword,
} = require("../utils/password");

const {
  isSchoolEmail,
} = require("../utils/email");

const {
  signToken,
} = require("../utils/jwt");

const {
  SCHOOL_ROLES,
  getDashboardPath,
} = require("../constants/roles");

const {
  verifyGoogleCredential,
} = require("./googleAuth.service");

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `
      SELECT
        user_id,
        username,
        password_hash,
        email,
        full_name,
        phone,
        avatar,
        status
      FROM user_account
      WHERE LOWER(email) = ?
    `,
    [email.trim().toLowerCase()],
  );

  return rows[0] || null;
}

async function getUserRoles(userId) {
  const [rows] = await pool.query(
    `
      SELECT
        r.role_id,
        r.role_name,
        r.description
      FROM user_role ur
      INNER JOIN role r
        ON ur.role_id = r.role_id
      WHERE ur.user_id = ?
    `,
    [userId],
  );

  return rows;
}

function getPortalDomainError(portal, email) {
  const schoolEmail = isSchoolEmail(email);

  if (portal === "school" && !schoolEmail) {
    return (
      "Cổng trường chỉ dành cho email " +
      "@edu.fpt.vn hoặc @fptschool.edu.vn"
    );
  }

  if (portal === "parent" && schoolEmail) {
    return (
      "Phụ huynh vui lòng đăng nhập bằng " +
      "email cá nhân được cấp"
    );
  }

  if (portal !== "school" && portal !== "parent") {
    return "Cổng đăng nhập không hợp lệ";
  }

  return null;
}

function validatePortalAccess(
  portal,
  email,
  roleNames,
) {
  const domainError = getPortalDomainError(portal, email);

  if (domainError) {
    return domainError;
  }

  if (portal === "school") {
    const canAccessSchool =
      roleNames.some((role) =>
        SCHOOL_ROLES.includes(role),
      );

    if (!canAccessSchool) {
      return (
        "Tài khoản này không có quyền " +
        "truy cập cổng trường"
      );
    }

    return null;
  }

  if (portal === "parent") {
    if (!roleNames.includes("PARENT")) {
      return (
        "Tài khoản này không có quyền " +
        "truy cập cổng phụ huynh"
      );
    }

    return null;
  }

  return "Cổng đăng nhập không hợp lệ";
}

async function generateUniqueUsername(baseUsername) {
  let candidate = baseUsername;
  let suffix = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [rows] = await pool.query(
      "SELECT 1 FROM user_account WHERE username = ? LIMIT 1",
      [candidate],
    );

    if (!rows[0]) {
      return candidate;
    }

    suffix += 1;
    candidate = `${baseUsername}${suffix}`;
  }
}

async function createPendingUserFromGoogle(googleUser) {
  const baseUsername =
    googleUser.email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "") || "user";

  const username = await generateUniqueUsername(baseUsername);
  const placeholderHash = hashPassword(crypto.randomUUID());

  try {
    await pool.query(
      `
        INSERT INTO user_account
          (username, password_hash, email, full_name, avatar, status)
        VALUES (?, ?, ?, ?, ?, 'ACTIVE')
      `,
      [
        username,
        placeholderHash,
        googleUser.email,
        googleUser.fullName || username,
        googleUser.avatar || null,
      ],
    );
  } catch (error) {
    if (error.code !== "ER_DUP_ENTRY") {
      throw error;
    }
    // Another concurrent request already created this account — fall through
    // and let the caller re-fetch it by email.
  }

  return findUserByEmail(googleUser.email);
}

function buildAuthResponse({
  user,
  roles,
  portal,
  avatarFallback,
  fullNameFallback,
}) {
  const roleNames = roles.map(
    (role) => role.role_name,
  );

  const token = signToken({
    userId: user.user_id,
    email: user.email,
    roles: roleNames,
    portal,
  });

  return {
    token,

    user: {
      userId: user.user_id,
      username: user.username,
      email: user.email,
      fullName: user.full_name || fullNameFallback,
      phone: user.phone,
      avatar: user.avatar || avatarFallback,

      roles: roles.map((role) => ({
        roleId: role.role_id,
        roleName: role.role_name,
        description: role.description,
      })),

      portal,
      dashboardPath:
        getDashboardPath(roleNames),
    },
  };
}

async function login({
  email,
  password,
  portal,
}) {
  if (!email || !password) {
    const error = new Error(
      "Vui lòng nhập email và mật khẩu",
    );

    error.statusCode = 400;
    throw error;
  }

  const user = await findUserByEmail(email);

  if (!user) {
    const error = new Error(
      "Email hoặc mật khẩu không đúng",
    );

    error.statusCode = 401;
    throw error;
  }

  if (user.status !== "ACTIVE") {
    const error = new Error(
      "Tài khoản đã bị khóa hoặc chưa được kích hoạt",
    );

    error.statusCode = 403;
    throw error;
  }

  const passwordValid =
    await verifyPassword(
      password,
      user.password_hash,
    );

  if (!passwordValid) {
    const error = new Error(
      "Email hoặc mật khẩu không đúng",
    );

    error.statusCode = 401;
    throw error;
  }

  const roles = await getUserRoles(
    user.user_id,
  );

  const roleNames = roles.map(
    (role) => role.role_name,
  );

  const portalError =
    validatePortalAccess(
      portal,
      user.email,
      roleNames,
    );

  if (portalError) {
    const error = new Error(portalError);

    error.statusCode = 403;
    throw error;
  }

  return buildAuthResponse({
    user,
    roles,
    portal,
  });
}

const PENDING_APPROVAL_MESSAGE =
  "Tài khoản đang chờ quản trị viên cấp quyền truy cập.";

async function loginWithGoogle({
  credential,
  portal,
}) {
  const googleUser =
    await verifyGoogleCredential(credential);

  const domainError = getPortalDomainError(
    portal,
    googleUser.email,
  );

  if (domainError) {
    const error = new Error(domainError);

    error.statusCode = 403;
    throw error;
  }

  const user =
    await findUserByEmail(googleUser.email);

  if (!user) {
    await createPendingUserFromGoogle(googleUser);

    return {
      pending: true,
      message:
        "Tài khoản của bạn đã được tạo. Vui lòng chờ quản trị viên cấp quyền truy cập.",
    };
  }

  if (user.status !== "ACTIVE") {
    const error = new Error(
      "Tài khoản đã bị khóa hoặc chưa được kích hoạt",
    );

    error.statusCode = 403;
    throw error;
  }

  const roles = await getUserRoles(
    user.user_id,
  );

  if (roles.length === 0) {
    return {
      pending: true,
      message: PENDING_APPROVAL_MESSAGE,
    };
  }

  const roleNames = roles.map(
    (role) => role.role_name,
  );

  const portalError =
    validatePortalAccess(
      portal,
      user.email,
      roleNames,
    );

  if (portalError) {
    const error = new Error(portalError);

    error.statusCode = 403;
    throw error;
  }

  return buildAuthResponse({
    user,
    roles,
    portal,
    avatarFallback: googleUser.avatar,
    fullNameFallback: googleUser.fullName,
  });
}

async function getProfile(userId, portal) {
  const [rows] = await pool.query(
    `
      SELECT
        user_id,
        username,
        email,
        full_name,
        phone,
        avatar,
        status
      FROM user_account
      WHERE user_id = ?
    `,
    [userId],
  );

  const user = rows[0];

  if (!user || user.status !== "ACTIVE") {
    const error = new Error(
      "Không tìm thấy người dùng",
    );

    error.statusCode = 404;
    throw error;
  }

  const roles = await getUserRoles(userId);

  const roleNames = roles.map(
    (role) => role.role_name,
  );

  return {
    userId: user.user_id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    phone: user.phone,
    avatar: user.avatar,

    roles: roles.map((role) => ({
      roleId: role.role_id,
      roleName: role.role_name,
      description: role.description,
    })),

    portal: portal || null,

    dashboardPath: getDashboardPath(roleNames),
  };
}

module.exports = {
  login,
  loginWithGoogle,
  getProfile,
};