import { useLayoutEffect, useRef } from "react";
import Offcanvas from "react-bootstrap/Offcanvas";
import { useNavigate } from "react-router-dom";

import fptLogo from "../../assets/logoFPT.png";
import FptBrand from "../atoms/FptBrand";
import SidebarMenuItem from "../molecules/SidebarMenuItem";
import { useAuth } from "../../context/useAuth";
import { isStitchUser } from "../../config/sidebarRoles";

// Giữ nguyên vị trí cuộn của menu sidebar giữa các lần điều hướng.
// Mỗi trang tự bọc <DashboardShell> riêng nên khi chuyển trang, cả sidebar bị
// unmount → mount lại; nếu không lưu, thanh cuộn luôn nhảy về mục đầu tiên.
function useNavScrollMemory(storageKey) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // Chốt vị trí cần khôi phục MỘT LẦN lúc mount. Nếu đọc lại sessionStorage ở
    // mỗi lần restore, nó có thể đã bị các sự kiện scroll "kẹp" layout ghi đè.
    const raw = sessionStorage.getItem(storageKey);
    const target = raw != null ? Number(raw) || 0 : null;

    let saving = false;
    const ro = new ResizeObserver(() => restore());
    // Chốt: ngừng ép vị trí & cho phép lưu vị trí người dùng tự cuộn.
    const finish = () => {
      ro.disconnect();
      saving = true;
    };
    const restore = () => {
      if (target == null) return finish();
      el.scrollTop = target;
      // Đạt đúng vị trí (không còn bị "kẹp" do layout chưa đủ cao) → chốt lại.
      if (Math.abs(el.scrollTop - target) <= 1) finish();
    };

    // Layout ổn định trễ khi reload (logo ~211KB / icon-font tải xong làm đổi
    // chiều cao) → áp lại vị trí MỖI khi kích thước đổi, tới khi đạt đúng vị trí.
    // ResizeObserver chỉ phản ứng với thay đổi kích thước nên không tranh chấp
    // với thao tác cuộn của người dùng.
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    restore(); // trước paint → không giật
    const raf = requestAnimationFrame(restore);
    // Tín hiệu chắc chắn "layout đã xong" khi reload: window 'load' (logo + mọi
    // tài nguyên tải xong) và fonts.ready (icon-font). Áp lại vị trí đúng lúc đó.
    window.addEventListener("load", restore);
    if (document.fonts?.ready) document.fonts.ready.then(restore);
    // Fallback: nếu không thể đạt vị trí (vd. nội dung nay ngắn hơn) thì vẫn chốt.
    const settle = setTimeout(finish, 5000);

    const onScroll = () => {
      if (saving) sessionStorage.setItem(storageKey, String(el.scrollTop));
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(settle);
      ro.disconnect();
      window.removeEventListener("load", restore);
      el.removeEventListener("scroll", onScroll);
    };
  }, [storageKey]);
  return ref;
}

// FPT Stitch Portal — deep blue sidebar, FPT logo brand,
// Material Symbols icons, logout pinned at the bottom
function StitchSidebarContent({ items, onNavigate }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navRef = useNavScrollMemory("nav_scroll_teacher");

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
            className="w-full max-w-50 rounded-md object-contain"
          />
        </div>
      </div>

      <nav
        ref={navRef}
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
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
          <span className="material-symbols-outlined text-[22px]!">logout</span>
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
  const navRef = useNavScrollMemory("nav_scroll_default");

  return (
    <div className="flex h-full flex-col bg-[#0F2747] p-4">
      <div className="flex shrink-0 justify-center px-2 py-3">
        <FptBrand />
      </div>

      <nav
        ref={navRef}
        className="no-scrollbar mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1.5"
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
  const isStitch = isStitchUser(user);

  const Content = isStitch ? StitchSidebarContent : SidebarContent;
  const widthClass = isStitch ? "w-[280px]" : "w-80";

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
