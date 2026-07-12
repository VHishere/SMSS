function StaffFormCard({ title, children, onSubmit, submitLabel = "Lưu", loading = false }) {
  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-orange-100 bg-white p-6 shadow-sm"
    >
      {title && (
        <h3 className="mb-5 text-lg font-bold text-[#0F2747]">{title}</h3>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-[#F27123] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "Đang lưu..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function StaffField({ label, children, className = "" }) {
  return (
    <label className="text-sm font-semibold text-[#0F2747]">
      <div className={`flex flex-col gap-3 ${className}`}>
        <span>{label}</span>
        {children}
      </div>
    </label>
  );
}

export const inputClass =
  "rounded-xl border border-slate-200 bg-[#FFF7F2] px-3 py-2.5 text-sm font-normal text-[#0F2747] outline-none focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20";

export default StaffFormCard;
