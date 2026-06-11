import { DashboardLayout } from '../../components/DashboardLayout';

export function StudentDashboard() {
    return (
        <DashboardLayout title="Bảng điều khiển Học sinh" subtitle="Thông tin học tập cá nhân">
            <div className="info-card">
                <h3>Chức năng dành cho Học sinh</h3>
                <ul>
                    <li>Xem thời khóa biểu</li>
                    <li>Xem điểm và nhận xét</li>
                    <li>Đăng ký hoạt động ngoại khóa</li>
                </ul>
            </div>
        </DashboardLayout>
    );
}
