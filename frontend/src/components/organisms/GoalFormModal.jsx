import { useState } from "react";
import PrettySelect from "../molecules/PrettySelect";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { goalApi } from "../../api/client";

function toLocalDate(value) {
  return value ? value.slice(0, 10) : "";
}

function todayLocal() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * mode: "create" | "edit"
 * studentId required for create. goal required for edit.
 * goalTypes: [{ key, label }]
 */
function GoalFormModal({ mode, studentId, goal = null, goalTypes = [], onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [goalType,      setGoalType]      = useState(goal?.goalType ?? (goalTypes[0]?.key ?? "ACADEMIC"));
  const [title,         setTitle]         = useState(goal?.title ?? "");
  const [description,   setDescription]   = useState(goal?.description ?? "");
  const [targetDate,    setTargetDate]    = useState(toLocalDate(goal?.targetDate));
  const [teacherRemark, setTeacherRemark] = useState(goal?.teacherRemark ?? "");

  const [saving,   setSaving]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function validate() {
    if (!title.trim()) return "Tiêu đề mục tiêu là bắt buộc";
    if (!goalType) return "Loại mục tiêu là bắt buộc";
    if (!targetDate) return "Hạn hoàn thành là bắt buộc";
    if (targetDate < todayLocal()) return "Hạn hoàn thành phải từ hôm nay trở đi";
    return "";
  }

  async function handleSubmit() {
    const v = validate();
    if (v) { setErrorMsg(v); return; }

    setSaving(true);
    setErrorMsg("");
    try {
      const body = { goalType, title: title.trim(), description: description.trim() || null, targetDate: targetDate || null, teacherRemark: teacherRemark.trim() || null };
      if (isEdit) await goalApi.update(goal.goalId, body);
      else await goalApi.create(studentId, body);
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
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #DFC0B2" }}>
          <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>{isEdit ? "Chỉnh sửa mục tiêu" : "Tạo mục tiêu mới"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Loại mục tiêu <span className="text-red-500">*</span></label>
            <PrettySelect value={goalType} onChange={(e) => setGoalType(e.target.value)} className={inputCls}>
              {goalTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </PrettySelect>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ví dụ: Đạt điểm Toán trên 8.0" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Chi tiết mục tiêu..." className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Hạn hoàn thành <span className="text-red-500">*</span></label>
            <input type="date" value={targetDate} min={todayLocal()} onChange={(e) => setTargetDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Ghi chú của giáo viên</label>
            <textarea value={teacherRemark} onChange={(e) => setTeacherRemark(e.target.value)} rows={2} placeholder="Định hướng / lời khuyên..." className={`${inputCls} resize-none`} />
          </div>

          {errorMsg && <p className="rounded-3xl bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #DFC0B2" }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-full border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {saving ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo mục tiêu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GoalFormModal;
