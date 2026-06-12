import { NavLink } from "react-router-dom";

function SidebarMenuItem({
  to,
  label,
  icon: Icon,
  onClick,
  end = false,
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      style={{
        textDecoration: "none",
      }}
      className={({ isActive }) => `
        group flex items-center gap-3
        rounded-xl px-4 py-3
        text-sm font-semibold
        transition-colors duration-200

        ${
          isActive
            ? `
              bg-[#F27123]
              text-white
              shadow-md
              shadow-orange-950/20
            `
            : `
              text-blue-100
              hover:bg-white/10
              hover:text-white
            `
        }
      `}
    >
      <Icon
        size={20}
        className="shrink-0"
      />

      <span>{label}</span>
    </NavLink>
  );
}

export default SidebarMenuItem;