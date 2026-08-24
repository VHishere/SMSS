import { NavLink } from "react-router-dom";

function SidebarMenuItem({
  to,
  label,
  icon: Icon,
  msIcon,
  onClick,
  end = false,
  variant = "default",
  collapsed = false,
}) {
  // data-menu-item: để hook auto-collapse biết đây là mục điều hướng (bấm để đi,
  // KHÔNG đổi trạng thái thu gọn). title: tooltip khi đang thu gọn (chỉ còn icon).
  const common = {
    to,
    end,
    onClick,
    "data-menu-item": true,
    title: collapsed ? label : undefined,
    style: { textDecoration: "none" },
  };

  if (variant === "stitch") {
    // FSchool Stitch: active = pill cam bo tròn; inactive = hàng trên nền xanh đậm
    return (
      <NavLink
        {...common}
        className={({ isActive }) => `
          flex items-center gap-3 overflow-hidden px-4 py-3
          text-sm transition-all duration-200
          ${collapsed ? "justify-center" : ""}
          ${
            isActive
              ? "mx-2 rounded-full bg-[#F27123] font-bold text-white shadow-md"
              : "text-white hover:bg-[#00458E]/50 hover:text-white"
          }
        `}
      >
        {msIcon ? (
          <span className="material-symbols-outlined shrink-0 text-[22px]!">
            {msIcon}
          </span>
        ) : (
          <Icon size={19} className="shrink-0" />
        )}

        {/* whitespace-nowrap: khi sidebar đang mở rộng (chiều rộng còn đang chạy
            animation) nhãn KHÔNG được xuống dòng, nếu không menu sẽ cao vọt lên
            rồi bật lại — nhìn như trang bị reload. */}
        {!collapsed && (
          <span className="whitespace-nowrap">{label}</span>
        )}
      </NavLink>
    );
  }

  return (
    <NavLink
      {...common}
      className={({ isActive }) => `
        group flex items-center gap-3 overflow-hidden
        rounded-xl px-4 py-3
        text-sm font-semibold
        transition-colors duration-200
        ${collapsed ? "justify-center" : ""}
        ${
          isActive
            ? "bg-[#F27123] text-white shadow-md shadow-orange-950/20"
            : "text-blue-100 hover:bg-white/10 hover:text-white"
        }
      `}
    >
      <Icon size={20} className="shrink-0" />

      {!collapsed && (
        <span className="whitespace-nowrap">{label}</span>
      )}
    </NavLink>
  );
}

export default SidebarMenuItem;
