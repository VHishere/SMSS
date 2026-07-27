import { NavLink } from "react-router-dom";

function SidebarMenuItem({
  to,
  label,
  icon: Icon,
  msIcon,
  onClick,
  end = false,
  variant = "default",
}) {
  if (variant === "stitch") {
    // FSchool Teacher Portal (Stitch design): active = orange pill inset,
    // inactive = full-bleed row on deep blue, Material Symbols icons
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onClick}
        style={{ textDecoration: "none" }}
        className={({ isActive }) => `
          flex items-center gap-3 px-4 py-3
          text-sm transition-all duration-200

          ${
            isActive
              ? `
                mx-2 rounded-xl bg-[#F27123]
                font-bold text-white shadow-md
              `
              : `
                text-white hover:bg-[#00458E]/50
                hover:text-white
              `
          }
        `}
      >
        {msIcon ? (
          <span className="material-symbols-outlined shrink-0 text-[22px]!">
            {msIcon}
          </span>
        ) : (
          <Icon
            size={19}
            className="shrink-0"
          />
        )}

        <span>{label}</span>
      </NavLink>
    );
  }

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