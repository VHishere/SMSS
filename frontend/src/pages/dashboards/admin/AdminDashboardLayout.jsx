import { Outlet } from "react-router-dom";

import DashboardShell from "../../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../../config/dashboardNavigation";
import useStaffHeaderUser from "../../../hooks/useStaffHeaderUser";

function AdminDashboardLayout() {
  const headerUser = useStaffHeaderUser();

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.ADMIN}
      sidebarFooterLabel="Vai trò"
      sidebarFooterValue="Quản trị viên hệ thống"
    >
      <Outlet />
    </DashboardShell>
  );
}

export default AdminDashboardLayout;
