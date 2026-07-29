import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentApi } from "../../api/client";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentEvents } from "../../hooks/useParentStudentEvents";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

// ─── FSchool Stitch design tokens (matches teacher/EventsPage.jsx) ───────────
const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  orange: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const STATUS = {
  ACTIVE:    { label: "Đang mở",     bg: "#DCFCE7", text: "#15803D" },
  PUBLISHED: { label: "Đã công bố",  bg: "#EBF3FF", text: "#225DAD" },
  SCHEDULED: { label: "Đã lên lịch", bg: "#EBF3FF", text: "#225DAD" },
  COMPLETED: { label: "Hoàn thành",  bg: "#EBF3FF", text: "#225DAD" },
  CANCELLED: { label: "Đã hủy",      bg: "#FFDAD6", text: "#93000A" },
};
const REGISTRABLE = ["ACTIVE", "PUBLISHED", "SCHEDULED"];
const AVA = ["#00458E", "#F27123", "#225DAD", "#7C3AED"];
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const monthOf = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 });
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function dateLong(s) { if (!s) return "—"; const [y, mo, da] = s.slice(0, 10).split("-"); return `${+da} tháng ${+mo}, ${y}`; }
const hhmm = (s) => (s && s.length >= 16 ? s.slice(11, 16) : "");
const nowMs = () => Date.now();
function resetSelection(setFeaturedId, setCursor, setRegMsg) {
  setFeaturedId(null);
  setCursor(null);
  setRegMsg({ text: "", ok: true });
}

