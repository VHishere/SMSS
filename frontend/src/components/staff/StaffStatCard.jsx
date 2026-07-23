function StaffStatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "orange",
}) {
  const accentClasses = {
    orange: "bg-[#FFF7F2] text-[#F27123]",
    blue: "bg-blue-50 text-[#08509F]",
    peach: "bg-[#FFE7D6]/70 text-[#0F2747]",
    navy: "bg-[#0F2747]/10 text-[#0F2747]",
  };

  return (
    <div className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-500">
            {label}
          </p>
          <p className="mb-0 text-3xl font-bold text-[#0F2747]">
            {value}
          </p>
        </div>

        {Icon && (
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-xl ${accentClasses[accent]}`}
          >
            <Icon size={22} />
          </div>
        )}
      </div>

      {hint && (
        <p className="mb-0 text-xs font-medium text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}

export default StaffStatCard;
