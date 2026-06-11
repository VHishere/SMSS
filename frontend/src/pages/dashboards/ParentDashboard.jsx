import { DashboardLayout } from '../../components/DashboardLayout';

export function ParentDashboard() {
    return (
        <DashboardLayout title="Bảng điều khiển Phụ huynh" subtitle="Theo dõi con em tại trường">
            <div className="info-card">
                <h3>Chức năng dành cho Phụ huynh</h3>
                <ul>
                    <li>Xem điểm danh và hoạt động hàng ngày</li>
                    <li>Nhận thông báo từ giáo viên</li>
                    <li>Đăng ký dịch vụ và thanh toán học phí</li>
                </ul>
            </div>
        </DashboardLayout>
    );
}
