
function AppIconButton({
  icon: Icon,
  label,
  badge = false,
  onClick,
  className = "",
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`
        relative flex h-10 w-10 items-center justify-center
        rounded-xl text-[#0F2747]
        transition hover:bg-[#FFE7D6]
        ${className}
      `}
    >
      <Icon size={21} />

      {badge && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full border border-white bg-[#F27123]" />
      )}
    </button>
  );
}

export default AppIconButton;