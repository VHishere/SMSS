function StaffDetailCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-bold text-[#0F2747]">{title}</h3>
      {children}
    </section>
  );
}

export function StaffDetailItem({ label, value }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      <p className="mb-0 text-sm font-medium text-[#0F2747]">{value || "—"}</p>
    </div>
  );
}

export default StaffDetailCard;
