import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function getLoginPathForRoles(allowedRoles) {
    if (allowedRoles?.includes('PARENT')) {
        return '/login/parent';
    }
    return '/login/school';
}

export function ProtectedRoute({ children, allowedRoles, requireHomeroom }) {
    const { user, loading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="page-loading">Đang tải...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to={getLoginPathForRoles(allowedRoles)} replace state={{ from: location }} />;
    }

    if (allowedRoles?.length) {
        const userRoles = user.roles?.map((r) => r.roleName) || [];
        const hasAccess = allowedRoles.some((role) => userRoles.includes(role));

        if (!hasAccess) {
            return <Navigate to={user.dashboardPath || '/'} replace />;
        }
    }

    // Chức năng chỉ dành cho giáo viên chủ nhiệm (nề nếp, hạnh kiểm, mục tiêu,
    // họp PH, hỗ trợ HS, thông báo, đơn nghỉ). Giáo viên thuần bộ môn truy cập
    // trực tiếp bằng URL sẽ bị đưa về trang tổng quan.
    if (requireHomeroom) {
        const userRoles = user.roles?.map((r) => r.roleName) || [];
        if (!userRoles.includes('HOMEROOM_TEACHER')) {
            return <Navigate to="/teacher" replace />;
        }
    }

    return children;
}
