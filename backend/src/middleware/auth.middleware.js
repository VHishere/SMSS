const { verifyToken } = require('../utils/jwt');

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ success: false, message: 'Chưa đăng nhập hoặc token không hợp lệ' });
    }

    try {
        req.user = verifyToken(token);
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ' });
    }
}

function authorize(...allowedRoles) {
    return (req, res, next) => {
        const userRoles = req.user?.roles || [];
        const hasRole = allowedRoles.some((role) => userRoles.includes(role));

        if (!hasRole) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập' });
        }

        next();
    };
}

module.exports = { authenticate, authorize };
