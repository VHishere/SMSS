import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { getLoginPath } from '../utils/auth';

export function ProtectedRoute({ children, allowedRoles }) {
    const { user, loading, isAuthenticated } = useAuth();
    const location = useLocation();

    if (loading) {
        return <div className="page-loading">Đang tải...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to={getLoginPath()} replace state={{ from: location }} />;
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
