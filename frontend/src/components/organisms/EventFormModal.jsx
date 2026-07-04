import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

import { eventApi } from "../../api/client";

const EVENT_TYPES = [
  { value: "WORKSHOP", label: "Workshop / Chuyên đề" },
  { value: "CLUB", label: "Câu lạc bộ" },
  { value: "COMPETITION", label: "Cuộc thi" },
  { value: "FIELD_TRIP", label: "Dã ngoại / Tham quan" },
  { value: "SPORT", label: "Thể thao" },
  { value: "CULTURE", label: "Văn nghệ" },
  { value: "SEMINAR", label: "Hội thảo / Tọa đàm" },
  { value: "MUSIC", label: "Âm nhạc" },
  { value: "SUPPORT_CLASS", label: "Phụ đạo" },
  { value: "OTHER", label: "Khác" },
];

function toLocalInput(value) { return value ? value.replace(" ", "T").slice(0, 16) : ""; }

function EventFormModal({ mode, classes = [], categories = [], event = null, onClose, onSaved }) {
  const isEdit = mode === "edit";

  const [title, setTitle] = useState(event?.title ?? "");
  const [category, setCategory] = useState(event?.category ?? "");
  const [eventType, setEventType] = useState(event?.eventType ?? "");
  const [classId, setClassId] = useState(event?.classId != null ? String(event.classId) : "");
  const [startDate, setStartDate] = useState(toLocalInput(event?.startDate));
  const [endDate, setEndDate] = useState(toLocalInput(event?.endDate));
  const [location, setLocation] = useState(event?.location ?? "");
  const [organizer, setOrganizer] = useState(event?.organizer ?? "");
  const [capacity, setCapacity] = useState(event?.capacity ?? "");
  const [description, setDescription] = useState(event?.description ?? "");

  const [contacts, setContacts] = useState({ students: [], parents: [] });
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (isEdit || !classId) { setContacts({ students: [], parents: [] }); return; }
    let m = true;
    eventApi.getClassContacts(classId).then((res) => { if (m) setContacts(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [classId, isEdit]);

  function toggle(key) {
    setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function participantsPayload() {
    const out = [];
    for (const k of selected) {
      const [type, userId, studentId] = k.split("::");
      out.push({ userId: Number(userId), participantType: type, studentId: studentId ? Number(studentId) : null });
    }
    return out;
  }

  async function handleSubmit() {
    if (!title.trim()) { setErrorMsg("Nhập tiêu đề"); return; }
    if (!eventType) { setErrorMsg("Chọn loại sự kiện"); return; }
    if (!category) { setErrorMsg("Chọn danh mục"); return; }
    if (!startDate) { setErrorMsg("Chọn thời gian bắt đầu"); return; }
    if (endDate && new Date(endDate) <= new Date(startDate)) { setErrorMsg("Thời gian kết thúc phải sau thời gian bắt đầu"); return; }
    if (!organizer.trim()) { setErrorMsg("Nhập đơn vị/người tổ chức"); return; }
    if (capacity && Number(capacity) <= 0) { setErrorMsg("Sức chứa phải lớn hơn 0"); return; }
    setBusy(true); setErrorMsg("");
    try {
      const body = {
        title: title.trim(), category, eventType: eventType || null,
        classId: classId ? Number(classId) : null,
        startDate, endDate: endDate || null, location: location || null,
        organizer: organizer.trim(), capacity: capacity ? Number(capacity) : null,
        description: description || null,
      };
      if (isEdit) await eventApi.update(event.eventId, body);
      else await eventApi.create({ ...body, participants: participantsPayload() });
      onSaved();
    } catch (err) { setErrorMsg(err.message); } finally { setBusy(false); }
  }

  const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl" style={{ border: "1px solid #FFE7D6" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #FFE7D6" }}>
          <h3 className="text-base font-bold" style={{ color: "#0F2747" }}>{isEdit ? "Sửa sự kiện" : "Tạo sự kiện"}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><FiX size={20} /></button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Tiêu đề <span className="text-red-500">*</span></label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Ngày hội STEM" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Loại sự kiện <span className="text-red-500">*</span></label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputCls}>
                <option value="">— Chọn loại —</option>
                {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Danh mục <span className="text-red-500">*</span></label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                <option value="">— Chọn danh mục —</option>
                {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Lớp (để trống = toàn trường)</label>
            <select value={classId} onChange={(e) => { setClassId(e.target.value); setSelected(new Set()); }} className={inputCls} disabled={isEdit}>
              <option value="">Toàn trường</option>
              {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Bắt đầu <span className="text-red-500">*</span></label>
              <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Kết thúc</label>
              <input type="datetime-local" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Đơn vị tổ chức <span className="text-red-500">*</span></label>
              <input value={organizer} onChange={(e) => setOrganizer(e.target.value)} placeholder="VD: Tổ Toán - Tin" className={inputCls} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Sức chứa</label>
              <input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Địa điểm</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="VD: Sân trường" className={inputCls} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Mô tả</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
          </div>

          {!isEdit && classId && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600">Người tham dự ({selected.size})</label>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl p-2" style={{ border: "1px solid #FFE7D6" }}>
                {contacts.students.map((s) => {
                  const key = `STUDENT::${s.userId}::${s.studentId}`;
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[#FFF7F2]">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="accent-[#F27123]" />
                      <span className="text-[#0F2747]">{s.name}</span><span className="text-xs text-slate-400">HS · {s.code}</span>
                    </label>
                  );
                })}
                {contacts.parents.map((p) => {
                  const key = `PARENT::${p.userId}::${p.studentId ?? ""}`;
                  return (
                    <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[#FFF7F2]">
                      <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} className="accent-[#F27123]" />
                      <span className="text-[#0F2747]">{p.name}</span><span className="text-xs text-slate-400">PH · {p.studentName}</span>
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
            {busy ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo sự kiện"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default EventFormModal;
