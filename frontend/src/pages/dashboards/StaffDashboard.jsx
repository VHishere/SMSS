import { DashboardLayout } from '../../components/DashboardLayout';

export function StaffDashboard() {
    return (
        <DashboardLayout title="Bảng điều khiển Staff" subtitle="Phòng đào tạo / Văn phòng">
            <div className="info-card">
                <h3>Chức năng dành cho Staff</h3>
                <ul>
                    <li>Quản lý hồ sơ học sinh</li>
                    <li>Xử lý hồ sơ nhập học</li>
                    <li>Hỗ trợ phụ huynh và giáo viên</li>
                </ul>
            </div>
        </DashboardLayout>
    );
}
