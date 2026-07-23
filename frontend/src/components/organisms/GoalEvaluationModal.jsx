import { useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { goalApi } from "../../api/client";

function GoalEvaluationModal({ goal, onClose, onSaved }) {
  const [status,       setStatus]       = useState("COMPLETED");
  const [finalComment, setFinalComment] = useState("");
  const [saving,       setSaving]       = useState(false);
  const [errorMsg,     setErrorMsg]     = useState("");

  async function handleSubmit() {
    if (!finalComment.trim()) { setErrorMsg("Đánh giá phải có nhận xét"); return; }
    setSaving(true);
    setErrorMsg("");
    try {
      await goalApi.evaluate(goal.goalId, { status, finalComment: finalComment.trim() });
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
            <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>Đánh giá mục tiêu</h3>
            <p className="truncate text-xs text-slate-500">{goal.title}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setStatus("COMPLETED")}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition"
            style={status === "COMPLETED" ? { backgroundColor: "#16A34A", color: "#fff" } : { backgroundColor: "#ECFDF5", color: "#16A34A" }}>
            <Ms name="check_circle" className="!text-[16px]" /> Hoàn thành
          </button>
          <button type="button" onClick={() => setStatus("FAILED")}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition"
            style={status === "FAILED" ? { backgroundColor: "#DC2626", color: "#fff" } : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
            <Ms name="cancel" className="!text-[16px]" /> Chưa đạt
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-600">Nhận xét cuối <span className="text-red-500">*</span></label>
          <textarea value={finalComment} onChange={(e) => setFinalComment(e.target.value)} rows={3}
            placeholder="Nhận xét về kết quả đạt được..." className={`${inputCls} resize-none`} />
        </div>

        {errorMsg && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-xl border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
            style={{ backgroundColor: status === "COMPLETED" ? "#16A34A" : "#DC2626" }}>
            {saving ? "Đang lưu..." : "Lưu đánh giá"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoalEvaluationModal;