function EventsPage() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");

  const [featuredId, setFeaturedId] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [regMsg, setRegMsg] = useState({ text: "", ok: true });
  const [refresh, setRefresh] = useState(0);

  const { data, loading } = useParentStudentEvents(effStudentId, {}, refresh);

  useEffect(() => { resetSelection(setFeaturedId, setCursor, setRegMsg); }, [effStudentId]);

  const events = useMemo(() => data?.events ?? [], [data]);

  const featured = useMemo(() => {
    if (!events.length) return null;
    if (featuredId) return events.find((e) => e.eventId === featuredId) ?? events[0];
    const now = nowMs();
    const up = events
      .filter((e) => REGISTRABLE.includes(e.status) && new Date(String(e.startDate).replace(" ", "T")).getTime() >= now)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    return up[0] ?? events[0];
  }, [events, featuredId]);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh", role: "Phụ huynh", avatar: user?.avatar ?? "",
  }), [user]);

  const ev = featured;
  const total = ev?.registeredCount ?? 0;
  const capacity = ev?.capacity ?? null;
  const pct = capacity ? Math.round((total / capacity) * 100) : null;
  const isUpcoming = ev && REGISTRABLE.includes(ev.status) && new Date(String(ev.startDate).replace(" ", "T")).getTime() >= nowMs();
  const canRegister = ev && REGISTRABLE.includes(ev.status) && !ev.isRegistered;

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) { const d = e.startDate?.slice(0, 10); if (d) (map[d] = map[d] || []).push(e); }
    return map;
  }, [events]);

  const shown = cursor ?? (featured ? monthOf(featured.startDate) : (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })());
  const featuredDay = featured?.startDate?.slice(0, 10);
  const cells = useMemo(() => {
    const first = new Date(shown.y, shown.m, 1);
    const startDow = first.getDay();
    const daysIn = new Date(shown.y, shown.m + 1, 0).getDate();
    const prevDays = new Date(shown.y, shown.m, 0).getDate();
    const arr = [];
    for (let i = startDow - 1; i >= 0; i--) arr.push({ d: prevDays - i, out: true });
    for (let d = 1; d <= daysIn; d++) arr.push({ d, out: false, key: iso(shown.y, shown.m, d) });
    return arr;
  }, [shown.y, shown.m]);

  const otherEvents = useMemo(
    () => events.filter((e) => e.eventId !== featured?.eventId).slice(0, 4),
    [events, featured],
  );

  function focusEvent(id) { setFeaturedId(id); setRegMsg({ text: "", ok: true }); }

  async function register() {
    if (!ev || !effStudentId) return;
    setRegistering(true); setRegMsg({ text: "", ok: true });
    try {
      const res = await parentApi.registerStudentEvent(effStudentId, ev.eventId);
      setRegMsg({ text: res.message ?? "Đã đăng ký sự kiện", ok: true });
      setRefresh((k) => k + 1);
    } catch (e) {
      setRegMsg({ text: e.message ?? "Có lỗi xảy ra", ok: false });
    } finally {
      setRegistering(false);
    }
  }

  const mapsUrl = ev?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}` : null;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT} sidebarFooterLabel="Năm học hiện tại" sidebarFooterValue={getCurrentSchoolYearLabel(students)}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Sự kiện</h2>
      </div>

      {students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button key={s.studentId} type="button" onClick={() => setSelectedStudentId(String(s.studentId))}
              className="rounded-full px-4 py-2 text-sm font-bold transition-colors"
              style={String(s.studentId) === effStudentId
                ? { backgroundColor: C.orange, color: "#fff" }
                : { border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.muted }}>
              {s.studentFullName}{s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
            </button>
          ))}
        </div>
      )}

      {studentsLoading ? (
        <div className="h-[70vh] animate-pulse rounded-3xl bg-slate-200/50" />
      ) : students.length === 0 ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <Ms name="person_off" className="text-[40px]!" style={{ color: C.border }} />
          <p className="mt-2 text-sm text-slate-400">Không tìm thấy thông tin học sinh.</p>
        </div>
      ) : loading ? (
        <div className="h-[70vh] animate-pulse rounded-3xl bg-slate-200/50" />
      ) : !featured ? (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <Ms name="event_busy" className="text-[40px]!" style={{ color: C.border }} />
          <p className="mt-2 text-sm text-slate-400">Chưa có sự kiện nào dành cho học sinh này.</p>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* ── Left column ── */}
          <div className="col-span-12 space-y-6 lg:col-span-8">
            {/* Featured event */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="relative h-64">
                <div className="absolute inset-0" style={{ background: ev?.imageUrl ? `url(${ev.imageUrl}) center/cover` : "linear-gradient(135deg,#00458E 0%,#225DAD 45%,#F27123 100%)" }} />
                <div className="absolute inset-0 z-10 bg-linear-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-6 left-6 z-20 text-white">
                  <span className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wider" style={{ backgroundColor: C.orange }}>
                    {isUpcoming ? "SẮP DIỄN RA" : (STATUS[ev.status]?.label ?? "").toUpperCase()}
                  </span>
                  <h3 className="text-3xl font-bold">{ev.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm opacity-90">
                    <span className="flex items-center gap-1"><Ms name="calendar_month" className="text-[18px]!" /> {dateLong(ev.startDate)}</span>
                    {hhmm(ev.startDate) && <span className="flex items-center gap-1"><Ms name="schedule" className="text-[18px]!" /> {hhmm(ev.startDate)}{hhmm(ev.endDate) ? ` - ${hhmm(ev.endDate)}` : ""}</span>}
                    <span className="flex items-center gap-1"><Ms name="location_on" className="text-[18px]!" /> {ev.location || (ev.className ?? "Toàn trường")}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 p-6 md:flex-row">
                <div className="grow">
                  <h4 className="mb-2 text-lg font-bold" style={{ color: C.onSurface }}>Chi tiết sự kiện</h4>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                    {ev.description || "Chưa có mô tả cho sự kiện này."}
                  </p>
                  {ev.outcome && (
                    <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#EBF3FF", color: C.secondary }}>
                      Kết quả: {ev.outcome}
                    </p>
                  )}
                </div>

                <div className="w-full space-y-3 md:w-64">
                  <div className="rounded-2xl p-4" style={{ backgroundColor: C.surfaceLow }}>
                    <p className="mb-1 text-[10px] font-bold uppercase" style={{ color: C.muted }}>Trạng thái đăng ký</p>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold" style={{ color: C.orange }}>{pct !== null ? `${pct}%` : total}</span>
                      <span className="text-sm" style={{ color: C.muted }}>{capacity ? `${total}/${capacity} Sức chứa` : "đã đăng ký"}</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.border }}>
                      <div className="h-full rounded-full" style={{ width: `${pct !== null ? Math.min(pct, 100) : (total > 0 ? 100 : 0)}%`, backgroundColor: C.orange }} />
                    </div>
                  </div>
                  <button type="button" onClick={register} disabled={!canRegister || registering}
                    className="w-full rounded-full px-4 py-2.5 text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: ev.status === "CANCELLED" ? "#94A3B8" : ev.isRegistered ? "#15803D" : canRegister ? C.orange : "#94A3B8" }}>
                    {ev.status === "CANCELLED" ? "Sự kiện đã hủy"
                      : ev.status === "COMPLETED" ? "Đã kết thúc"
                      : ev.isRegistered ? "Đã đăng ký"
                      : registering ? "Đang đăng ký..." : "Đăng ký"}
                  </button>
                  {regMsg.text && (
                    <p className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ backgroundColor: regMsg.ok ? "#ECFDF5" : "#FEF2F2", color: regMsg.ok ? "#16A34A" : "#DC2626" }}>
                      {regMsg.text}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div className="col-span-12 space-y-6 lg:col-span-4">
            {/* Calendar */}
            <div className="rounded-3xl bg-white p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-lg font-bold" style={{ color: C.onSurface }}>Tháng {MONTHS[shown.m]} {shown.y}</h4>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setCursor(shown.m === 0 ? { y: shown.y - 1, m: 11 } : { y: shown.y, m: shown.m - 1 })} className="rounded p-1 transition-colors hover:bg-[#F3F3F3]"><Ms name="chevron_left" /></button>
                  <button type="button" onClick={() => setCursor(shown.m === 11 ? { y: shown.y + 1, m: 0 } : { y: shown.y, m: shown.m + 1 })} className="rounded p-1 transition-colors hover:bg-[#F3F3F3]"><Ms name="chevron_right" /></button>
                </div>
              </div>
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs">
                {WD.map((d) => <div key={d} style={{ color: C.muted, opacity: 0.6 }}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-sm">
                {cells.map((c, i) => {
                  if (c.out) return <div key={i} className="p-2" style={{ color: C.muted, opacity: 0.3 }}>{c.d}</div>;
                  const dayEvents = byDay[c.key] ?? [];
                  const isFeatured = c.key === featuredDay;
                  return (
                    <button key={i} type="button" disabled={!dayEvents.length}
                      onClick={() => dayEvents.length && focusEvent(dayEvents[0].eventId)}
                      className="relative rounded-lg p-2 transition-colors disabled:cursor-default"
                      style={isFeatured
                        ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700, boxShadow: "0 1px 3px rgba(0,0,0,0.12)" }
                        : { color: C.onSurface, cursor: dayEvents.length ? "pointer" : "default" }}>
                      {c.d}
                      {!isFeatured && dayEvents.length > 0 && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full" style={{ backgroundColor: C.orange }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Venue */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between border-b p-4" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
                <span className="text-lg font-bold" style={{ color: C.onSurface }}>Địa điểm tổ chức</span>
                <Ms name="map" style={{ color: C.orange }} />
              </div>
              <div className="relative flex h-48 items-center justify-center" style={{ backgroundColor: C.surfaceHigh }}>
                <Ms name="location_on" className="text-[40px]!" style={{ color: C.border }} />
                {mapsUrl && <span className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold" style={{ color: C.muted }}>Xem trên Google Maps</span>}
              </div>
              <div className="p-6">
                <p className="text-sm font-bold" style={{ color: C.onSurface }}>{ev?.location || "Chưa cập nhật địa điểm"}</p>
                <p className="text-sm" style={{ color: C.muted }}>{ev?.organizer ? `Tổ chức: ${ev.organizer}` : (ev?.className ?? "Toàn trường")}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-fit items-center gap-2 text-sm font-bold hover:underline" style={{ color: C.orange }}>
                    <Ms name="directions" className="text-[18px]!" /> Chỉ đường
                  </a>
                )}
              </div>
            </div>

            {/* Other events */}
            <div className="rounded-3xl bg-white p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h4 className="mb-4 text-lg font-bold" style={{ color: C.onSurface }}>Sự kiện khác</h4>
              {otherEvents.length === 0 ? (
                <p className="text-sm text-slate-400">Không có sự kiện nào khác.</p>
              ) : (
                <div className="space-y-4">
                  {otherEvents.map((e, i) => (
                    <button key={e.eventId} type="button" onClick={() => focusEvent(e.eventId)}
                      className="group flex w-full gap-4 rounded-2xl border p-4 text-left transition-colors hover:border-[#F27123]" style={{ borderColor: C.border }}>
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg font-bold text-white" style={{ backgroundColor: AVA[(i + 1) % AVA.length] }}>
                        <span className="text-[10px]">T{+e.startDate?.slice(5, 7)}</span>
                        <span>{e.startDate?.slice(8, 10)}</span>
                      </div>
                      <div className="min-w-0 grow">
                        <h5 className="truncate text-sm font-bold transition-colors group-hover:text-[#F27123]" style={{ color: C.onSurface }}>{e.title}</h5>
                        <p className="truncate text-[11px]" style={{ color: C.muted }}>{(e.location || (e.className ?? "Toàn trường"))}{hhmm(e.startDate) ? ` • ${hhmm(e.startDate)}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default EventsPage;
