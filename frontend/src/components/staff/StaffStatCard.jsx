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
    <div className="rounded-3xl border border-[#DFC0B2] bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        {/* Cỡ chữ theo chuẩn thẻ tổng quan của teacher: nhãn 12px in hoa,
            số text-5xl (48px). break-words để giá trị dạng chữ (vd "2025-2026")
            xuống dòng thay vì tràn ra ngoài thẻ. */}
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-[#584238]">
            {label}
          </p>
          <p className="mb-0 text-5xl font-bold leading-none tracking-tight break-words text-[#1A1C1C]">
            {value}
          </p>
        </div>

        {Icon && (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClasses[accent]}`}
          >
            <Icon size={22} />
          </div>
        )}
      </div>

      {hint && (
        <p className="mb-0 text-xs font-medium text-[#584238]">
          {hint}
        </p>
      )}
    </div>
  );
}

export default StaffStatCard;
