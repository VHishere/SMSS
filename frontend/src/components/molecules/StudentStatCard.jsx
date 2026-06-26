function StudentStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "orange",
}) {
  const tones = {
    orange: "bg-orange-50 text-[#F27123]",
    blue: "bg-blue-50 text-[#08509F]",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    slate: "bg-slate-100 text-slate-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div
      className="
        rounded-2xl border border-orange-100
        bg-white p-5 shadow-sm
      "
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div
          className={`
            flex h-11 w-11 items-center
            justify-center rounded-full
            ${tones[tone] || tones.orange}
          `}
        >
          <Icon size={20} />
        </div>

        {hint && (
          <span className="text-xs font-medium text-slate-400">
            {hint}
          </span>
        )}
      </div>

      <p className="mb-1 text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mb-0 text-2xl font-bold text-[#0F2747]">
        {value ?? "—"}
      </p>
    </div>
  );
}

export default StudentStatCard;