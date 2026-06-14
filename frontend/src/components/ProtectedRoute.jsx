import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

function getLoginPathForRoles(allowedRoles) {
    if (allowedRoles?.includes('PARENT')) {
        return '/login/parent';
    }
    return '/login/school';
}

export function ProtectedRoute({ children, allowedRoles }) {
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

    return children;
}
