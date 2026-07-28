import { Children, useEffect, useRef, useState } from "react";

// Dropdown tuỳ biến thay cho <select> native (không bo tròn/style được).
// DROP-IN: nhận <option> children + phát onChange({ target: { value } }) như select
// gốc → thay thế chỉ cần đổi tên thẻ, giữ nguyên value/onChange/logic lọc.
//
// Panel bo 16px + shadow, rộng ≥ nút; option bo 12px, hover xám, mục chọn tô cam
// + dấu ✓; mũi tên xoay khi mở; đóng khi chọn / bấm ngoài / Esc.

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD" };

function optionText(node) {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(optionText).join("");
  if (node.props && node.props.children != null) return optionText(node.props.children);
  return "";
}

function PrettySelect({
  value,
  onChange,
  children,
  options,
  className = "",
  icon,
  placeholder = "— Chọn —",
  disabled = false,
  title,
  required = false,
  name,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, [open]);

  // Nguồn options: prop `options` [{value,label,disabled}] hoặc parse từ <option> children
  const opts = options ?? Children.toArray(children)
    .filter((c) => c && c.type === "option")
    .map((c) => ({ value: c.props.value ?? "", label: optionText(c.props.children), disabled: c.props.disabled }));

  const selected = opts.find((o) => String(o.value) === String(value));
  // Chỉ đọc className để suy ra bề rộng (giữ w-full nếu select cũ có) — KHÔNG áp
  // các class cũ (rounded/border/px…) để tránh vẽ khung đôi quanh pill.
  const fullWidth = /\bw-full\b/.test(className);

  function pick(v) {
    // Phát sự kiện giống <select> gốc để onChange cũ (e.target.value) chạy nguyên
    onChange?.({ target: { value: String(v) } });
    setOpen(false);
  }

  return (
    <div ref={ref} className={`relative ${fullWidth ? "w-full" : "inline-block"}`} title={title}>
      {/* Bản sao <select> native ẩn: giữ lại validation "bắt buộc chọn" của form
          (PrettySelect vẽ bằng <button> nên tự nó không tham gia constraint
          validation). Không dùng display:none / visibility:hidden vì Chrome sẽ
          chặn submit kèm lỗi "not focusable" — dùng opacity 0 + 1px. */}
      {required && (
        <select
          required
          name={name}
          value={value ?? ""}
          onChange={() => {}}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px border-0 p-0 opacity-0"
        >
          <option value="" />
          {opts.map((o, i) => (
            <option key={i} value={o.value} />
          ))}
        </select>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center gap-2 rounded-full border bg-white pl-4 pr-2.5 text-sm font-medium shadow-sm outline-none transition-colors hover:border-[#F27123] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderColor: open ? C.orange : C.border, color: C.onSurface, boxShadow: open ? "0 0 0 3px rgba(242,113,35,0.15)" : undefined }}
      >
        {icon && <span className="material-symbols-outlined shrink-0 !text-[18px]" style={{ color: C.secondary }}>{icon}</span>}
        <span className="min-w-0 flex-1 truncate text-left">{selected?.label ?? placeholder}</span>
        <span className={`material-symbols-outlined shrink-0 !text-[20px] text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}>expand_more</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-[calc(100%+6px)] z-30 max-h-64 w-full min-w-[10rem] overflow-y-auto rounded-2xl border bg-white p-1 shadow-lg"
          style={{ borderColor: C.border }}
          role="listbox"
        >
          {opts.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">Không có lựa chọn</div>}
          {opts.map((o, i) => {
            const active = String(o.value) === String(value);
            if (o.disabled) {
              return <div key={i} className="cursor-not-allowed px-3 py-2 text-sm text-slate-300">{o.label}</div>;
            }
            return (
              <button
                key={i}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => pick(o.value)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-[#F3F3F3]"
                style={active ? { backgroundColor: "rgba(242,113,35,0.1)", color: C.orange, fontWeight: 700 } : { color: C.onSurface }}
              >
                <span className="truncate">{o.label}</span>
                {active && <span className="material-symbols-outlined shrink-0 !text-[18px]" style={{ color: C.orange }}>check</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PrettySelect;
