import { useState } from "react";
import { FiX } from "react-icons/fi";

import { announcementApi } from "../../api/client";

const AUDIENCE_OPTIONS = [
  { value: "CLASS_ALL", label: "Cả lớp (PH + HS)" },
  { value: "CLASS_PARENTS", label: "Phụ huynh" },
  { value: "CLASS_STUDENTS", label: "Học sinh" },
];

function toLocalInput(value) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

function AnnouncementFormModal({ classes, announcement = null, onClose, onSaved }) {
  const isEdit = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");
  const [classId, setClassId] = useState(String(announcement?.classId ?? classes[0]?.classId ?? ""));
  const [audience, setAudience] = useState(announcement?.audience ?? "CLASS_ALL");
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(announcement?.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function payload(extra = {}) {
    return {
      title, content: content || null, audience, classId: Number(classId),
      scheduledAt: scheduledAt ? scheduledAt.replace("T", " ") + ":00" : null, ...extra,
    };
  }

  async function save(publishNow) {
    if (!title.trim()) { setErrorMsg("Nhập tiêu đề"); return; }
    if (!classId) { setErrorMsg("Chọn lớp"); return; }
    setBusy(true); setErrorMsg("");
    try {
      if (isEdit) {
        await announcementApi.update(announcement.announcementId, payload());
        if (publishNow) await announcementApi.publish(announcement.announcementId);
      } else {
        await announcementApi.create(payload({ publishNow }));
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{isEdit ? "Sửa thông báo" : "Tạo thông báo"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch họp phụ huynh" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nội dung</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Đối tượng</label>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
                {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lên lịch (tùy chọn)</label>
            <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">Để trống = lưu nháp. Có thời gian = lên lịch tự phát hành.</p>
          </div>
          {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={() => save(false)} disabled={busy}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {scheduledAt ? "Lưu & lên lịch" : "Lưu nháp"}
          </button>
          <button type="button" onClick={() => save(true)} disabled={busy}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {busy ? "..." : "Phát hành ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AnnouncementFormModal;
