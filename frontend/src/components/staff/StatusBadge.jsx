function StatusBadge({ value, tone = "success" }) {
  const tones = {
    success: "bg-emerald-50 text-emerald-700",
    info: "bg-blue-50 text-[#08509F]",
    warning: "bg-[#FFE7D6] text-[#F27123]",
    neutral: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {value}
    </span>
  );
}

export default StatusBadge;
