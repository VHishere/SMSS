import Offcanvas from "react-bootstrap/Offcanvas";
import { useNavigate } from "react-router-dom";

import fptLogo from "../../assets/logoFPT.png";
import FptBrand from "../atoms/FptBrand";
import SidebarMenuItem from "../molecules/SidebarMenuItem";
import { useAuth } from "../../context/useAuth";

const TEACHER_ROLES = ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"];

const thinScrollbar =
  "[scrollbar-color:rgba(255,255,255,0.25)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:w-1.5";

// FPT Teacher Portal (Stitch design) — deep blue sidebar, FPT logo brand,
// Material Symbols icons, logout pinned at the bottom
function TeacherSidebarContent({ items, onNavigate }) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  function handleLogout() {
    logout();
    navigate("/login/school", { replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-[#00458E] py-6">
      <div className="shrink-0 px-6 pb-8">
        <div className="flex items-center justify-center py-2">
          <img
            src={fptLogo}
            alt="FPT Education Logo"
            className="w-full max-w-[200px] rounded-md object-contain"
          />
        </div>
      </div>

      <nav
        className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto ${thinScrollbar}`}
      >
        {items.map((item) => (
          <SidebarMenuItem
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            msIcon={item.ms}
            end={item.end}
            onClick={onNavigate}
            variant="stitch"
          />
        ))}
      </nav>

      <div className="mt-auto shrink-0 px-6 pt-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-full px-4 py-3 text-white transition-colors hover:bg-[#BA1A1A]/20 hover:text-[#FFDAD6]"
        >
          <span className="material-symbols-outlined !text-[22px]">logout</span>
          <span className="text-sm">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}

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

      <nav
        className={`mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1.5 ${thinScrollbar}`}
      >
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
  const { user } = useAuth();
  const isTeacher = user?.roles?.some((r) =>
    TEACHER_ROLES.includes(r.roleName),
  );

  const Content = isTeacher ? TeacherSidebarContent : SidebarContent;
  const widthClass = isTeacher ? "w-[280px]" : "w-80";

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden lg:block ${widthClass}`}
      >
        <Content
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
        className={`border-0 ${widthClass}`}
      >
        <Offcanvas.Body className="p-0">
          <Content
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
