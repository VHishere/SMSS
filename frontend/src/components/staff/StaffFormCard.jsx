function StaffFormCard({
  title,
  children,
  onSubmit,
  submitLabel = "Lưu",
  loading = false,
  footer,
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="overflow-hidden rounded-3xl border border-[#DFC0B2] bg-white shadow-sm"
    >
      {title && (
        <div className="border-b border-[#F1DED4] bg-[#FFF7F2]/50 px-4 py-4 sm:px-6">
          <h3 className="mb-0 text-lg font-bold text-[#1A1C1C]">{title}</h3>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2">
        {children}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-[#F1DED4] bg-[#F9F9F9] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0 text-sm text-slate-500">{footer}</div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#F27123] px-6 text-sm font-semibold text-white transition hover:bg-[#E55C0A] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {loading ? "Đang lưu..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export function StaffField({ label, children, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-sm font-semibold text-[#1A1C1C] ${className}`}>
      <span className="break-words">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-2xl border border-[#DFC0B2] bg-[#F9F9F9] px-3 py-2.5 text-sm font-normal text-[#1A1C1C] outline-none transition placeholder:text-slate-400 focus:border-[#F27123] focus:bg-white focus:ring-2 focus:ring-[#F27123]/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

export const cancelLinkClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[#DFC0B2] bg-white px-4 text-sm font-semibold text-[#08509F] no-underline transition hover:border-[#08509F] hover:bg-blue-50 hover:text-[#08509F] hover:no-underline sm:w-auto";

export const primaryActionClass =
  "inline-flex h-11 w-full items-center justify-center rounded-full bg-[#F27123] px-5 text-sm font-semibold text-white transition hover:bg-[#E55C0A] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

export const checkboxClass =
  "h-5 w-5 rounded border-[#DFC0B2] text-[#F27123] accent-[#F27123]";

export default StaffFormCard;
