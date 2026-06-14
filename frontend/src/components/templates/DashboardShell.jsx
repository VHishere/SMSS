import { useState } from "react";

import DashboardHeader from "../organisms/DashboardHeader";
import DashboardSidebar from "../organisms/DashboardSidebar";

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

  return (
    <div className="min-h-screen bg-[#FFF7F2] text-[#0F2747]">
      <DashboardSidebar
        items={menuItems}
        footerLabel={sidebarFooterLabel}
        footerValue={sidebarFooterValue}
        showMobile={showMobileSidebar}
        onCloseMobile={() =>
          setShowMobileSidebar(false)
        }
      />

      <div className="min-h-screen lg:pl-64">
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