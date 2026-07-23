function FilterInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="
          rounded-xl border border-orange-100
          bg-white px-3 py-2
          text-sm font-semibold text-[#0F2747]
          shadow-sm outline-none
          focus:border-[#F27123]
          focus:ring-1 focus:ring-[#F27123]
        "
      />
    </label>
  );
}

export default FilterInput;