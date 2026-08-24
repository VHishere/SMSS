import PrettySelect from "../molecules/PrettySelect";

// Bộ lọc dạng "nhãn + dropdown". Dropdown dùng PrettySelect (pill bo tròn) cho
// giống toàn hệ thống — không dùng select native vì không style được panel.
// Dùng <div> thay <label>: PrettySelect render <button>, nếu bọc trong <label>
// thì click vào nhãn sẽ vừa đóng vừa mở lại dropdown.
function FilterSelect({ label, value, onChange, children }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-slate-500">
      {label}

      <PrettySelect value={value} onChange={onChange} title={label}>
        {children}
      </PrettySelect>
    </div>
  );
}

export default FilterSelect;
