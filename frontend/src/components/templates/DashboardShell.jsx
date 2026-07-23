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

      <div className="min-h-screen lg:pl-80">
        <DashboardHeader
          user={user}
          onOpenSidebar={() =>
            setShowMobileSidebar(true)
          }
        />

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default DashboardShell;