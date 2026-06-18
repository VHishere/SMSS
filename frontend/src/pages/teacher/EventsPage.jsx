import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiBarChart2, FiCalendar, FiCheckCircle, FiChevronLeft, FiChevronRight, FiGrid, FiList, FiPlay, FiPlus, FiSearch, FiTrendingUp,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import EventFormModal from "../../components/organisms/EventFormModal";
import GradeDistributionChart from "../../components/organisms/GradeDistributionChart";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { eventApi } from "../../api/client";

const STATUS = {
  ACTIVE: { label: "Đang mở", bg: "#ECFDF5", text: "#16A34A" },
  COMPLETED: { label: "Hoàn thành", bg: "#EBF3FF", text: "#08509F" },
  CANCELLED: { label: "Đã hủy", bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED: { label: "Lưu trữ", bg: "#F1F5F9", text: "#475569" },
};
const selectCls = "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";
const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function StatBox({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <div className="flex items-center justify-between gap-3">
        <div><p className="mb-1 text-xs font-medium text-slate-500">{label}</p><p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p></div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: bg }}><Icon size={18} style={{ color }} /></div>
      </div>
    </div>
  );
}

function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ classes: [], categories: [] });
  const [stats, setStats] = useState({ upcoming: 0, ongoing: 0, completed: 0, total: 0 });
  const [analytics, setAnalytics] = useState(null);
  const [view, setView] = useState("list");
  const [statusF, setStatusF] = useState("");
  const [categoryF, setCategoryF] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    let m = true;
    eventApi.getMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    eventApi.getDashboard().then((res) => { if (m) setStats(res.data.stats); }).catch(() => {});
    eventApi.getAnalytics().then((res) => { if (m) setAnalytics(res.data); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  useEffect(() => {
    let m = true;
    setLoading(true);
    eventApi.list({ status: statusF, category: categoryF, search, limit: 200 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [statusF, categoryF, search, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const events = data?.items ?? [];
  const catLabel = useMemo(() => Object.fromEntries(meta.categories.map((c) => [c.key, c.label])), [meta]);

  const byDay = useMemo(() => {
    const map = {};
    for (const e of events) { const day = e.startDate?.slice(0, 10); if (day) (map[day] = map[day] || []).push(e); }
    return map;
  }, [events]);

  const calendarCells = useMemo(() => {
    const first = new Date(monthCursor.y, monthCursor.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const days = new Date(monthCursor.y, monthCursor.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) {
      const iso = `${monthCursor.y}-${String(monthCursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ d, events: byDay[iso] ?? [] });
    }
    return cells;
  }, [monthCursor, byDay]);

  const maxMonth = analytics ? Math.max(...analytics.byMonth.map((x) => x.count), 1) : 1;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Sự kiện sắp tới" sidebarFooterValue={String(stats.upcoming)}>
      <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
          <h1 className="text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Quản lý sự kiện</h1>
          <p className="text-sm text-slate-500">Tạo, theo dõi người tham dự, điểm danh và thống kê sự kiện.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
          <FiPlus size={15} /> Tạo sự kiện
        </button>
      </section>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox icon={FiCalendar}    label="Sắp diễn ra" value={stats.upcoming}  color="#F27123" bg="#FFF0E8" />
        <StatBox icon={FiPlay}        label="Đang diễn ra" value={stats.ongoing}  color="#16A34A" bg="#ECFDF5" />
        <StatBox icon={FiCheckCircle} label="Đã hoàn thành" value={stats.completed} color="#08509F" bg="#EBF3FF" />
        <StatBox icon={FiBarChart2}   label="Tổng sự kiện" value={stats.total}    color="#0F2747" bg="#FFF7F2" />
      </div>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Trạng thái</label>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selectCls}>
              <option value="">Tất cả</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Danh mục</label>
            <select value={categoryF} onChange={(e) => setCategoryF(e.target.value)} className={selectCls}>
              <option value="">Tất cả</option>
              {meta.categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tìm</label>
            <div className="flex items-center rounded-lg border border-slate-200 px-2.5"><FiSearch size={14} className="text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tiêu đề..." className="w-40 px-2 py-2 text-sm outline-none" /></div>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => setView("list")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={view === "list" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}><FiList size={14} /> Danh sách</button>
          <button type="button" onClick={() => setView("calendar")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={view === "calendar" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}><FiGrid size={14} /> Lịch</button>
          <button type="button" onClick={() => setView("analytics")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={view === "analytics" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}><FiTrendingUp size={14} /> Thống kê</button>
        </div>
      </div>

      {loading && view !== "analytics" && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}</div>}

      {!loading && view === "list" && (
        events.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có sự kiện nào.</div>
        ) : (
          <div className="space-y-3">
            {events.map((e) => {
              const st = STATUS[e.status] ?? STATUS.ACTIVE;
              return (
                <button key={e.eventId} type="button" onClick={() => navigate(`/teacher/events/${e.eventId}`)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="text-xs text-slate-400">{e.startDate?.slice(5, 7)}/{e.startDate?.slice(8, 10)}</span>
                      <span className="text-xs font-bold" style={{ color: "#F27123" }}>{e.startDate?.slice(11)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F2747]">{e.title}</p>
                      <p className="text-xs text-slate-400">{catLabel[e.category] ?? e.category ?? "—"}{e.className ? ` · ${e.className}` : " · Toàn trường"}{e.location ? ` · ${e.location}` : ""}</p>
                      <p className="text-xs text-slate-400">{e.participantCount} người · {e.attendedCount} đã dự</p>
                    </div>
                  </div>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                </button>
              );
            })}
          </div>
        )
      )}

      {!loading && view === "calendar" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setMonthCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })} className="rounded-lg p-2 hover:bg-slate-100"><FiChevronLeft size={18} /></button>
            <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Tháng {monthCursor.m + 1}/{monthCursor.y}</h3>
            <button type="button" onClick={() => setMonthCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })} className="rounded-lg p-2 hover:bg-slate-100"><FiChevronRight size={18} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WD.map((d) => <div key={d} className="py-1 text-center text-xs font-bold text-slate-400">{d}</div>)}
            {calendarCells.map((cell, i) => (
              <div key={i} className="min-h-[70px] rounded-lg p-1.5 text-xs" style={{ border: cell ? "1px solid #FFE7D6" : "none", backgroundColor: cell ? "#fff" : "transparent" }}>
                {cell && <>
                  <span className="text-slate-400">{cell.d}</span>
                  <div className="mt-1 space-y-0.5">
                    {cell.events.slice(0, 2).map((e) => (
                      <button key={e.eventId} type="button" onClick={() => navigate(`/teacher/events/${e.eventId}`)} className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white" style={{ backgroundColor: "#F27123" }}>{e.title}</button>
                    ))}
                    {cell.events.length > 2 && <span className="text-[10px] text-slate-400">+{cell.events.length - 2}</span>}
                  </div>
                </>}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "analytics" && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatBox icon={FiBarChart2} label="Tổng lượt tham dự" value={analytics.totalParticipants} color="#08509F" bg="#EBF3FF" />
            <StatBox icon={FiCheckCircle} label="Đã tham dự" value={analytics.totalAttended} color="#16A34A" bg="#ECFDF5" />
            <StatBox icon={FiTrendingUp} label="Tỷ lệ tham dự" value={`${analytics.attendanceRate}%`} color="#F27123" bg="#FFF0E8" />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Phân bố theo danh mục</h3>
            <GradeDistributionChart distribution={analytics.distribution} />
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Số sự kiện theo tháng</h3>
            {analytics.byMonth.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
              <div className="flex items-end gap-4 overflow-x-auto pb-2">
                {analytics.byMonth.map((mo) => (
                  <div key={mo.month} className="flex flex-col items-center gap-1" style={{ minWidth: 48 }}>
                    <span className="text-xs font-bold text-[#0F2747]">{mo.count}</span>
                    <div className="flex h-24 w-7 items-end overflow-hidden rounded-lg bg-slate-100"><div className="w-full rounded-lg" style={{ height: `${(mo.count / maxMonth) * 100}%`, backgroundColor: "#F27123" }} /></div>
                    <span className="text-[10px] text-slate-500">{mo.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <EventFormModal mode="create" classes={meta.classes} categories={meta.categories} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefresh((k) => k + 1); }} />
      )}
    </DashboardShell>
  );
}

export default EventsPage;
