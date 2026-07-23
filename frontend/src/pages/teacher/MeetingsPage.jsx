import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import MeetingFormModal from "../../components/organisms/MeetingFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { meetingApi } from "../../api/client";
import { formatDateVN } from "../../utils/datetime";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", error: "#BA1A1A",
  surface: "#F9F9F9", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}
const STATUS = {
  SCHEDULED: { label: "Sắp tới",     bg: "rgba(242,113,35,0.12)", text: "#9F4200", accent: "#F27123" },
  COMPLETED: { label: "Đã hoàn thành", bg: "#DCFCE7", text: "#15803D", accent: "#15803D" },
  CANCELLED: { label: "Đã hủy",      bg: "rgba(186,26,26,0.1)", text: "#BA1A1A", accent: "#BA1A1A" },
  ARCHIVED:  { label: "Lưu trữ",     bg: "#E8E8E8", text: "#584238", accent: "#94A3B8" },
};
const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

function initials(n) { const p = (n || "").trim().split(/\s+/); return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?"; }
function todayLocal() { const p = (n) => String(n).padStart(2, "0"); const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function dayLabel(dt) {
  if (!dt) return "";
  const iso = dt.slice(0, 10);
  const today = todayLocal();
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yIso = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, "0")}-${String(y.getDate()).padStart(2, "0")}`;
  const time = dt.length >= 16 ? dt.slice(11, 16) : "";
  let day;
  if (iso === today) day = "HÔM NAY";
  else if (iso === yIso) day = "HÔM QUA";
  else day = `${+iso.slice(8, 10)} TH${+iso.slice(5, 7)}`;
  return time ? `${day} • ${time}` : day;
}
function startsIn(meetingDate, status) {
  if (status === "CANCELLED") return { icon: "cancel", text: "Đã hủy", color: C.error };
  if (status === "COMPLETED") return { icon: "check_circle", text: "Đã hoàn thành", color: "#15803D" };
  const t = new Date(String(meetingDate).replace(" ", "T")).getTime();
  const diff = t - Date.now();
  if (diff > 0) {
    const mins = Math.round(diff / 60000);
    if (mins < 60) return { icon: "hourglass_top", text: `Bắt đầu sau ${mins} phút`, color: C.orange };
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return { icon: "hourglass_top", text: `Bắt đầu sau ${hrs} giờ`, color: C.orange };
    return { icon: "event", text: `Còn ${Math.round(hrs / 24)} ngày`, color: C.orange };
  }
  return { icon: "schedule", text: "Đã diễn ra", color: C.muted };
}

// ─── Detail pane (right) ──────────────────────────────────────────────────────
function DetailPane({ meetingId, onChanged, onEdit }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rk, setRk] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [tTitle, setTTitle] = useState("");
  const [tDate, setTDate] = useState("");

  useEffect(() => {
    if (!meetingId) { setD(null); return; }
    let m = true; setLoading(true);
    meetingApi.getDetail(meetingId)
      .then((r) => { if (m) { setD(r.data); setNotes(r.data.minutes?.discussion ?? ""); } })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [meetingId, rk]);

  function reload() { setRk((k) => k + 1); onChanged?.(); }

  if (!meetingId) return (
    <div className="flex h-full min-h-[400px] flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <Ms name="event_note" className="!text-[40px]" style={{ color: C.border }} />
      <p className="mt-2 text-sm text-slate-400">Chọn một buổi họp bên trái để xem chi tiết.</p>
    </div>
  );
  if (loading || !d) return <div className="h-[600px] animate-pulse rounded-3xl bg-slate-200/50" />;

  const mt = d.meeting;
  const inv = d.invitations?.[0];
  const parentName = inv?.name ?? mt.title;
  const st = startsIn(mt.meetingDate, mt.status);
  const submitted = d.minutes?.isSubmitted;
  const actions = d.actions ?? [];
  const readOnly = ["CANCELLED", "ARCHIVED"].includes(mt.status);

  async function saveMinutes(submit) {
    if (submit && !window.confirm("Chốt biên bản & kết thúc? Sau khi chốt sẽ không sửa được.")) return;
    setBusy(true);
    try {
      await meetingApi.saveMinutes(meetingId, { discussion: notes, agreements: d.minutes?.agreements ?? "", decisions: d.minutes?.decisions ?? "", submit });
      reload();
    } catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function toggleTask(a) {
    try { await meetingApi.updateActionStatus(meetingId, a.actionId, a.status === "COMPLETED" ? "PENDING" : "COMPLETED"); reload(); }
    catch (e) { alert(e.message); }
  }
  async function addTask() {
    if (!tTitle.trim()) return;
    if (!tDate) { alert("Chọn hạn công việc"); return; }
    try { await meetingApi.createAction(meetingId, { title: tTitle.trim(), deadline: tDate, assigneeUserId: null }); setTTitle(""); setTDate(""); setAddOpen(false); reload(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: C.deepBlue }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/30 text-xl font-bold" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              {inv?.avatar ? <img src={inv.avatar} alt={parentName} className="h-16 w-16 rounded-2xl object-cover" /> : initials(parentName)}
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl font-bold">{parentName}</h3>
              <p className="flex items-center gap-2 text-sm opacity-90">
                <Ms name="person" className="!text-[16px]" />
                {mt.studentName ? <>Phụ huynh học sinh: <strong>{mt.studentName}{mt.className ? ` (${mt.className})` : ""}</strong></> : (mt.className ?? "Họp lớp")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex gap-2">
              <button type="button" onClick={() => onEdit(mt)} title="Sửa" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20"><Ms name="edit" className="!text-[18px]" /></button>
              <button type="button" onClick={() => window.print()} title="In" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20"><Ms name="print" className="!text-[18px]" /></button>
            </div>
            <span className="text-xs opacity-70">{mt.meetingType === "INDIVIDUAL" ? "Họp cá nhân" : "Họp lớp"} · {formatDateVN(mt.meetingDate)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow space-y-6 p-6">
        {/* Summary tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Trạng thái</p>
            <div className="flex items-center gap-2 font-bold" style={{ color: st.color }}><Ms name={st.icon} className="!text-[18px]" /> {st.text}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Liên hệ</p>
            <div className="flex items-center gap-2 font-medium" style={{ color: C.onSurface }}><Ms name="call" className="!text-[18px]" /> {inv?.phone ?? "—"}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Địa điểm</p>
            <div className="flex items-center gap-2 font-medium" style={{ color: C.onSurface }}><Ms name="meeting_room" className="!text-[18px]" /> {mt.location ?? "—"}</div>
          </div>
        </div>

        {/* Minutes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="notes" style={{ color: C.orange }} /> Biên bản cuộc họp & Ghi chú</h4>
            {submitted && <span className="flex items-center gap-1 text-xs" style={{ color: "#15803D" }}><Ms name="cloud_done" className="!text-[16px]" /> Đã chốt</span>}
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: C.border }}>
            <div className="flex gap-1 border-b p-2" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
              {["format_bold", "format_italic", "format_list_bulleted", "attach_file", "link"].map((ic) => (
                <span key={ic} className="rounded p-2 opacity-50"><Ms name={ic} className="!text-[16px]" /></span>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitted || readOnly} rows={5}
              placeholder="Nhập các điểm thảo luận, ý kiến phụ huynh và nhận xét về học sinh tại đây..."
              className="w-full resize-none border-none p-4 text-sm outline-none disabled:bg-slate-50" style={{ color: C.onSurface }} />
          </div>
        </div>

        {/* Follow-up tasks */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="task_alt" style={{ color: C.orange }} /> Các đầu việc cần theo dõi</h4>
          <div className="space-y-2">
            {actions.length === 0 && !addOpen && <p className="text-sm text-slate-400">Chưa có công việc nào.</p>}
            {actions.map((a) => {
              const done = a.status === "COMPLETED";
              return (
                <div key={a.actionId} className="flex items-center gap-3 rounded-2xl border border-transparent p-3 transition-all hover:border-[#DFC0B2]" style={{ backgroundColor: C.surfaceLow }}>
                  <input type="checkbox" checked={done} onChange={() => toggleTask(a)} disabled={readOnly} className="h-5 w-5 accent-[#F27123]" />
                  <div className="flex-grow">
                    <p className={`text-sm ${done ? "line-through opacity-50" : ""}`} style={{ color: C.onSurface }}>{a.title}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>Hạn {formatDateVN(a.deadline)}{a.assigneeName ? ` · ${a.assigneeName}` : ""}</p>
                  </div>
                  {a.isOverdue && !done
                    ? <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: "rgba(186,26,26,0.1)", color: C.error }}>Quá hạn</span>
                    : done ? <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>Xong</span> : null}
                </div>
              );
            })}
            {addOpen && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border p-3" style={{ borderColor: C.border }}>
                <input value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Tên công việc" className="flex-grow rounded-lg border px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={{ borderColor: C.border }} />
                <input type="date" value={tDate} onChange={(e) => setTDate(e.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: C.border }} />
                <button type="button" onClick={addTask} className="rounded-full px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: C.deepBlue }}>Thêm</button>
                <button type="button" onClick={() => setAddOpen(false)} className="rounded-full px-3 py-2 text-sm" style={{ color: C.muted }}>Hủy</button>
              </div>
            )}
            {!addOpen && !readOnly && (
              <button type="button" onClick={() => setAddOpen(true)} className="flex w-fit items-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-colors hover:bg-[#F27123]/5" style={{ color: C.orange }}>
                <Ms name="add_circle" className="!text-[18px]" /> Thêm công việc mới
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      {!submitted && !readOnly && (
        <div className="flex justify-end gap-3 border-t p-5" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          <button type="button" onClick={() => setNotes(d.minutes?.discussion ?? "")} className="px-5 py-2.5 text-sm font-bold" style={{ color: C.muted }}>Bỏ qua</button>
          <button type="button" onClick={() => saveMinutes(false)} disabled={busy} className="rounded-full border px-5 py-2.5 text-sm font-bold disabled:opacity-50" style={{ borderColor: C.border, color: C.onSurface }}>Lưu nháp</button>
          <button type="button" onClick={() => saveMinutes(true)} disabled={busy} className="rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.deepBlue }}>
            {busy ? "Đang lưu..." : "Lưu biên bản & Kết thúc"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MeetingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ classes: [] });
  const [upcoming, setUpcoming] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [classF, setClassF] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editMeeting, setEditMeeting] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    let m = true;
    meetingApi.getMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    meetingApi.getDashboard().then((res) => { if (m) setUpcoming(res.data.stats?.upcoming ?? 0); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  useEffect(() => {
    let m = true; setLoading(true);
    meetingApi.list({ classId: classF, limit: 100 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [classF, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const meetings = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate))),
    [data],
  );

  // default selection: nearest upcoming SCHEDULED, else most recent
  const selected = useMemo(() => {
    if (selectedId) return meetings.find((m) => m.meetingId === selectedId) ?? null;
    const now = Date.now();
    const up = meetings.filter((m) => m.status === "SCHEDULED" && new Date(String(m.meetingDate).replace(" ", "T")).getTime() >= now)
      .sort((a, b) => String(a.meetingDate).localeCompare(String(b.meetingDate)));
    return up[0] ?? meetings[0] ?? null;
  }, [meetings, selectedId]);
  const effSelectedId = selected?.meetingId ?? null;

  const byDay = useMemo(() => {
    const map = {};
    for (const m of meetings) { const day = m.meetingDate?.slice(0, 10); if (day) (map[day] = map[day] || []).push(m); }
    return map;
  }, [meetings]);

  const shown = cursor ?? (selected ? { y: +selected.meetingDate.slice(0, 4), m: +selected.meetingDate.slice(5, 7) - 1 } : (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })());
  const cells = useMemo(() => {
    const first = new Date(shown.y, shown.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysIn = new Date(shown.y, shown.m + 1, 0).getDate();
    const prevDays = new Date(shown.y, shown.m, 0).getDate();
    const arr = [];
    for (let i = startDow - 1; i >= 0; i--) arr.push({ d: prevDays - i, out: true });
    for (let d = 1; d <= daysIn; d++) arr.push({ d, out: false, key: `${shown.y}-${String(shown.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` });
    return arr;
  }, [shown.y, shown.m]);
  const selDay = selected?.meetingDate?.slice(0, 10);

  function bump() { setRefresh((k) => k + 1); }

  function exportLog() {
    const head = ["Ngày", "Giờ", "Chủ đề", "Lớp", "Học sinh", "Trạng thái"];
    const rows = meetings.map((m) => [m.meetingDate?.slice(0, 10), m.meetingDate?.slice(11, 16), m.title, m.className ?? "", m.studentName ?? "", STATUS[m.status]?.label ?? m.status]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "nhat-ky-hop-phu-huynh.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Cuộc họp sắp tới" sidebarFooterValue={String(upcoming)}>
      {/* Header actions */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Kế hoạch Tuần</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => setShowCreate(true)} disabled={meta.classes.length === 0}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:brightness-110 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
            <Ms name="add" className="!text-[20px]" /> Lên lịch Họp
          </button>
          <button type="button" onClick={exportLog} className="flex items-center gap-2 rounded-full border px-5 py-2.5 font-bold transition-all hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: C.onSurface }}>
            <Ms name="ios_share" className="!text-[18px]" /> Xuất nhật ký
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 h-[600px] animate-pulse rounded-3xl bg-slate-200/50 lg:col-span-4" />
          <div className="col-span-12 h-[600px] animate-pulse rounded-3xl bg-slate-200/50 lg:col-span-8" />
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Left column */}
          <div className="col-span-12 space-y-6 lg:col-span-4">
            {/* Calendar */}
            <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold" style={{ color: C.onSurface }}>Tháng {MONTHS[shown.m]} {shown.y}</h3>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setCursor(shown.m === 0 ? { y: shown.y - 1, m: 11 } : { y: shown.y, m: shown.m - 1 })} className="rounded p-1 hover:bg-[#F3F3F3]"><Ms name="chevron_left" /></button>
                  <button type="button" onClick={() => setCursor(shown.m === 11 ? { y: shown.y + 1, m: 0 } : { y: shown.y, m: shown.m + 1 })} className="rounded p-1 hover:bg-[#F3F3F3]"><Ms name="chevron_right" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WD.map((d) => <div key={d} className="py-2 text-[10px] font-bold uppercase" style={{ color: C.muted }}>{d}</div>)}
                {cells.map((c, i) => {
                  if (c.out) return <div key={i} className="p-2 text-sm" style={{ color: C.muted, opacity: 0.3 }}>{c.d}</div>;
                  const dayMeetings = byDay[c.key] ?? [];
                  const isSel = c.key === selDay;
                  return (
                    <button key={i} type="button" disabled={!dayMeetings.length}
                      onClick={() => dayMeetings.length && setSelectedId(dayMeetings[0].meetingId)}
                      className="relative rounded-lg p-2 text-sm transition-colors"
                      style={isSel ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.onSurface, cursor: dayMeetings.length ? "pointer" : "default" }}>
                      {c.d}
                      {!isSel && dayMeetings.length > 0 && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ backgroundColor: C.orange }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scheduled list */}
            <div className="flex max-h-[520px] flex-col overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: C.border }}>
                <h3 className="font-bold" style={{ color: C.onSurface }}>Các buổi đã lên lịch</h3>
                <div className="flex items-center gap-2">
                  {meta.classes.length > 1 && (
                    <select value={classF} onChange={(e) => setClassF(e.target.value)} className="rounded-full border bg-white px-2 py-1 text-xs outline-none" style={{ borderColor: C.border, color: C.muted }}>
                      <option value="">Tất cả lớp</option>
                      {meta.classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                    </select>
                  )}
                  <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>{meetings.length} Hoạt động</span>
                </div>
              </div>
              <div className="flex-grow space-y-2 overflow-y-auto p-2">
                {meetings.length === 0 ? (
                  <p className="p-6 text-center text-sm text-slate-400">Chưa có buổi họp nào.</p>
                ) : meetings.map((m) => {
                  const st = STATUS[m.status] ?? STATUS.SCHEDULED;
                  const active = m.meetingId === effSelectedId;
                  const cancelled = m.status === "CANCELLED";
                  return (
                    <button key={m.meetingId} type="button" onClick={() => setSelectedId(m.meetingId)}
                      className="w-full rounded-2xl p-3 text-left transition-all hover:shadow-sm"
                      style={active ? { backgroundColor: "rgba(242,113,35,0.06)", borderLeft: `4px solid ${C.orange}` } : { opacity: cancelled ? 0.6 : 1 }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="mb-0.5 text-[11px] font-bold uppercase tracking-tight" style={{ color: active ? C.orange : C.muted }}>{dayLabel(m.meetingDate)}</p>
                          <h4 className="truncate font-bold" style={{ color: C.onSurface }}>{m.studentName ? `PH · ${m.studentName}` : (m.className ?? "Họp lớp")}</h4>
                          <p className="truncate text-sm" style={{ color: C.muted }}>Chủ đề: {m.title}</p>
                        </div>
                        <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="col-span-12 lg:col-span-8">
            <DetailPane meetingId={effSelectedId} onChanged={bump} onEdit={(mt) => setEditMeeting(mt)} />
          </div>
        </div>
      )}

      {showCreate && (
        <MeetingFormModal mode="create" classes={meta.classes} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); bump(); }} />
      )}
      {editMeeting && (
        <MeetingFormModal mode="edit" classes={meta.classes} meeting={editMeeting} onClose={() => setEditMeeting(null)} onSaved={() => { setEditMeeting(null); bump(); }} />
      )}
    </DashboardShell>
  );
}

export default MeetingsPage;
