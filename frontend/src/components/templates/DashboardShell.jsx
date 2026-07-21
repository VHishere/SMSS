import { useState } from "react";

import DashboardHeader from "../organisms/DashboardHeader";
import DashboardSidebar from "../organisms/DashboardSidebar";
import { useAuth } from "../../context/useAuth";
import { isStitchUser } from "../../config/sidebarRoles";

function DashboardShell({
  user,
  menuItems,
  sidebarFooterLabel,
  sidebarFooterValue,
  children,
}) {
  const [
    showMobileSidebar,
    setShowMobileSidebar,
  ] = useState(false);

  const { user: authUser } = useAuth();
  const isStitch = isStitchUser(authUser);

  // Chủ nhiệm hay không — global role đã được đồng bộ từ teacher_class (backfill).
  // Các mục nav gắn homeroomOnly chỉ hiện cho giáo viên chủ nhiệm; giáo viên
  // thuần bộ môn sẽ không thấy Nề nếp/Hạnh kiểm/Đơn nghỉ/Họp PH/Mục tiêu/Hỗ trợ/Thông báo.
  const isHomeroom = authUser?.roles?.some(
    (r) => r.roleName === "HOMEROOM_TEACHER",
  );
  const visibleItems = (menuItems ?? []).filter(
    (item) => !item.homeroomOnly || isHomeroom,
  );

  // Stitch roles (teacher + parent): FSchool Stitch design (Inter, light grey canvas, 280px sidebar)
  const rootClass = isStitch
    ? "min-h-screen bg-[#F3F3F3] text-[#1A1C1C] [font-family:'Inter',sans-serif]"
    : "min-h-screen bg-[#FFF7F2] text-[#0F2747]";
  const contentPad = isStitch ? "lg:pl-[280px]" : "lg:pl-80";

  return (
    <div className={rootClass}>
      <DashboardSidebar
        items={visibleItems}
        footerLabel={sidebarFooterLabel}
        footerValue={sidebarFooterValue}
        showMobile={showMobileSidebar}
        onCloseMobile={() =>
          setShowMobileSidebar(false)
        }
      />

      <div className={`min-h-screen ${contentPad}`}>
        <DashboardHeader
          user={user}
          onOpenSidebar={() =>
            setShowMobileSidebar(true)
          }
        />

        <main className="min-w-0 max-w-full overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;
