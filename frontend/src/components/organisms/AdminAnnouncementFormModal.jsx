import { useState } from "react";
import PrettySelect from "../molecules/PrettySelect";
function Ms({ name, className = "", style }) { return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>; }

import { adminApi } from "../../api/client";

const AUDIENCE_OPTIONS = [
  { value: "CLASS_ALL", label: "Tất cả (PH + HS)" },
  { value: "CLASS_PARENTS", label: "Phụ huynh" },
  { value: "CLASS_STUDENTS", label: "Học sinh" },
];

const SCOPE_OPTIONS = [
  { value: "SCHOOL", label: "Toàn trường", icon: "public" },
  { value: "GRADE", label: "Khối", icon: "layers" },
  { value: "CLASS", label: "Lớp", icon: "meeting_room" },
];

function toLocalInput(value) {
  return value ? value.replace(" ", "T").slice(0, 16) : "";
}

function nowLocalInput() {
  const p = (n) => String(n).padStart(2, "0");
  const d = new Date();
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function initialScope(announcement) {
  if (announcement?.classId) return "CLASS";
  if (announcement?.gradeId) return "GRADE";
  return "SCHOOL";
}

function AdminAnnouncementFormModal({ classes, grades, announcement = null, onClose, onSaved }) {
  const isEdit = Boolean(announcement);
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [content, setContent] = useState(announcement?.content ?? "");
  const [scope, setScope] = useState(initialScope(announcement));
  const [classId, setClassId] = useState(String(announcement?.classId ?? classes[0]?.classId ?? ""));
  const [gradeId, setGradeId] = useState(String(announcement?.gradeId ?? grades[0]?.gradeId ?? ""));
  const [audience, setAudience] = useState(announcement?.audience ?? "CLASS_ALL");
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(announcement?.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function payload(extra = {}) {
    return {
      title, content: content || null, audience,
      classId: scope === "CLASS" ? Number(classId) : null,
      gradeId: scope === "GRADE" ? Number(gradeId) : null,
      scheduledAt: scheduledAt ? scheduledAt.replace("T", " ") + ":00" : null,
      ...extra,
    };
  }

  async function save(publishNow) {
    if (!title.trim()) { setErrorMsg("Nhập tiêu đề"); return; }
    if (scope === "CLASS" && !classId) { setErrorMsg("Chọn lớp"); return; }
    if (scope === "GRADE" && !gradeId) { setErrorMsg("Chọn khối"); return; }
    if (publishNow && !content.trim()) { setErrorMsg("Nhập nội dung trước khi phát hành"); return; }
    if (!publishNow && scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) { setErrorMsg("Thời gian lên lịch phải ở tương lai"); return; }
    setBusy(true); setErrorMsg("");
    try {
      if (isEdit) {
        await adminApi.updateAnnouncement(announcement.announcementId, payload());
        if (publishNow) await adminApi.publishAnnouncement(announcement.announcementId);
      } else {
        await adminApi.createAnnouncement(payload({ publishNow }));
      }
      onSaved();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:border-[#225DAD] focus:ring-1 focus:ring-[#225DAD]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-xl" style={{ border: "1px solid #DFC0B2" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #DFC0B2" }}>
          <h3 className="text-base font-bold" style={{ color: "#1A1C1C" }}>{isEdit ? "Sửa thông báo" : "Soạn thông báo"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><Ms name="close" className="!text-[20px]" /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Lịch nghỉ lễ toàn trường" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nội dung</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Phạm vi</label>
            <div className="flex gap-2">
              {SCOPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setScope(o.value)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-all"
                  style={scope === o.value
                    ? { backgroundColor: "#F27123", borderColor: "#F27123", color: "#fff" }
                    : { backgroundColor: "#fff", borderColor: "#DFC0B2", color: "#584238" }}
                >
                  <Ms name={o.icon} className="!text-[16px]" /> {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {scope === "CLASS" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp</label>
                <PrettySelect value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </PrettySelect>
              </div>
            )}
            {scope === "GRADE" && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">Khối</label>
                <PrettySelect value={gradeId} onChange={(e) => setGradeId(e.target.value)} className={inputCls}>
                  {grades.map((g) => <option key={g.gradeId} value={g.gradeId}>{g.gradeName}</option>)}
                </PrettySelect>
              </div>
            )}
            <div className={scope === "SCHOOL" ? "col-span-2" : ""}>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Đối tượng</label>
              <PrettySelect value={audience} onChange={(e) => setAudience(e.target.value)} className={inputCls}>
                {AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </PrettySelect>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lên lịch (tùy chọn)</label>
            <input type="datetime-local" value={scheduledAt} min={nowLocalInput()} onChange={(e) => setScheduledAt(e.target.value)} className={inputCls} />
            <p className="mt-1 text-xs text-slate-400">Để trống = lưu nháp. Có thời gian = lên lịch tự phát hành.</p>
          </div>
          {errorMsg && <p className="rounded-3xl bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #DFC0B2" }}>
          <button type="button" onClick={() => save(false)} disabled={busy}
            className="flex-1 rounded-full border border-[#DFC0B2] py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {scheduledAt ? "Lưu & lên lịch" : "Lưu nháp"}
          </button>
          <button type="button" onClick={() => save(true)} disabled={busy}
            className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {busy ? "..." : "Phát hành ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminAnnouncementFormModal;
