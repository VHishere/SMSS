import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { eventApi } from "../../api/client";
import { formatDateTimeVN } from "../../utils/datetime";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────
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
  ACTIVE:    { label: "Đang mở",    bg: "#DCFCE7", text: "#15803D" },
  COMPLETED: { label: "Hoàn thành", bg: "#EBF3FF", text: "#225DAD" },
  CANCELLED: { label: "Đã hủy",     bg: "#FFDAD6", text: "#93000A" },
  ARCHIVED:  { label: "Lưu trữ",    bg: "#E8E8E8", text: "#584238" },
};
const ATT = {
  REGISTERED: { label: "Đã đăng ký", bg: "#EBF3FF", text: "#225DAD" },
  PRESENT:    { label: "Có mặt",     bg: "#DCFCE7", text: "#15803D" },
  ABSENT:     { label: "Vắng",       bg: "#FFDAD6", text: "#93000A" },
  EXCUSED:    { label: "Có phép",    bg: "#EBF3FF", text: "#225DAD" },
  LATE:       { label: "Muộn",       bg: "#FEF3C7", text: "#B45309" },
};
const CHECK = { REGISTERED: "Đang chờ", PRESENT: "Đã điểm danh", ABSENT: "Vắng", EXCUSED: "Có phép", LATE: "Điểm danh muộn" };
const PTYPE = { STUDENT: "Học sinh", PARENT: "Phụ huynh", TEACHER: "Giáo viên" };
const AVA = ["#00458E", "#F27123", "#225DAD", "#7C3AED"];
const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const MONTHS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const initials = (n) => (n ? n.trim().split(/\s+/).slice(-2).map((w) => w[0]).join("").toUpperCase() : "?");
const monthOf = (s) => ({ y: +s.slice(0, 4), m: +s.slice(5, 7) - 1 });
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
function dateLong(s) { if (!s) return "—"; const [y, mo, da] = s.slice(0, 10).split("-"); return `${+da} tháng ${+mo}, ${y}`; }
const hhmm = (s) => (s && s.length >= 16 ? s.slice(11, 16) : "");

