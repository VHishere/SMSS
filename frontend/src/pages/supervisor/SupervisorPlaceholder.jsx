import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";

// Trang tạm cho các mục quản nhiệm chưa dựng xong (đang phát triển theo lộ trình).
function SupervisorPlaceholder() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const item = useMemo(
    () => dashboardNavigation.SUPERVISOR.find((n) => n.path === pathname),
    [pathname],
  );
  const headerUser = {
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm",
    avatar: user?.avatar ?? "",
  };
  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "#F3F3F3", color: "#F27123" }}>
          <span className="material-symbols-outlined !text-[32px]">{item?.ms ?? "construction"}</span>
        </div>
        <h2 className="text-xl font-bold" style={{ color: "#1A1C1C" }}>{item?.label ?? "Quản nhiệm"}</h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">Màn hình này đang được hoàn thiện theo lộ trình module Quản nhiệm.</p>
      </div>
    </DashboardShell>
  );
}

export default SupervisorPlaceholder;
