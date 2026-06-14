import { DashboardLayout } from '../../components/DashboardLayout';

export function TeacherDashboard() {
    return (
        <DashboardLayout title="Bảng điều khiển Giáo viên" subtitle="Giáo viên chủ nhiệm / Bộ môn / Quản nhiệm">
            <div className="info-card">
                <h3>Chức năng dành cho Giáo viên</h3>
                <ul>
                    <li>Điểm danh và nhận xét học sinh</li>
                    <li>Quản lý lớp học / ký túc xá</li>
                    <li>Gửi thông báo tới phụ huynh</li>
                </ul>
            </div>
        </DashboardLayout>
    );
}
