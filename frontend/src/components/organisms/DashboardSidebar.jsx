import Offcanvas from "react-bootstrap/Offcanvas";

import FptBrand from "../atoms/FptBrand";
import SidebarMenuItem from "../molecules/SidebarMenuItem";

function SidebarContent({
  items,
  footerLabel,
  footerValue,
  onNavigate,
}) {
  return (
    <div className="flex h-full flex-col bg-[#0F2747] p-4">
      <div className="flex shrink-0 justify-center px-2 py-3">
        <FptBrand />
      </div>

      <nav className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1.5 [scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5">
        {items.map((item) => (
          <SidebarMenuItem
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            end={item.end}
            onClick={onNavigate}
          />
        ))}
      </nav>

      {footerValue && (
        <div className="mt-6 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          {footerLabel && (
            <p className="mb-1 text-xs text-blue-200">
              {footerLabel}
            </p>
          )}

          <div className="font-bold text-white">
            {footerValue}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardSidebar({
  items = [],
  footerLabel,
  footerValue,
  showMobile = false,
  onCloseMobile,
}) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-80 lg:block">
        <SidebarContent
          items={items}
          footerLabel={footerLabel}
          footerValue={footerValue}
        />
      </aside>

      {/* Mobile sidebar */}
      <Offcanvas
        show={showMobile}
        onHide={onCloseMobile}
        placement="start"
        className="!w-[min(88vw,18rem)] border-0"
      >
        <Offcanvas.Body className="p-0">
          <SidebarContent
            items={items}
            footerLabel={footerLabel}
            footerValue={footerValue}
            onNavigate={onCloseMobile}
          />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default DashboardSidebar;