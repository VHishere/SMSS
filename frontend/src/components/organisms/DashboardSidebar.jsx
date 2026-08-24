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
function StitchSidebarContent({
  items,
  onNavigate,
  collapsed = false,
  scrollStorageKey = "nav_scroll_stitch",
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const navRef = useNavScrollMemory(scrollStorageKey);

  function handleLogout() {
    logout();
    navigate("/login/school", { replace: true });
  }

  return (
    <div className="flex h-full flex-col bg-[#00458E] py-6">
      {/* Khối logo giữ CHIỀU CAO CỐ ĐỊNH (h-20) ở cả 2 trạng thái — nếu để cao
          theo nội dung thì logo vuông (thu gọn) thấp hơn logo chữ (mở rộng),
          làm toàn bộ menu bị nhảy lên/xuống mỗi lần thu gọn - mở lại. */}
      <div className={`shrink-0 pb-8 ${collapsed ? "px-2" : "px-6"}`}>
        <div className="flex h-20 items-center justify-center">
          {collapsed ? (
            <img
              src="/logo-fpt-schools.png"
              alt="FPT Schools"
              className="h-14 w-14 rounded-lg object-contain"
            />
          ) : (
            /* Kích thước TUYỆT ĐỐI + max-w-none: giữ đúng 200x64 như cũ và
               không bị bóp méo khi sidebar đang chạy animation mở ra
               (max-w-none để không bị quy tắc max-width:100% toàn cục ép nhỏ). */
            <img
              src={fptLogo}
              alt="FPT Education Logo"
              className="h-16 w-[200px] max-w-none shrink-0 rounded-md object-contain"
            />
          )}
        </div>
      </div>

      <nav
        ref={navRef}
        className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto"
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
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className={`mt-auto shrink-0 pt-4 ${collapsed ? "px-2" : "px-6"}`}>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? "Đăng xuất" : undefined}
          className={`flex w-full items-center gap-3 overflow-hidden rounded-full px-4 py-3 text-white transition-colors hover:bg-[#BA1A1A]/20 hover:text-[#FFDAD6] ${collapsed ? "justify-center" : ""}`}
        >
          <span className="material-symbols-outlined shrink-0 text-[22px]!">logout</span>
          {!collapsed && (
            <span className="text-sm whitespace-nowrap">Đăng xuất</span>
          )}
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
  collapsed = false,
  scrollStorageKey = "nav_scroll_default",
}) {
  const navRef = useNavScrollMemory(scrollStorageKey);

  return (
    <div className="flex h-full flex-col bg-[#0F2747] p-4">
      {/* Chiều cao cố định (h-12 = đúng chiều cao logo trong FptBrand) để menu
          không bị nhảy khi thu gọn - mở lại sidebar. */}
      <div className="flex shrink-0 justify-center px-2 py-3">
        <div className="flex h-12 w-full items-center justify-center">
          {collapsed ? (
            <img
              src="/logo-fpt-schools.png"
              alt="FPT Schools"
              className="h-12 w-12 rounded-lg object-contain"
            />
          ) : (
            <FptBrand />
          )}
        </div>
      </div>

      <nav
        ref={navRef}
        className="no-scrollbar mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-x-hidden overflow-y-auto pr-1.5"
      >
        {items.map((item) => (
          <SidebarMenuItem
            key={item.path}
            to={item.path}
            label={item.label}
            icon={item.icon}
            end={item.end}
            onClick={onNavigate}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* truncate (nowrap + cắt bớt): khi sidebar đang chạy animation mở ra, chữ
          trong footer KHÔNG được xuống dòng — nếu wrap thì footer cao lên, ép
          vùng menu co lại rồi bật về, nhìn như trang bị nhảy. */}
      {footerValue && !collapsed && (
        <div className="mt-6 shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
          {footerLabel && (
            <p className="mb-1 truncate text-xs text-blue-200">
              {footerLabel}
            </p>
          )}

          <div className="truncate font-bold text-white">
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
  collapsed = false,
  sidebarRef,
  onSidebarMouseDown,
  variant = "auto",
}) {
  const { user } = useAuth();

  const roleNames =
    user?.roles?.map((role) =>
      typeof role === "string" ? role : role.roleName
    ) || [];

  const isStudent = roleNames.includes("STUDENT");
  const isStitch =
    variant === "stitch" ||
    (variant === "auto" && isStitchUser(user));

  const Content = isStitch ? StitchSidebarContent : SidebarContent;
  const scrollStorageKey = isStudent
    ? "nav_scroll_student"
    : "nav_scroll_stitch";

  const desktopWidthClass = isStitch
    ? "w-[280px]"
    : "w-80";

  const mobileWidthClass = isStitch
    ? "!w-[min(88vw,280px)]"
    : "!w-[min(88vw,320px)]";

  return (
    <>
      {/* Desktop sidebar — thu gọn còn 76px khi collapsed */}
      <aside
        ref={sidebarRef}
        onMouseDown={onSidebarMouseDown}
        className={`fixed inset-y-0 left-0 z-40 hidden overflow-hidden transition-[width] duration-500 ease-in-out lg:block ${collapsed ? "w-[76px]" : desktopWidthClass}`}
      >
        <Content
          items={items}
          footerLabel={footerLabel}
          footerValue={footerValue}
          scrollStorageKey={scrollStorageKey}
          collapsed={collapsed}
        />
      </aside>

      {/* Mobile sidebar — luôn đầy đủ (không thu gọn) */}
      <Offcanvas
        show={showMobile}
        onHide={onCloseMobile}
        placement="start"
        className={`border-0 ${mobileWidthClass}`}
      >
        <Offcanvas.Body className="p-0">
          <Content
            items={items}
            footerLabel={footerLabel}
            footerValue={footerValue}
            onNavigate={onCloseMobile}
            collapsed={false}
            scrollStorageKey={scrollStorageKey}
          />
        </Offcanvas.Body>
      </Offcanvas>
    </>
  );
}

export default DashboardSidebar;