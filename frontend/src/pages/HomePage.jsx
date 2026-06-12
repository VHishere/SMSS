import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

export function HomePage() {
    const { user, loading, isAuthenticated } = useAuth();

    if (loading) {
        return <div className="page-loading">Đang tải...</div>;
    }

    if (isAuthenticated) {
        return <Navigate to={user.dashboardPath || '/'} replace />;
    }

    return (
        <div className="home-page">
            <div className="home-card">
                <div className="home-brand">
                    <span className="brand-mark">FPT</span>
                    <p className="eyebrow">FPT School · KidCare</p>
                </div>
                <h1>Hệ thống quản lý mầm non</h1>
                <p className="lead">Chọn cổng đăng nhập phù hợp với vai trò của bạn</p>

                <div className="portal-grid">
                    <Link to="/login/school" className="portal-card school">
                        <div className="portal-icon school-icon" aria-hidden="true">🏫</div>
                        <h2>Cổng Trường</h2>
                        <p>Dành cho Admin, Staff, Giáo viên, Học sinh</p>
                        <span className="portal-hint">Email @edu.fpt.vn / @fptschool.edu.vn</span>
                    </Link>

                    <Link to="/login/parent" className="portal-card parent">
                        <div className="portal-icon parent-icon" aria-hidden="true">👨‍👩‍👧</div>
                        <h2>Cổng Phụ huynh</h2>
                        <p>Dành cho phụ huynh theo dõi con em</p>
                        <span className="portal-hint">Email cá nhân được cấp</span>
                    </Link>
                </div>
            </div>
        </div>
    );
}
