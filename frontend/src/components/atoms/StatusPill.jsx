function StatusPill({ children, tone = "slate" }) {
  const tones = {
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`
        inline-flex rounded-full px-3 py-1
        text-xs font-bold
        ${tones[tone] || tones.slate}
      `}
    >
      {children}
    </span>
  );
}

export default StatusPill;