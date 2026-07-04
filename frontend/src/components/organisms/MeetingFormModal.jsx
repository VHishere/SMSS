import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";

import { meetingApi } from "../../api/client";

const TYPES = [
  { value: "CLASS", label: "Họp lớp" },
  { value: "INDIVIDUAL", label: "Họp cá nhân" },
];

function toLocalInput(value) { return value ? value.replace(" ", "T").slice(0, 16) : ""; }

/**
 * mode: "create" | "edit"
 * classes: [{ classId, className }]
 * meeting: existing (edit)
 */
function MeetingFormModal({ mode, classes = [], meeting = null, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(meeting?.title ?? "");
  const [meetingType, setMeetingType] = useState(meeting?.meetingType ?? "CLASS");
  const [classId, setClassId] = useState(String(meeting?.classId ?? classes[0]?.classId ?? ""));
  const [studentId, setStudentId] = useState(String(meeting?.studentId ?? ""));
  const [meetingDate, setMeetingDate] = useState(toLocalInput(meeting?.meetingDate));
  const [endTime, setEndTime] = useState(toLocalInput(meeting?.endTime));
  const [location, setLocation] = useState(meeting?.location ?? "");
  const [content, setContent] = useState(meeting?.content ?? "");

  const [parents, setParents] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // load parents for invite (create only) + student options
  useEffect(() => {
    if (!classId) return;
    let m = true;
    meetingApi.getClassParents(classId).then((res) => { if (m) setParents(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [classId]);

  const studentOptions = useMemo(() => {
    const map = {};
    for (const p of parents) map[p.studentId] = p.studentName;
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [parents]);

  function toggle(userId, sId) {
    setSelected((prev) => {
      const next = new Set(prev);
      const key = `${userId}::${sId ?? ""}`;
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function selectedInvitees() {
    return [...selected].map((k) => {
      const [userId, sId] = k.split("::");
      return { userId: Number(userId), studentId: sId ? Number(sId) : null };
    });
  }

  async function handleSubmit() {
    if (!title.trim()) { setErrorMsg("Nhập tiêu đề"); return; }
    if (!meetingDate) { setErrorMsg("Chọn thời gian họp"); return; }
    if (!classId) { setErrorMsg("Chọn lớp"); return; }
    if (meetingType === "INDIVIDUAL" && !studentId) { setErrorMsg("Họp cá nhân cần chọn học sinh"); return; }
    if (endTime && new Date(endTime) <= new Date(meetingDate)) { setErrorMsg("Thời gian kết thúc phải sau thời gian bắt đầu"); return; }
    if (!isEdit && selected.size === 0) { setErrorMsg("Chọn ít nhất một người tham dự"); return; }

    setBusy(true); setErrorMsg("");
    try {
      const body = {
        title: title.trim(), meetingType, classId: Number(classId),
        studentId: studentId ? Number(studentId) : null,
        meetingDate, endTime: endTime || null, location: location || null, content: content || null,
      };
      if (isEdit) {
        await meetingApi.update(meeting.meetingId, body);
      } else {
        await meetingApi.create({ ...body, invitees: selectedInvitees() });
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
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{isEdit ? "Sửa cuộc họp" : "Tạo cuộc họp"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Họp phụ huynh giữa kỳ 2" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Loại</label>
              <select value={meetingType} onChange={(e) => setMeetingType(e.target.value)} className={inputCls}>
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp</label>
              <select value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(new Set()); setStudentId(""); }} className={inputCls} disabled={isEdit}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </select>
            </div>
          </div>
          {meetingType === "INDIVIDUAL" && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Học sinh liên quan <span className="text-red-500">*</span></label>
              <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={inputCls}>
                <option value="">— Chọn học sinh —</option>
                {studentOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Bắt đầu <span className="text-red-500">*</span></label>
              <input type="datetime-local" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Kết thúc</label>
              <input type="datetime-local" value={endTime} min={meetingDate || undefined} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Địa điểm</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Phòng A301" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Nội dung / mục tiêu</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">
                Mời tham dự <span className="text-red-500">*</span>
                <span className="ml-2 font-normal text-slate-400">({selected.size} đã chọn)</span>
              </label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl p-2" style={{ border: "1px solid #FFE7D6" }}>
                {parents.length === 0 ? <p className="p-2 text-xs text-slate-400">Lớp chưa có phụ huynh.</p> : parents.map((p) => {
                  const key = `${p.userId}::${p.studentId ?? ""}`;
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[#FFF7F2]">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(p.userId, p.studentId)} className="accent-[#F27123]" />
                      <span className="text-[#0F2747]">{p.parentName}</span>
                      <span className="text-xs text-slate-400">· {p.relationship ?? "PH"} của {p.studentName}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {errorMsg && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMsg}</p>}
        </div>

        <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid #FFE7D6" }}>
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
          <button type="button" onClick={handleSubmit} disabled={busy} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
            {busy ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo & gửi lời mời"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MeetingFormModal;
