const { pool } = require('../config/db');
const { verifyPassword } = require('../utils/password');
const { isSchoolEmail } = require('../utils/email');
const { signToken } = require('../utils/jwt');
const { SCHOOL_ROLES, getDashboardPath } = require('../constants/roles');

async function findUserByEmail(email) {
    const [rows] = await pool.query(
        `SELECT user_id, username, password_hash, email, full_name, phone, status
         FROM user_account
         WHERE LOWER(email) = ?`,
        [email.trim().toLowerCase()]
    );
    return rows[0] || null;
}

async function getUserRoles(userId) {
    const [rows] = await pool.query(
        `SELECT r.role_id, r.role_name, r.description
         FROM user_role ur
         JOIN role r ON ur.role_id = r.role_id
         WHERE ur.user_id = ?`,
        [userId]
    );
    return rows;
}

function validatePortalAccess(portal, email, roleNames) {
    const schoolEmail = isSchoolEmail(email);

    if (portal === 'school') {
        if (!schoolEmail) {
            return 'Cổng trường chỉ dành cho email @edu.fpt.vn hoặc @fptschool.edu.vn';
        }
        if (!roleNames.some((role) => SCHOOL_ROLES.includes(role))) {
            return 'Tài khoản này không có quyền truy cập cổng trường';
        }
        return null;
    }

    if (portal === 'parent') {
        if (schoolEmail) {
            return 'Phụ huynh vui lòng đăng nhập bằng email cá nhân được cấp, không dùng email trường';
        }
        if (!roleNames.includes('PARENT')) {
            return 'Tài khoản này không có quyền truy cập cổng phụ huynh';
        }
        return null;
    }

    return 'Cổng đăng nhập không hợp lệ';
}

async function login({ email, password, portal }) {
    if (!email || !password) {
        const error = new Error('Vui lòng nhập email và mật khẩu');
        error.statusCode = 400;
        throw error;
    }

    const user = await findUserByEmail(email);

    if (!user) {
        const error = new Error('Email hoặc mật khẩu không đúng');
        error.statusCode = 401;
        throw error;
    }

    if (user.status !== 'ACTIVE') {
        const error = new Error('Tài khoản đã bị khóa hoặc chưa được kích hoạt');
        error.statusCode = 403;
        throw error;
    }

    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
        const error = new Error('Email hoặc mật khẩu không đúng');
        error.statusCode = 401;
        throw error;
    }

    const roles = await getUserRoles(user.user_id);
    const roleNames = roles.map((role) => role.role_name);

    const portalError = validatePortalAccess(portal, user.email, roleNames);
    if (portalError) {
        const error = new Error(portalError);
        error.statusCode = 403;
        throw error;
    }

    const token = signToken({
        userId: user.user_id,
        email: user.email,
        roles: roleNames,
        portal
    });

    return {
        token,
        user: {
            userId: user.user_id,
            username: user.username,
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            roles: roles.map((role) => ({
                roleId: role.role_id,
                roleName: role.role_name,
                description: role.description
            })),
            portal,
            dashboardPath: getDashboardPath(roleNames)
        }
    };
}

async function getProfile(userId, portal) {
    const [rows] = await pool.query(
        `SELECT user_id, username, email, full_name, phone, status
         FROM user_account
         WHERE user_id = ?`,
        [userId]
    );

    const user = rows[0];
    if (!user || user.status !== 'ACTIVE') {
        const error = new Error('Không tìm thấy người dùng');
        error.statusCode = 404;
        throw error;
    }

    const roles = await getUserRoles(userId);

    return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        roles: roles.map((role) => ({
            roleId: role.role_id,
            roleName: role.role_name,
            description: role.description
        })),
        portal: portal || null,
        dashboardPath: getDashboardPath(roles.map((role) => role.role_name))
    };
}

module.exports = { login, getProfile };
