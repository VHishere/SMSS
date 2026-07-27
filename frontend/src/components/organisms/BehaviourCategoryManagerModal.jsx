import { useEffect, useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { adminApi } from "../../api/client";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", success: "#15803D", error: "#BA1A1A", surfaceLow: "#F3F3F3",
};

const emptyForm = { behaviorType: "POSITIVE", code: "", label: "", points: 10, affectsConductDefault: false };

function slugCode(label) {
  return label
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function CategoryTable({ title, rows, accent, pendingId, onEdit, onToggleStatus }) {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ border: `1px solid ${C.border}` }}>
      <div className="border-b px-4 py-2.5 text-sm font-bold" style={{ borderColor: C.border, color: accent, backgroundColor: C.surfaceLow }}>{title}</div>
      <div className="divide-y" style={{ borderColor: C.border }}>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Chưa có danh mục.</p>
        ) : rows.map((c) => (
          <div key={c.categoryId} className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ opacity: c.status === "ACTIVE" ? 1 : 0.5 }}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium" style={{ color: C.onSurface }}>{c.label}</p>
              {c.behaviorType === "VIOLATION" && c.affectsConductDefault && (
                <p className="text-[11px] text-slate-400">Ảnh hưởng hạnh kiểm</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: `${accent}1A`, color: accent }}>
                {c.behaviorType === "POSITIVE" ? "+" : "-"}{c.points}
              </span>
              <button type="button" onClick={() => onEdit(c)} className="rounded-full p-1.5 transition-colors hover:bg-[#F3F3F3]" style={{ color: C.secondary }} title="Sửa">
                <Ms name="edit" className="!text-[16px]" />
              </button>
              <button type="button" disabled={pendingId === c.categoryId} onClick={() => onToggleStatus(c)}
                className="rounded-full p-1.5 transition-colors hover:bg-[#F3F3F3] disabled:opacity-50" style={{ color: c.status === "ACTIVE" ? C.error : C.success }}
                title={c.status === "ACTIVE" ? "Ngừng áp dụng" : "Kích hoạt"}>
                <Ms name={c.status === "ACTIVE" ? "toggle_off" : "toggle_on"} className="!text-[20px]" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BehaviourCategoryManagerModal({ onClose }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingId, setPendingId] = useState(null);

  function load() {
    setLoading(true); setError("");
    adminApi.listBehaviourCategories()
      .then((res) => setCategories(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, []);

  function startEdit(cat) {
    setEditingId(cat.categoryId);
    setForm({ behaviorType: cat.behaviorType, code: cat.code, label: cat.label, points: cat.points, affectsConductDefault: cat.affectsConductDefault });
    setFormError("");
  }
  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.label.trim()) { setFormError("Nhập tên danh mục"); return; }
    const pts = Number(form.points);
    if (!Number.isInteger(pts) || pts <= 0) { setFormError("Mức điểm phải là số dương"); return; }

    setSaving(true); setFormError("");
    try {
      if (editingId) {
        await adminApi.updateBehaviourCategory(editingId, { label: form.label.trim(), points: pts, affectsConductDefault: form.affectsConductDefault });
      } else {
        await adminApi.createBehaviourCategory({
          code: form.code.trim() ? slugCode(form.code) : slugCode(form.label),
          behaviorType: form.behaviorType, label: form.label.trim(), points: pts,
          affectsConductDefault: form.affectsConductDefault,
        });
      }
      resetForm();
      load();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(cat) {
    const next = cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setPendingId(cat.categoryId);
    try {
      await adminApi.setBehaviourCategoryStatus(cat.categoryId, next);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const merits = categories.filter((c) => c.behaviorType === "POSITIVE");
  const violations = categories.filter((c) => c.behaviorType === "VIOLATION");
  const inputCls = "w-full rounded-xl border border-[#DFC0B2] px-3 py-2 text-sm text-[#1A1C1C] outline-none focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-xl" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Danh mục khen thưởng / vi phạm</h3>
            <p className="text-xs text-slate-500">Mức điểm cộng/trừ của từng danh mục — dùng làm căn cứ tính điểm hạnh kiểm.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-3 rounded-2xl p-4" style={{ backgroundColor: "rgba(242,113,35,0.05)", border: "1px solid rgba(242,113,35,0.2)" }}>
            <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: C.orange }}>{editingId ? "Sửa danh mục" : "Thêm danh mục"}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Loại</label>
                <select value={form.behaviorType} disabled={Boolean(editingId)} onChange={(e) => setForm((f) => ({ ...f, behaviorType: e.target.value }))} className={`${inputCls} disabled:bg-slate-100`}>
                  <option value="POSITIVE">Khen thưởng</option>
                  <option value="VIOLATION">Vi phạm</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Mức điểm <span className="text-red-500">*</span></label>
                <input type="number" min="1" step="1" value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Tên danh mục <span className="text-red-500">*</span></label>
              <input type="text" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="VD: Đi muộn, Giúp đỡ bạn bè..." className={inputCls} />
            </div>
            {form.behaviorType === "VIOLATION" && (
              <label className="flex items-center gap-2 text-sm" style={{ color: C.onSurface }}>
                <input type="checkbox" checked={form.affectsConductDefault} onChange={(e) => setForm((f) => ({ ...f, affectsConductDefault: e.target.checked }))} className="h-4 w-4 accent-[#DC2626]" />
                Mặc định ảnh hưởng xếp loại hạnh kiểm
              </label>
            )}
            {formError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{formError}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="rounded-full px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50" style={{ backgroundColor: C.orange }}>
                {saving ? "Đang lưu..." : editingId ? "Lưu thay đổi" : "Thêm danh mục"}
              </button>
              {editingId && (
                <button type="button" onClick={resetForm} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: C.border, color: C.muted }}>
                  Hủy
                </button>
              )}
            </div>
          </form>

          {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {loading ? (
            <div className="space-y-2">{[0, 1].map((n) => <div key={n} className="h-32 animate-pulse rounded-2xl bg-slate-200/60" />)}</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <CategoryTable title="Khen thưởng" rows={merits} accent={C.success} pendingId={pendingId} onEdit={startEdit} onToggleStatus={toggleStatus} />
              <CategoryTable title="Vi phạm" rows={violations} accent={C.error} pendingId={pendingId} onEdit={startEdit} onToggleStatus={toggleStatus} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BehaviourCategoryManagerModal;
