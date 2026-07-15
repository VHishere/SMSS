import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import EventFormModal from "../../components/organisms/EventFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { eventApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const TABS = [
  { key: "info", label: "Thông tin", ms: "info" },
  { key: "participants", label: "Người tham dự", ms: "group" },
  { key: "documents", label: "Tài liệu", ms: "description" },
  { key: "report", label: "Báo cáo", ms: "task_alt" },
  { key: "log", label: "Nhật ký", ms: "history" },
];
const EVENT_STATUS = {
  ACTIVE: { label: "Đang mở", bg: "#ECFDF5", text: "#16A34A" },
  COMPLETED: { label: "Hoàn thành", bg: "#EBF3FF", text: "#225DAD" },
  CANCELLED: { label: "Đã hủy", bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED: { label: "Lưu trữ", bg: "#F1F5F9", text: "#475569" },
};
const ATT_STATUS = {
  REGISTERED: { label: "Đã đăng ký", bg: "#F1F5F9", text: "#475569" },
  PRESENT: { label: "Có mặt", bg: "#ECFDF5", text: "#16A34A" },
  ABSENT: { label: "Vắng", bg: "#FEF2F2", text: "#DC2626" },
  EXCUSED: { label: "Có phép", bg: "#EBF3FF", text: "#225DAD" },
  LATE: { label: "Muộn", bg: "#FFFBEB", text: "#F59E0B" },
};
const PTYPE = { STUDENT: "Học sinh", PARENT: "Phụ huynh", TEACHER: "Giáo viên" };
const inputCls = "w-full rounded-xl border border-[#DFC0B2] px-3 py-2.5 text-sm text-[#1A1C1C] outline-none focus:ring-1 focus:ring-[#00458E]";

function EventDetailPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "info";

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showEdit, setShowEdit] = useState(false);
  const [meta, setMeta] = useState({ classes: [], categories: [] });

  useEffect(() => {
    let m = true; setLoading(true); setError("");
    eventApi.getDetail(eventId).then((res) => { if (m) setData(res.data); }).catch((err) => { if (m) setError(err.message); }).finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [eventId, refresh]);
  useEffect(() => {
    let m = true;
    eventApi.getMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    return () => { m = false; };
  }, []);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  function setTab(k) { setSearchParams({ tab: k }); }
  function refetch() { setRefresh((k) => k + 1); }

  async function changeStatus(status) {
    if (status === "CANCELLED" && !window.confirm("Hủy sự kiện này?")) return;
    try { await eventApi.changeStatus(eventId, status); refetch(); } catch (e) { alert(e.message); }
  }
  async function duplicate() {
    try { const res = await eventApi.duplicate(eventId); navigate(`/teacher/events/${res.data.eventId}`); } catch (e) { alert(e.message); }
  }
  async function reminder() {
    try { const res = await eventApi.sendReminder(eventId); alert(`Đã gửi nhắc nhở tới ${res.data.sent} người.`); } catch (e) { alert(e.message); }
  }

  const event = data?.event;
  const readOnly = event && ["CANCELLED", "ARCHIVED"].includes(event.status);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Sự kiện" sidebarFooterValue={event?.category ?? ""}>
      <button type="button" onClick={() => navigate("/teacher/events")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1A1C1C]">
        <Ms name="arrow_back" className="!text-[18px]" /> Về danh sách
      </button>

      {loading && <div className="space-y-4"><div className="h-24 animate-pulse rounded-3xl bg-slate-100" /><div className="h-64 animate-pulse rounded-3xl bg-slate-100" /></div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && event && (
        <>
          <section className="mb-6 rounded-3xl p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}`, backgroundColor: "#fff" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: EVENT_STATUS[event.status]?.bg, color: EVENT_STATUS[event.status]?.text }}>{EVENT_STATUS[event.status]?.label}</span>
                  <span className="text-xs text-slate-400">{event.className ?? "Toàn trường"}</span>
                </div>
                <h1 className="text-2xl font-bold" style={{ color: C.onSurface }}>{event.title}</h1>
                <p className="text-sm text-slate-500">{formatDateTimeVN(event.startDate)}{event.endDate ? ` – ${formatDateTimeVN(event.endDate)}` : ""}{event.location ? ` · ${event.location}` : ""} · Tổ chức: {event.organizer ?? "—"}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {data.stats.total} người tham dự{data.stats.attendanceRate !== null ? ` · ${data.stats.attendanceRate}% có mặt` : ""}{event.capacity ? ` · sức chứa ${event.capacity}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={reminder} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium" style={{ backgroundColor: C.surfaceLow, color: C.orange }}><Ms name="notifications" className="!text-[16px]" /> Nhắc</button>
                <button type="button" onClick={duplicate} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium" style={{ backgroundColor: "#EBF3FF", color: C.secondary }}><Ms name="content_copy" className="!text-[16px]" /> Nhân bản</button>
                {!readOnly && event.status === "ACTIVE" && <>
                  <button type="button" onClick={() => setShowEdit(true)} className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: C.deepBlue }}><Ms name="edit" className="!text-[16px]" /> Sửa</button>
                  <button type="button" onClick={() => changeStatus("COMPLETED")} className="rounded-full px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#16A34A" }}>Hoàn thành</button>
                  <button type="button" onClick={() => changeStatus("CANCELLED")} className="rounded-full px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: "#DC2626" }}>Hủy</button>
                </>}
                {event.status === "COMPLETED" && <button type="button" onClick={() => changeStatus("ARCHIVED")} className="rounded-full px-3 py-2 text-sm font-medium" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>Lưu trữ</button>}
              </div>
            </div>
            {event.description && <p className="mt-3 rounded-3xl px-4 py-3 text-sm text-slate-600" style={{ backgroundColor: C.surfaceLow }}>{event.description}</p>}
          </section>

          <div className="mb-6 flex w-full gap-1 overflow-x-auto rounded-full border p-1 sm:w-fit" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm transition-all sm:flex-none" style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="!text-[18px]" /><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}` }}>
            {activeTab === "info" && <InfoTab event={event} stats={data.stats} />}
            {activeTab === "participants" && <ParticipantsTab eventId={eventId} event={event} participants={data.participants} classes={meta.classes} readOnly={readOnly} onChanged={refetch} />}
            {activeTab === "documents" && <DocumentsTab eventId={eventId} documents={data.documents} readOnly={readOnly} onChanged={refetch} />}
            {activeTab === "report" && <ReportTab eventId={eventId} event={event} stats={data.stats} onChanged={refetch} />}
            {activeTab === "log" && <LogTab logs={data.logs} />}
          </div>
        </>
      )}

      {showEdit && event && (
        <EventFormModal mode="edit" classes={meta.classes} categories={meta.categories} event={event} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); refetch(); }} />
      )}
    </DashboardShell>
  );
}

