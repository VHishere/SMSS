import {
  FiBell,
  FiMenu,
} from "react-icons/fi";

import AppIconButton from "../atoms/AppIconButton";
import ProfileDropdown from "../molecules/ProfileDropdown";

function DashboardHeader({
  user,
  onOpenSidebar,
  showNotificationBadge = true,
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-orange-100 bg-white/95 backdrop-blur">
      <div className="flex min-h-16 items-center px-4 sm:px-6 lg:px-8">
        <AppIconButton
          icon={FiMenu}
          label="Mở menu"
          onClick={onOpenSidebar}
          className="lg:hidden"
        />

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
          <AppIconButton
            icon={FiBell}
            label="Thông báo"
            badge={showNotificationBadge}
          />

          <ProfileDropdown user={user} />
        </div>
      </div>
    </header>
  );
}

export default DashboardHeader;