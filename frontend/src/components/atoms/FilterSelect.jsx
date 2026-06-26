function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}

      <select
        value={value}
        onChange={onChange}
        className="
          rounded-xl border border-orange-100
          bg-white px-3 py-2
          text-sm font-semibold text-[#0F2747]
          shadow-sm outline-none
          focus:border-[#F27123]
          focus:ring-1 focus:ring-[#F27123]
        "
      >
        {children}
      </select>
    </label>
  );
}

export default FilterSelect;