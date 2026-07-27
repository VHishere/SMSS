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
  sidebarVariant = "auto",
  children,
}) {
  const [
    showMobileSidebar,
    setShowMobileSidebar,
  ] = useState(false);

  const { user: authUser } = useAuth();
  const isStitch = isStitchUser(authUser);

  const useStitchSidebar =
    sidebarVariant === "stitch" ||
    (sidebarVariant === "auto" && isStitch);

  const isHomeroom = authUser?.roles?.some(
    (role) => role.roleName === "HOMEROOM_TEACHER",
  );

  const visibleItems = (menuItems ?? []).filter(
    (item) => !item.homeroomOnly || isHomeroom,
  );

  const rootClass = isStitch
    ? "min-h-screen bg-[#F3F3F3] text-[#1A1C1C] [font-family:'Inter',sans-serif]"
    : "min-h-screen bg-[#FFF7F2] text-[#0F2747]";

  const contentPad = useStitchSidebar
    ? "lg:pl-[280px]"
    : "lg:pl-80";

  return (
    <div className={rootClass}>
      <DashboardSidebar
        items={visibleItems}
        variant={sidebarVariant}
        footerLabel={sidebarFooterLabel}
        footerValue={sidebarFooterValue}
        showMobile={showMobileSidebar}
        onCloseMobile={() => setShowMobileSidebar(false)}
      />

      <div className={`min-h-screen ${contentPad}`}>
        <DashboardHeader
          user={user}
          onOpenSidebar={() => setShowMobileSidebar(true)}
        />

        <main
          className="
            mx-auto min-w-0 w-full max-w-[1600px]
            overflow-x-hidden
            px-3 py-4
            sm:px-5 sm:py-6
            lg:px-8
          "
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;