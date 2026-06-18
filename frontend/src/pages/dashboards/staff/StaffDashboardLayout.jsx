import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { staffApi } from "../../../api/client";
import DashboardShell from "../../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../../config/dashboardNavigation";
import useStaffHeaderUser from "../../../hooks/useStaffHeaderUser";

function StaffDashboardLayout() {
  const headerUser = useStaffHeaderUser();
  const [schoolYearName, setSchoolYearName] = useState("Đang tải...");

  useEffect(() => {
    staffApi
      .getOverview()
      .then((response) => {
        setSchoolYearName(
          response.data.schoolYearName || "Chưa cập nhật",
        );
      })
      .catch(() => {
        setSchoolYearName("Chưa cập nhật");
      });
  }, []);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STAFF}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={schoolYearName}
    >
      <Outlet />
    </DashboardShell>
  );
}

export default StaffDashboardLayout;
