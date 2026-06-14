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
      <div className="flex justify-center px-2 py-4">
        <FptBrand />
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-2">
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
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
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
        className="w-72 border-0"
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