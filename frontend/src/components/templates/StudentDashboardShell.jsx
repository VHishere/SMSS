import { useMemo } from "react";

import DashboardShell from "./DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";

function buildStudentHeaderUser(user, context) {
  const studentRole = user?.roles?.find(
    (role) => role.roleName === "STUDENT",
  );

  return {
    name:
      context?.fullName ||
      user?.fullName ||
      user?.username ||
      "Học sinh",

    role:
      studentRole?.description ||
      "Học sinh",

    avatar:
      context?.avatar ||
      user?.avatar ||
      "",
  };
}

function StudentDashboardShell({ context, children }) {
  const { user } = useAuth();

  const headerUser = useMemo(
    () => buildStudentHeaderUser(user, context),
    [user, context],
  );

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.STUDENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={context?.schoolYearName || "Chưa cập nhật"}
    >
      {children}
    </DashboardShell>
  );
}

export default StudentDashboardShell;