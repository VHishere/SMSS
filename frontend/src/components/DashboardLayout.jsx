import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function DashboardLayout({ title, subtitle, children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <div>
                    <p className="brand">KidCare</p>
                    <h1>{title}</h1>
                    {subtitle && <p className="subtitle">{subtitle}</p>}
                </div>
                <div className="user-panel">
                    <div>
                        <strong>{user?.fullName}</strong>
                        <p>{user?.email}</p>
                    </div>
                    <button type="button" className="btn-secondary" onClick={handleLogout}>
                        Đăng xuất
                    </button>
                </div>
            </header>

            <section className="role-badges">
                {user?.roles?.map((role) => (
                    <span key={role.roleId} className="role-badge">
                        {role.roleName}
                    </span>
                ))}
            </section>

            <main className="dashboard-content">{children}</main>

            <footer className="dashboard-footer">
                <Link to="/">← Về trang chọn cổng đăng nhập</Link>
            </footer>
        </div>
    );
}
