import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentMeetingApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
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
const INVITE_STATUS = {
  SENT:     { label: "Đã mời",      bg: "rgba(255,255,255,0.18)" },
  PENDING:  { label: "Chờ phản hồi", bg: "rgba(255,255,255,0.18)" },
  ACCEPTED: { label: "Đã xác nhận", bg: "rgba(255,255,255,0.18)" },
  DECLINED: { label: "Đã từ chối",  bg: "rgba(255,255,255,0.18)" },
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
const nowMs = () => Date.now();
function beginLoad(setLoading) { setLoading(true); }
function hasMeetingStarted(meetingDate) {
  if (!meetingDate) return false;
  return new Date(String(meetingDate).replace(" ", "T")).getTime() <= nowMs();
}

// ─── Detail pane (right) ──────────────────────────────────────────────────────
function ParentDetailPane({ meetingId, onChanged }) {
  const [d, setD] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rk, setRk] = useState(0);
  const [responding, setResponding] = useState(false);
  const [respondMsg, setRespondMsg] = useState({ text: "", ok: true });

  useEffect(() => {
    if (!meetingId) return;
    let m = true; beginLoad(setLoading);
    parentMeetingApi.getDetail(meetingId)
      .then((r) => { if (m) setD(r.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [meetingId, rk]);

  function reload() { setRk((k) => k + 1); onChanged?.(); }

  if (!meetingId) return (
    <div className="flex h-full min-h-100 flex-col items-center justify-center rounded-3xl bg-white p-10 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <Ms name="event_note" className="text-[40px]!" style={{ color: C.border }} />
      <p className="mt-2 text-sm text-slate-400">Chọn một buổi họp bên trái để xem chi tiết.</p>
    </div>
  );
  if (loading || !d) return <div className="h-150 animate-pulse rounded-3xl bg-slate-200/50" />;

  const mt = d.meeting;
  const teacherName = mt.teacherName ?? "Giáo viên";
  const st = startsIn(mt.meetingDate, mt.status);
  const minutes = d.minutes;
  const actions = d.actions ?? [];
  const invSt = INVITE_STATUS[mt.invitationStatus];
  const expired = hasMeetingStarted(mt.meetingDate);
  const canRespond = mt.status === "SCHEDULED" && ["SENT", "PENDING"].includes(mt.invitationStatus) && !expired;
  const showExpiredBadge = mt.status === "SCHEDULED" && ["SENT", "PENDING"].includes(mt.invitationStatus) && expired;

  async function respond() {
    setResponding(true); setRespondMsg({ text: "", ok: true });
    try {
      const res = await parentMeetingApi.respond(meetingId, "ACCEPT");
      setRespondMsg({ text: res.message ?? "Đã xác nhận tham dự", ok: true });
      reload();
    } catch (e) {
      setRespondMsg({ text: e.message ?? "Có lỗi xảy ra", ok: false });
    } finally { setResponding(false); }
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      {/* Header */}
      <div className="p-6 text-white" style={{ backgroundColor: C.deepBlue }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white/30 text-xl font-bold" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
              {initials(teacherName)}
            </div>
            <div className="min-w-0">
              <h3 className="text-2xl font-bold">{teacherName}</h3>
              <p className="flex items-center gap-2 text-sm opacity-90">
                <Ms name="person" className="text-[16px]!" />
                {mt.studentName ? <>Về học sinh: <strong>{mt.studentName}{mt.className ? ` (${mt.className})` : ""}</strong></> : (mt.className ?? "Họp lớp")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              {canRespond && (
                <button type="button" onClick={respond} disabled={responding}
                  className="rounded-full bg-white px-4 py-1.5 text-sm font-bold shadow-sm transition-all hover:brightness-95 active:scale-95 disabled:opacity-60" style={{ color: C.deepBlue }}>
                  {responding ? "..." : "Xác nhận tham dự"}
                </button>
              )}
              {showExpiredBadge && (
                <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "rgba(255,255,255,0.18)" }}>Đã quá hạn xác nhận</span>
              )}
              {!canRespond && !showExpiredBadge && invSt && (
                <span className="rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: invSt.bg }}>{invSt.label}</span>
              )}
              <button type="button" onClick={() => window.print()} title="In" className="rounded-lg bg-white/10 p-2 transition-colors hover:bg-white/20"><Ms name="print" className="text-[18px]!" /></button>
            </div>
            <span className="text-xs opacity-70">{mt.meetingType === "INDIVIDUAL" ? "Họp cá nhân" : "Họp lớp"} · {formatDateVN(mt.meetingDate)}</span>
          </div>
        </div>
        {respondMsg.text && (
          <p className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold" style={{ backgroundColor: respondMsg.ok ? "rgba(255,255,255,0.18)" : "rgba(186,26,26,0.3)" }}>{respondMsg.text}</p>
        )}
      </div>

      {/* Body */}
      <div className="grow space-y-6 p-6">
        {/* Summary tiles */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Trạng thái</p>
            <div className="flex items-center gap-2 font-bold" style={{ color: st.color }}><Ms name={st.icon} className="text-[18px]!" /> {st.text}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Liên hệ</p>
            <div className="flex items-center gap-2 font-medium" style={{ color: C.onSurface }}><Ms name="call" className="text-[18px]!" /> {mt.teacherPhone ?? "—"}</div>
          </div>
          <div className="rounded-2xl border p-4" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Địa điểm</p>
            <div className="flex items-center gap-2 font-medium" style={{ color: C.onSurface }}><Ms name="meeting_room" className="text-[18px]!" /> {mt.location ?? "—"}</div>
          </div>
        </div>

        {/* Minutes (read-only) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="notes" style={{ color: C.orange }} /> Biên bản cuộc họp & Ghi chú</h4>
            {minutes?.isSubmitted && <span className="flex items-center gap-1 text-xs" style={{ color: "#15803D" }}><Ms name="cloud_done" className="text-[16px]!" /> Đã chốt</span>}
          </div>
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: C.border }}>
            <div className="flex gap-1 border-b p-2" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
              {["format_bold", "format_italic", "format_list_bulleted", "attach_file", "link"].map((ic) => (
                <span key={ic} className="rounded p-2 opacity-50"><Ms name={ic} className="text-[16px]!" /></span>
              ))}
            </div>
            <textarea value={minutes?.discussion ?? ""} disabled rows={5}
              placeholder="Giáo viên chưa ghi biên bản cho cuộc họp này."
              className="w-full resize-none border-none p-4 text-sm outline-none disabled:bg-slate-50" style={{ color: C.onSurface }} />
          </div>
          {(minutes?.agreements || minutes?.decisions) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Thống nhất</p>
                <p className="whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: C.border, color: C.onSurface }}>{minutes?.agreements || "—"}</p>
              </div>
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Quyết định</p>
                <p className="whitespace-pre-wrap rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: C.border, color: C.onSurface }}>{minutes?.decisions || "—"}</p>
              </div>
            </div>
          )}
        </div>

        {/* Follow-up tasks (read-only) */}
        <div className="space-y-3">
          <h4 className="flex items-center gap-2 font-bold" style={{ color: C.onSurface }}><Ms name="task_alt" style={{ color: C.orange }} /> Các đầu việc cần theo dõi</h4>
          <div className="space-y-2">
            {actions.length === 0 && <p className="text-sm text-slate-400">Chưa có công việc nào.</p>}
            {actions.map((a) => {
              const done = a.status === "COMPLETED";
              return (
                <div key={a.actionId} className="flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: C.surfaceLow }}>
                  <input type="checkbox" checked={done} disabled className="h-5 w-5 accent-[#F27123] opacity-70" />
                  <div className="grow">
                    <p className={`text-sm ${done ? "line-through opacity-50" : ""}`} style={{ color: C.onSurface }}>{a.title}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>Hạn {formatDateVN(a.deadline)}{a.assigneeName ? ` · ${a.assigneeName}` : ""}</p>
                  </div>
                  {a.isOverdue && !done
                    ? <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: "rgba(186,26,26,0.1)", color: C.error }}>Quá hạn</span>
                    : done ? <span className="rounded px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: "#DCFCE7", color: "#15803D" }}>Xong</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function MeetingsPage() {
  const { user } = useAuth();
  const { students } = useParentStudents();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const [cursor, setCursor] = useState(null);

  useEffect(() => {
    let m = true; beginLoad(setLoading);
    parentMeetingApi.list({ limit: 100 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh", role: "Phụ huynh", avatar: user?.avatar ?? "",
  }), [user]);

  const meetings = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => String(b.meetingDate).localeCompare(String(a.meetingDate))),
    [data],
  );

  // default selection: nearest upcoming SCHEDULED, else most recent
  const selected = useMemo(() => {
    if (selectedId) return meetings.find((m) => m.meetingId === selectedId) ?? null;
    const now = nowMs();
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

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT} sidebarFooterLabel="Năm học hiện tại" sidebarFooterValue={getCurrentSchoolYearLabel(students)}>
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Lịch Họp Phụ Huynh</h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 h-150 animate-pulse rounded-3xl bg-slate-200/50 lg:col-span-4" />
          <div className="col-span-12 h-150 animate-pulse rounded-3xl bg-slate-200/50 lg:col-span-8" />
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
            <div className="flex max-h-130 flex-col overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: C.border }}>
                <h3 className="font-bold" style={{ color: C.onSurface }}>Các buổi đã lên lịch</h3>
                <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>{meetings.length} Hoạt động</span>
              </div>
              <div className="grow space-y-2 overflow-y-auto p-2">
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
                          <h4 className="truncate font-bold" style={{ color: C.onSurface }}>{m.teacherName ? `GV: ${m.teacherName}` : (m.className ?? "Họp lớp")}</h4>
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
            <ParentDetailPane meetingId={effSelectedId} onChanged={bump} />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default MeetingsPage;
