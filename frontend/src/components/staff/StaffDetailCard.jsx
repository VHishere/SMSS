function StaffDetailCard({ title, children }) {
  return (
    <section className="rounded-3xl border border-[#DFC0B2] bg-white p-4 shadow-sm sm:p-6">
      <h3 className="mb-4 text-base font-bold text-[#1A1C1C]">{title}</h3>
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
      <p className="mb-0 text-sm font-medium text-[#1A1C1C]">{value || "—"}</p>
    </div>
  );
}

export default StaffDetailCard;