function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ classes: [], categories: [] });
  const [upcoming, setUpcoming] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [featuredId, setFeaturedId] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [attFilter, setAttFilter] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const csvRef = useRef(null);

  useEffect(() => {
    let m = true;
    eventApi.getMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    eventApi.getDashboard().then((res) => { if (m) setUpcoming(res.data.stats?.upcoming ?? 0); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  useEffect(() => {
    let m = true;
    setLoading(true);
    eventApi.list({ limit: 200 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const events = useMemo(() => data?.items ?? [], [data]);
  const catLabel = useMemo(() => Object.fromEntries(meta.categories.map((c) => [c.key, c.label])), [meta]);

  const featured = useMemo(() => {
    if (!events.length) return null;
    if (featuredId) return events.find((e) => e.eventId === featuredId) ?? events[0];
    const now = Date.now();
    const up = events
      .filter((e) => e.status === "ACTIVE" && new Date(String(e.startDate).replace(" ", "T")).getTime() >= now)
      .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
    return up[0] ?? events[0];
  }, [events, featuredId]);

  useEffect(() => {
    let m = true;
    const timer = setTimeout(() => {
      if (!featured) { setDetail(null); setDetailError(""); return; }
      setDetail(null);
      setDetailError("");
      eventApi.getDetail(featured.eventId)
        .then((res) => { if (m) setDetail(res.data); })
        .catch((err) => { if (m) setDetailError(err.message); });
    }, 0);
    return () => { m = false; clearTimeout(timer); };
  }, [featured?.eventId]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const ev = detail?.event ?? featured;
  const stats = detail?.stats;
  const participants = useMemo(() => detail?.participants ?? [], [detail]);
  const total = stats?.total ?? featured?.participantCount ?? 0;
  const capacity = ev?.capacity ?? null;
  const pct = capacity ? Math.round((total / capacity) * 100) : null;
  const isUpcoming = ev && ev.status === "ACTIVE" && new Date(String(ev.startDate).replace(" ", "T")).getTime() >= Date.now();

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

  const shownParticipants = useMemo(
    () => (attFilter ? participants.filter((p) => p.attendStatus === attFilter) : participants),
    [participants, attFilter],
  );

  function focusEvent(id) { setFeaturedId(id); setAttFilter(""); }

  function shareLink() {
    const url = `${window.location.origin}/teacher/events/${featured.eventId}`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => {});
  }

  function exportCsv() {
    const head = ["Tên người tham gia", "Đối tượng", "Trạng thái", "Điểm danh"];
    const rows = participants.map((p) => [
      p.name ?? "",
      (PTYPE[p.participantType] ?? "") + (p.studentName ? ` (${p.studentName})` : ""),
      ATT[p.attendStatus]?.label ?? p.attendStatus ?? "",
      CHECK[p.attendStatus] ?? "",
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = csvRef.current;
    a.href = url; a.download = `dang-ky-${(ev?.title ?? "su-kien").replace(/[^\w-]+/g, "_")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const mapsUrl = ev?.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}` : null;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Sự kiện sắp tới" sidebarFooterValue={String(upcoming)}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Sự kiện</h2>
        </div>

        <button type="button" onClick={() => setRefresh((k) => k + 1)}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: C.surfaceLow, color: C.onSurface, border: `1px solid ${C.border}` }}>
          <Ms name="refresh" className="!text-[18px]" /> Làm mới
        </button>
      </div>

      {loading && <div className="h-[70vh] animate-pulse rounded-3xl bg-slate-200/50" />}

      {!loading && !featured && (
        <div className="rounded-3xl bg-white p-12 text-center shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <Ms name="event_busy" className="!text-[40px]" style={{ color: C.border }} />
          <p className="mt-2 text-sm text-slate-400">Chưa có sự kiện nào. Sự kiện sẽ xuất hiện khi giáo vụ tạo và mở cho lớp bạn.</p>
        </div>
      )}

      {!loading && featured && (
        <div className="grid grid-cols-12 gap-6">
          {/* ── Left column ── */}
          <div className="col-span-12 space-y-6 lg:col-span-8">
            {/* Featured event */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="relative h-64">
                <div className="absolute inset-0" style={{ background: ev?.imageUrl ? `url(${ev.imageUrl}) center/cover` : "linear-gradient(135deg,#00458E 0%,#225DAD 45%,#F27123 100%)" }} />
                <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-6 left-6 z-20 text-white">
                  <span className="mb-2 inline-block rounded-full px-3 py-1 text-xs font-bold tracking-wider" style={{ backgroundColor: C.orange }}>
                    {isUpcoming ? "SẮP DIỄN RA" : (STATUS[ev.status]?.label ?? "").toUpperCase()}
                  </span>
                  <h3 className="text-3xl font-bold">{ev.title}</h3>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-sm opacity-90">
                    <span className="flex items-center gap-1"><Ms name="calendar_month" className="!text-[18px]" /> {dateLong(ev.startDate)}</span>
                    {hhmm(ev.startDate) && <span className="flex items-center gap-1"><Ms name="schedule" className="!text-[18px]" /> {hhmm(ev.startDate)}{hhmm(ev.endDate) ? ` - ${hhmm(ev.endDate)}` : ""}</span>}
                    <span className="flex items-center gap-1"><Ms name="location_on" className="!text-[18px]" /> {ev.location || (ev.className ?? "Toàn trường")}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6 p-6 md:flex-row">
                <div className="flex-grow">
                  <h4 className="mb-2 text-lg font-bold" style={{ color: C.onSurface }}>Chi tiết sự kiện</h4>
                  <p className="text-sm leading-relaxed" style={{ color: C.muted }}>
                    {ev.description || "Chưa có mô tả cho sự kiện này."}
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="flex -space-x-3">
                      {participants.slice(0, 3).map((p, i) => (
                        <div key={p.registrationId ?? i} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-[12px] font-bold text-white" style={{ backgroundColor: AVA[i % AVA.length] }}>
                          {initials(p.name)}
                        </div>
                      ))}
                      {total > 3 && (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white text-[12px] font-bold" style={{ backgroundColor: "#EBF3FF", color: C.secondary }}>+{total - 3}</div>
                      )}
                    </div>
                    <span className="text-sm" style={{ color: C.muted }}>{total > 0 ? `${total} người đã đăng ký` : "Chưa có người đăng ký"}</span>
                  </div>
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
                  <div className="flex gap-2">
                    <button type="button" onClick={() => navigate(`/teacher/events/${featured.eventId}`)}
                      className="flex-grow rounded-full px-4 py-2 text-sm font-bold text-white transition-colors hover:opacity-90"
                      style={{ backgroundColor: C.deepBlue }}>Xem chi tiết</button>
                    <button type="button" onClick={shareLink} title={copied ? "Đã copy link" : "Copy link"}
                      className="rounded-full border p-2 transition-colors hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: copied ? C.orange : C.muted }}>
                      <Ms name={copied ? "check" : "share"} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendee list */}
            <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between border-b p-6" style={{ borderColor: C.border }}>
                <h4 className="text-lg font-bold" style={{ color: C.onSurface }}>Danh sách đăng ký</h4>
                <div className="flex items-center gap-4">
                  <button type="button" onClick={exportCsv} disabled={!participants.length}
                    className="flex items-center gap-1 text-sm font-medium disabled:opacity-40" style={{ color: C.secondary }}>
                    <Ms name="download" className="!text-[18px]" /> Xuất CSV
                  </button>
                  <button type="button" onClick={() => setShowFilter((v) => !v)}
                    className="flex items-center gap-1 text-sm font-medium" style={{ color: showFilter ? C.orange : C.secondary }}>
                    <Ms name="filter_list" className="!text-[18px]" /> Bộ lọc
                  </button>
                </div>
              </div>

              {showFilter && (
                <div className="flex flex-wrap items-center gap-2 border-b px-6 py-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
                  <span className="text-xs font-medium" style={{ color: C.muted }}>Trạng thái:</span>
                  {[["", "Tất cả"], ...Object.entries(ATT).map(([k, v]) => [k, v.label])].map(([k, label]) => (
                    <button key={k} type="button" onClick={() => setAttFilter(k)}
                      className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                      style={attFilter === k ? { backgroundColor: C.orange, color: "#fff" } : { backgroundColor: "#fff", color: C.muted, border: `1px solid ${C.border}` }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                    <tr>
                      <th className="px-6 py-3 font-medium">Tên người tham gia</th>
                      <th className="px-6 py-3 font-medium">Đối tượng</th>
                      <th className="px-6 py-3 font-medium">Trạng thái</th>
                      <th className="px-6 py-3 font-medium">Thời gian điểm danh</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: C.border }}>
                    {detailError ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-red-500">Không thể tải danh sách: {detailError}</td></tr>
                    ) : !detail ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">Đang tải danh sách...</td></tr>
                    ) : shownParticipants.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-slate-400">Chưa có người đăng ký.</td></tr>
                    ) : shownParticipants.map((p, i) => {
                      const st = ATT[p.attendStatus] ?? ATT.REGISTERED;
                      return (
                        <tr key={p.registrationId ?? i} className="transition-colors hover:bg-[#F3F3F3]">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: AVA[i % AVA.length] }}>{initials(p.name)}</div>
                              <span style={{ color: C.onSurface }}>{p.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3" style={{ color: C.muted }}>{PTYPE[p.participantType] ?? "—"}</td>
                          <td className="px-6 py-3"><span className="rounded px-2 py-1 text-[10px] font-bold uppercase tracking-tight" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                          <td className="px-6 py-3" style={{ color: C.muted }}>{CHECK[p.attendStatus] ?? "—"}</td>
                          <td className="px-6 py-3 text-right">
                            <button type="button" onClick={() => navigate(`/teacher/events/${featured.eventId}?tab=participants`)} className="text-slate-400 transition-colors hover:text-[#F27123]"><Ms name="more_vert" /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                <Ms name="location_on" className="!text-[40px]" style={{ color: C.border }} />
                {mapsUrl && <span className="absolute bottom-2 right-2 rounded bg-white/90 px-2 py-1 text-[10px] font-bold" style={{ color: C.muted }}>Xem trên Google Maps</span>}
              </div>
              <div className="p-6">
                <p className="text-sm font-bold" style={{ color: C.onSurface }}>{ev?.location || "Chưa cập nhật địa điểm"}</p>
                <p className="text-sm" style={{ color: C.muted }}>{ev?.organizer ? `Tổ chức: ${ev.organizer}` : (ev?.className ?? "Toàn trường")}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex w-fit items-center gap-2 text-sm font-bold hover:underline" style={{ color: C.orange }}>
                    <Ms name="directions" className="!text-[18px]" /> Chỉ đường
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
                      <div className="min-w-0 flex-grow">
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

      <a ref={csvRef} className="hidden" aria-hidden="true">csv</a>

    </DashboardShell>
  );
}

export default EventsPage;