function InfoTab({ event, stats }) {
  return (
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {[
        ["Danh mục", event.category ?? "—"], ["Loại", event.eventType ?? "—"],
        ["Bắt đầu", formatDateTimeVN(event.startDate)], ["Kết thúc", event.endDate ? formatDateTimeVN(event.endDate) : "—"],
        ["Địa điểm", event.location ?? "—"], ["Tổ chức", event.organizer ?? "—"],
        ["Sức chứa", event.capacity ?? "—"], ["Tham dự", `${stats.total}${stats.participationRate !== null ? ` (${stats.participationRate}%)` : ""}`],
      ].map(([k, v]) => (
        <div key={k} className="rounded-3xl px-4 py-3" style={{ backgroundColor: C.surfaceLow, border: `1px solid ${C.border}` }}>
          <dt className="text-xs text-slate-400">{k}</dt><dd className="text-sm font-medium" style={{ color: C.onSurface }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function ParticipantsTab({ eventId, event, participants, classes, readOnly, onChanged }) {
  const [showAdd, setShowAdd] = useState(false);
  const [addClassId, setAddClassId] = useState(event.classId != null ? String(event.classId) : (classes[0]?.classId ? String(classes[0].classId) : ""));
  const [contacts, setContacts] = useState({ students: [], parents: [] });
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    if (!showAdd || !addClassId) return;
    let m = true;
    eventApi.getClassContacts(addClassId).then((res) => { if (m) setContacts(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [showAdd, addClassId]);

  const existing = new Set(participants.map((p) => p.userId));

  async function addSelected() {
    const payload = [...selected].map((k) => { const [type, userId, sId] = k.split("::"); return { userId: Number(userId), participantType: type, studentId: sId ? Number(sId) : null }; });
    if (!payload.length) return;
    try { await eventApi.addParticipants(eventId, payload); setShowAdd(false); setSelected(new Set()); onChanged(); } catch (e) { alert(e.message); }
  }
  async function remove(p) {
    if (!window.confirm(`Xóa ${p.name} khỏi sự kiện?`)) return;
    try { await eventApi.removeParticipant(eventId, p.registrationId); onChanged(); } catch (e) { alert(e.message); }
  }
  async function mark(p, status) {
    try { await eventApi.markAttendance(eventId, p.registrationId, status); onChanged(); } catch (e) { alert(e.message); }
  }
  function toggle(k) { setSelected((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; }); }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold" style={{ color: C.onSurface }}>Người tham dự ({participants.length})</h3>
        {!readOnly && <button type="button" onClick={() => setShowAdd((s) => !s)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: C.orange }}><Ms name="add" className="!text-[14px]" /> Thêm</button>}
      </div>

      {showAdd && (
        <div className="mb-4 rounded-3xl p-3" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow }}>
          <select value={addClassId} onChange={(e) => { setAddClassId(e.target.value); setSelected(new Set()); }} className={`${inputCls} mb-2`}>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {[...contacts.students.map((s) => ({ key: `STUDENT::${s.userId}::${s.studentId}`, userId: s.userId, name: s.name, sub: `HS · ${s.code}` })),
              ...contacts.parents.map((p) => ({ key: `PARENT::${p.userId}::${p.studentId ?? ""}`, userId: p.userId, name: p.name, sub: `PH · ${p.studentName}` }))]
              .filter((c) => !existing.has(c.userId))
              .map((c) => (
                <label key={c.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-white">
                  <input type="checkbox" checked={selected.has(c.key)} onChange={() => toggle(c.key)} className="accent-[#F27123]" />
                  <span style={{ color: C.onSurface }}>{c.name}</span><span className="text-xs text-slate-400">{c.sub}</span>
                </label>
              ))}
          </div>
          <button type="button" onClick={addSelected} className="mt-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: C.deepBlue }}>Thêm ({selected.size})</button>
        </div>
      )}

      <div className="space-y-2">
        {participants.length === 0 ? <p className="text-sm text-slate-400">Chưa có người tham dự.</p> : participants.map((p) => {
          const st = ATT_STATUS[p.attendStatus] ?? ATT_STATUS.REGISTERED;
          return (
            <div key={p.registrationId} className="flex flex-wrap items-center justify-between gap-2 rounded-3xl px-4 py-2.5" style={{ border: `1px solid ${C.border}` }}>
              <div><p className="text-sm font-medium" style={{ color: C.onSurface }}>{p.name}</p><p className="text-xs text-slate-400">{PTYPE[p.participantType] ?? ""}{p.studentName ? ` · ${p.studentName}` : ""}</p></div>
              <div className="flex items-center gap-2">
                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                {!readOnly && (
                  <>
                    <select value={p.attendStatus} onChange={(e) => mark(p, e.target.value)} className="rounded-xl border px-2 py-1 text-xs outline-none" style={{ borderColor: C.border }}>
                      {Object.entries(ATT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button type="button" onClick={() => remove(p)} className="text-slate-300 hover:text-red-500"><Ms name="delete" className="!text-[16px]" /></button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DocumentsTab({ eventId, documents, readOnly, onChanged }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file) {
    if (!file) return;
    setUploading(true);
    try { await eventApi.uploadDocument(eventId, file); onChanged(); } catch (e) { alert(e.message); } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function remove(d) {
    if (!window.confirm(`Xóa "${d.fileName}"?`)) return;
    try { await eventApi.deleteDocument(eventId, d.attachmentId); onChanged(); } catch (e) { alert(e.message); }
  }

  return (
    <div>
      {!readOnly && (
        <div className="mb-4">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed py-5 text-sm disabled:opacity-50" style={{ borderColor: C.border, backgroundColor: C.surfaceLow, color: C.onSurface }}>
            <Ms name="attach_file" className="!text-[18px]" style={{ color: C.orange }} /> {uploading ? "Đang tải..." : "Tải tài liệu (PDF/DOCX/XLSX/ảnh · ≤10MB)"}
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      )}
      {documents.length === 0 ? <p className="text-sm text-slate-400">Chưa có tài liệu.</p> : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.attachmentId} className="flex items-center gap-2 rounded-3xl px-4 py-2.5" style={{ border: `1px solid ${C.border}` }}>
              <Ms name="attach_file" className="!text-[18px]" style={{ color: C.secondary }} />
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate font-medium" style={{ color: C.secondary }}>{d.fileName}</a>
              <span className="text-xs text-slate-400">{formatDateTimeVN(d.uploadedAt)}</span>
              {!readOnly && <button type="button" onClick={() => remove(d)} className="text-slate-300 hover:text-red-500"><Ms name="delete" className="!text-[16px]" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReportTab({ eventId, event, stats, onChanged }) {
  const submitted = event.outcomeSubmitted;
  const [outcome, setOutcome] = useState(event.outcome ?? "");
  const [busy, setBusy] = useState(false);

  async function save(submit) {
    if (submit && !window.confirm("Chốt báo cáo? Sau khi chốt sẽ không sửa được.")) return;
    setBusy(true);
    try { await eventApi.saveOutcome(eventId, { outcome, submit }); onChanged(); } catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-3xl px-3 py-3 text-center" style={{ backgroundColor: "#EBF3FF" }}><p className="text-xs text-slate-500">Tham dự</p><p className="text-lg font-bold" style={{ color: C.secondary }}>{stats.total}</p></div>
        <div className="rounded-3xl px-3 py-3 text-center" style={{ backgroundColor: "#ECFDF5" }}><p className="text-xs text-slate-500">Có mặt</p><p className="text-lg font-bold" style={{ color: "#16A34A" }}>{stats.attended}</p></div>
        <div className="rounded-3xl px-3 py-3 text-center" style={{ backgroundColor: C.surfaceLow }}><p className="text-xs text-slate-500">Tỷ lệ dự</p><p className="text-lg font-bold" style={{ color: C.orange }}>{stats.attendanceRate === null ? "—" : `${stats.attendanceRate}%`}</p></div>
      </div>

      {submitted ? (
        <div>
          <div className="mb-2 rounded-3xl px-3 py-2 text-xs font-medium" style={{ backgroundColor: "#ECFDF5", color: "#16A34A" }}>Báo cáo đã chốt lúc {formatDateTimeVN(event.outcomeSubmittedAt)} — chỉ đọc.</div>
          <p className="whitespace-pre-wrap rounded-3xl px-4 py-3 text-sm text-slate-700" style={{ backgroundColor: C.surfaceLow, border: `1px solid ${C.border}` }}>{event.outcome || "—"}</p>
        </div>
      ) : (
        <>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">Báo cáo kết quả sự kiện</label>
            <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={6} placeholder="Tóm tắt kết quả, số liệu, đánh giá..." className={`${inputCls} resize-none`} />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => save(false)} disabled={busy} className="flex-1 rounded-full border py-2.5 text-sm font-medium text-slate-600 hover:bg-[#F3F3F3] disabled:opacity-50" style={{ borderColor: C.border }}>Lưu nháp</button>
            <button type="button" onClick={() => save(true)} disabled={busy} className="flex-1 rounded-full py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>Chốt báo cáo</button>
          </div>
        </>
      )}
    </div>
  );
}

function LogTab({ logs }) {
  if (!logs.length) return <p className="text-sm text-slate-400">Chưa có hoạt động.</p>;
  return (
    <div className="space-y-2">
      {logs.map((l, i) => (
        <div key={i} className="flex items-start justify-between gap-3 rounded-3xl px-4 py-2.5" style={{ backgroundColor: C.surfaceLow }}>
          <div><p className="text-sm" style={{ color: C.onSurface }}>{l.detail || l.action}</p><p className="text-xs text-slate-400">{l.changedByName}</p></div>
          <span className="shrink-0 text-xs text-slate-400">{formatDateTimeVN(l.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}

export default EventDetailPage;
