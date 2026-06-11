import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export function LoginPage({ portal }) {
    const isSchool = portal === 'school';
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSubmitting(true);

        try {
            const response = isSchool
                ? await authApi.loginSchool(email, password)
                : await authApi.loginParent(email, password);

            const { token, user } = response.data;
            login(token, user);
            navigate(user.dashboardPath || '/');
        } catch (err) {
            setError(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={`login-page ${portal}`}>
            <div className="login-card">
                <Link to="/" className="back-link">← Quay lại</Link>

                <p className="eyebrow">{isSchool ? 'Cổng Trường' : 'Cổng Phụ huynh'}</p>
                <h1>Đăng nhập</h1>
                <p className="lead">
                    {isSchool
                        ? 'Sử dụng email trường (@edu.fpt.vn hoặc @fptschool.edu.vn)'
                        : 'Sử dụng email cá nhân được nhà trường cấp'}
                </p>

                <form onSubmit={handleSubmit} className="login-form">
                    <label>
                        Email
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder={isSchool ? 'ten@fptschool.edu.vn' : 'ten@example.com'}
                            required
                            autoComplete="email"
                        />
                    </label>

                    <label>
                        Mật khẩu
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Nhập mật khẩu"
                            required
                            autoComplete="current-password"
                        />
                    </label>

                    {error && <p className="form-error">{error}</p>}

                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>

                {isSchool ? (
                    <p className="switch-portal">
                        Bạn là phụ huynh? <Link to="/login/parent">Đăng nhập tại đây</Link>
                    </p>
                ) : (
                    <p className="switch-portal">
                        Bạn là giáo viên/nhân viên? <Link to="/login/school">Đăng nhập cổng trường</Link>
                    </p>
                )}
            </div>
        </div>
    );
}
