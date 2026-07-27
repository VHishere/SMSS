import { useRef, useState } from "react";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { behaviourApi, homeworkApi } from "../../api/client";

function toLocalDate(value) {
  if (!value) return "";
  return value.slice(0, 10);
}

function todayLocal() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * mode: "create" | "edit"
 * behaviorType: "POSITIVE" | "VIOLATION"
 * students: [{ studentId, studentName, studentCode }]  (create mode)
 * record: existing record (edit mode)
 */
function BehaviourRecordModal({ mode, behaviorType, students = [], record = null, categories = [], api = behaviourApi, onClose, onSaved }) {
  const isEdit = mode === "edit";
  const type = isEdit ? record.behaviorType : behaviorType;
  const isMerit = type === "POSITIVE";

  const [studentId,    setStudentId]    = useState(record?.studentId ?? (students[0]?.studentId ?? ""));
  const [title,        setTitle]        = useState(record?.title ?? "");
  const [category,     setCategory]     = useState(record?.category ?? "");
  const [points,       setPoints]       = useState(record?.points ?? (isMerit ? 5 : 2));
  const [severityLevel, setSeverityLevel] = useState(record?.severityLevel ?? "LOW");
  const [affectsConduct, setAffectsConduct] = useState(record?.affectsConduct ?? false);
  const [recordDate,   setRecordDate]   = useState(toLocalDate(record?.recordDate) || new Date().toISOString().slice(0, 10));
  const [description,  setDescription]  = useState(record?.description ?? "");
  const [evidence,     setEvidence]     = useState(record?.evidenceUrl ? { fileUrl: record.evidenceUrl, fileName: "Minh chứng" } : null);

  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [errorMsg,  setErrorMsg]  = useState("");
  const fileRef = useRef(null);

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const res = await homeworkApi.uploadAttachment(file);
      setEvidence({ fileUrl: res.data.fileUrl, fileName: res.data.fileName });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function validate() {
    if (!isEdit && !studentId) return "Vui lòng chọn học sinh";
    if (!title.trim()) return "Tiêu đề là bắt buộc";
    if (!category) return "Vui lòng chọn danh mục";
    const p = Number(points);
    if (!Number.isInteger(p) || p <= 0) return "Điểm phải là số nguyên dương";
    if (!recordDate) return "Vui lòng chọn ngày";
    if (recordDate > todayLocal()) return "Ngày ghi nhận không được ở tương lai";
    return "";
  }

  async function handleSubmit() {
    const v = validate();
    if (v) { setErrorMsg(v); return; }

    setSaving(true);
    setErrorMsg("");
    try {
      const body = {
        title: title.trim(),
        category: category || null,
        points: Number(points),
        severityLevel: isMerit ? "LOW" : severityLevel,
        affectsConduct: isMerit ? false : affectsConduct,
        recordDate,
        description: description.trim() || null,
        evidenceUrl: evidence?.fileUrl ?? null,
      };
      if (isEdit) {
        await api.updateRecord(record.behaviorId, body);
      } else {
        await api.createRecord({ ...body, studentId: Number(studentId), behaviorType: type });
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setSaving(false);
    }
  }

  const accent = isMerit ? "#16A34A" : "#DC2626";
  const inputCls =
    "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #DFC0B2" }}>
          <h3 className="text-base font-bold" style={{ color: accent }}>
            {isEdit ? "Chỉnh sửa" : isMerit ? "Thêm khen thưởng" : "Ghi nhận vi phạm"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {!isEdit ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Học sinh <span className="text-red-500">*</span></label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
                <option value="">— Chọn học sinh —</option>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName} ({s.studentCode})</option>)}
              </select>
            </div>
          ) : (
            <div className="rounded-3xl px-3 py-2 text-sm" style={{ backgroundColor: "#F3F3F3", border: "1px solid #DFC0B2", color: "#1A1C1C" }}>
              {record.studentName} · {record.studentCode}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={isMerit ? "Ví dụ: Đạt giải học sinh giỏi" : "Ví dụ: Đi muộn giờ học"} className={inputCls} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Danh mục <span className="text-red-500">*</span></label>
            <select value={category} onChange={(e) => {
              const nextCategory = e.target.value;
              setCategory(nextCategory);
              const match = categories.find((c) => c.key === nextCategory);
              if (match?.points) setPoints(match.points);
            }} className={inputCls}>
              <option value="">— Chọn danh mục —</option>
              {categories.map((c) => <option key={c.key} value={c.key}>{c.label} ({isMerit ? "+" : "-"}{c.points})</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                {isMerit ? "Điểm thưởng" : "Điểm trừ"} <span className="text-red-500">*</span>
              </label>
              <input type="number" min="1" step="1" value={points} onChange={(e) => setPoints(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Ngày <span className="text-red-500">*</span></label>
              <input type="date" value={recordDate} max={todayLocal()} onChange={(e) => setRecordDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          {!isMerit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Mức độ</label>
              <select value={severityLevel} onChange={(e) => setSeverityLevel(e.target.value)} className={inputCls}>
                <option value="LOW">Nhẹ</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="HIGH">Nghiêm trọng</option>
              </select>
              <label className="mt-2.5 flex items-start gap-2 text-sm" style={{ color: "#1A1C1C" }}>
                <input type="checkbox" checked={affectsConduct} onChange={(e) => setAffectsConduct(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#DC2626]" />
                <span>
                  Vi phạm này <b>ảnh hưởng xếp loại hạnh kiểm</b>
                  <span className="mt-0.5 block text-xs text-slate-400">Chỉ tick với vi phạm nghiêm trọng (đánh nhau, hút thuốc…). Đi muộn/vi phạm nhẹ chỉ ghi nhận thống kê.</span>
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Ghi chú</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Mô tả chi tiết..." className={`${inputCls} resize-none`} />
          </div>

          {/* Evidence (mainly for violations, but allowed for both) */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Minh chứng (tùy chọn)</label>
            {evidence ? (
              <div className="flex items-center gap-2 rounded-3xl px-3 py-2 text-sm" style={{ border: "1px solid #DFC0B2" }}>
                <Ms name="attach_file" className="!text-[14px]" style={{ color: "#225DAD" }} />
                <a href={evidence.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium" style={{ color: "#225DAD" }}>
                  {evidence.fileName}
                </a>
                <button type="button" onClick={() => setEvidence(null)} className="text-xs text-slate-400 hover:text-red-600">Xóa</button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full rounded-3xl border-2 border-dashed py-2.5 text-xs disabled:opacity-50"
                style={{ borderColor: "#DFC0B2", backgroundColor: "#F3F3F3", color: "#1A1C1C" }}>
                {uploading ? "Đang tải lên..." : "Nhấn để tải minh chứng"}
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />
          </div>

          {errorMsg && <p className="rounded-3xl bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #DFC0B2" }}>
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 rounded-full border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
            Hủy
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: accent }}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default BehaviourRecordModal;
