import { useState } from "react";

import DashboardHeader from "../organisms/DashboardHeader";
import DashboardSidebar from "../organisms/DashboardSidebar";
import { useAuth } from "../../context/useAuth";

const TEACHER_ROLES = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"];

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
  const isTeacher = authUser?.roles?.some((r) =>
    TEACHER_ROLES.includes(r.roleName),
  );

  // Teacher: FSchool Stitch design (Inter, light grey canvas, 280px sidebar)
  const rootClass = isTeacher
    ? "min-h-screen bg-[#F3F3F3] text-[#1A1C1C] [font-family:'Inter',sans-serif]"
    : "min-h-screen bg-[#FFF7F2] text-[#0F2747]";
  const contentPad = isTeacher ? "lg:pl-[280px]" : "lg:pl-80";

  return (
    <div className={rootClass}>
      <DashboardSidebar
        items={menuItems}
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

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;
