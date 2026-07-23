import { useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { academicApi } from "../../api/client";

const STATUS_OPTIONS = [
  { value: "OPEN",        label: "Mở" },
  { value: "IN_PROGRESS", label: "Đang can thiệp" },
  { value: "RESOLVED",    label: "Đã xử lý" },
];

function WarningInterventionModal({ warning, onClose, onSaved }) {
  const [note,         setNote]         = useState(warning.note ?? "");
  const [intervention, setIntervention] = useState(warning.intervention ?? "");
  const [status,       setStatus]       = useState(warning.status ?? "OPEN");
  const [saving,       setSaving]       = useState(false);
  const [errorMsg,     setErrorMsg]     = useState("");

  async function handleSubmit() {
    if (!intervention.trim()) {
      setErrorMsg("Vui lòng nhập hành động can thiệp");
      return;
    }
    setSaving(true);
    setErrorMsg("");
    try {
      await academicApi.updateWarning(warning.warningId, {
        note: note.trim() || null,
        intervention: intervention.trim(),
        status,
      });
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>Can thiệp cảnh báo</h3>
            <p className="text-xs text-slate-500">{warning.studentName} · {warning.className ?? "—"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="mb-4 space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Ghi chú</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              placeholder="Ghi chú về tình hình học sinh..." className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Hành động can thiệp <span className="text-red-500">*</span>
            </label>
            <textarea value={intervention} onChange={(e) => setIntervention(e.target.value)} rows={3}
              placeholder="Ví dụ: Gặp phụ huynh, kèm cặp thêm môn Toán..." className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Trạng thái</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {errorMsg && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: "#F27123" }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WarningInterventionModal;
