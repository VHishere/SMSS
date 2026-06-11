import { DashboardLayout } from '../../components/DashboardLayout';

export function AdminDashboard() {
    return (
        <DashboardLayout title="Bảng điều khiển Admin" subtitle="Quản trị toàn hệ thống">
            <div className="info-card">
                <h3>Chức năng dành cho Admin</h3>
                <ul>
                    <li>Quản lý tài khoản và phân quyền</li>
                    <li>Cấu hình hệ thống</li>
                    <li>Báo cáo tổng hợp toàn trường</li>
                </ul>
            </div>
        </DashboardLayout>
    );
}
