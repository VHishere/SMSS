import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiChevronLeft, FiChevronRight, FiGrid, FiList, FiPlus, FiSearch } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import MeetingFormModal from "../../components/organisms/MeetingFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { meetingApi } from "../../api/client";

const STATUS = {
  SCHEDULED: { label: "Đã lên lịch", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED: { label: "Hoàn thành",  bg: "#ECFDF5", text: "#16A34A" },
  CANCELLED: { label: "Đã hủy",      bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:  { label: "Lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const selectCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";
const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function MeetingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meta, setMeta] = useState({ classes: [] });
  const [upcoming, setUpcoming] = useState(0);
  const [view, setView] = useState("list");
  const [statusF, setStatusF] = useState("");
  const [classF, setClassF] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [monthCursor, setMonthCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    let m = true;
    meetingApi.getMeta().then((res) => { if (m) setMeta(res.data); }).catch(() => {});
    meetingApi.getDashboard().then((res) => { if (m) setUpcoming(res.data.stats?.upcoming ?? 0); }).catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  useEffect(() => {
    let m = true;
    setLoading(true);
    meetingApi.list({ status: statusF, classId: classF, search, limit: 100 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [statusF, classF, search, refresh]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const meetings = data?.items ?? [];

  const byDay = useMemo(() => {
    const map = {};
    for (const m of meetings) { const day = m.meetingDate?.slice(0, 10); if (day) (map[day] = map[day] || []).push(m); }
    return map;
  }, [meetings]);

  const calendarCells = useMemo(() => {
    const first = new Date(monthCursor.y, monthCursor.m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(monthCursor.y, monthCursor.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${monthCursor.y}-${String(monthCursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ d, iso, meetings: byDay[iso] ?? [] });
    }
    return cells;
  }, [monthCursor, byDay]);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Cuộc họp sắp tới" sidebarFooterValue={String(upcoming)}>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>Họp phụ huynh</h1>
        <button type="button" onClick={() => setShowCreate(true)} disabled={meta.classes.length === 0}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ backgroundColor: "#F27123" }}>
          <FiPlus size={15} /> Tạo cuộc họp
        </button>
      </div>

      {/* Controls: view toggle (left) + filters (right) */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button type="button" onClick={() => setView("list")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={view === "list" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}><FiList size={14} /> Danh sách</button>
          <button type="button" onClick={() => setView("calendar")} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium" style={view === "calendar" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}><FiGrid size={14} /> Lịch</button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selectCls}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={classF} onChange={(e) => setClassF(e.target.value)} className={selectCls}>
            <option value="">Tất cả lớp</option>
            {meta.classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
          </select>
          <div className="flex items-center rounded-xl border border-slate-200 bg-white px-2.5 shadow-sm">
            <FiSearch size={14} className="text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tiêu đề..." className="w-40 px-2 py-2 text-sm outline-none" />
          </div>
        </div>
      </div>

      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}</div>}

      {!loading && view === "list" && (
        meetings.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có cuộc họp nào.</div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => {
              const st = STATUS[m.status] ?? STATUS.SCHEDULED;
              return (
                <button key={m.meetingId} type="button" onClick={() => navigate(`/teacher/meetings/${m.meetingId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="text-xs font-bold" style={{ color: "#F27123" }}>{m.meetingDate?.slice(8, 10)}/{m.meetingDate?.slice(5, 7)}</span>
                      <span className="text-[10px] text-slate-400">{m.meetingDate?.slice(11, 16)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F2747]">{m.title}</p>
                      <p className="text-xs text-slate-400">{m.className ?? "—"}{m.studentName ? ` · ${m.studentName}` : ""}{m.location ? ` · ${m.location}` : ""}</p>
                      <p className="text-xs text-slate-400">{m.acceptedCount}/{m.inviteeCount} xác nhận{m.openActions > 0 ? ` · ${m.openActions} việc cần làm` : ""}</p>
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
                {cell && (
                  <>
                    <span className="text-slate-400">{cell.d}</span>
                    <div className="mt-1 space-y-0.5">
                      {cell.meetings.slice(0, 2).map((m) => (
                        <button key={m.meetingId} type="button" onClick={() => navigate(`/teacher/meetings/${m.meetingId}`)}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white" style={{ backgroundColor: "#F27123" }}>
                          {m.meetingDate?.slice(11, 16)} {m.title}
                        </button>
                      ))}
                      {cell.meetings.length > 2 && <span className="text-[10px] text-slate-400">+{cell.meetings.length - 2} nữa</span>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <MeetingFormModal mode="create" classes={meta.classes} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefresh((k) => k + 1); }} />
      )}
    </DashboardShell>
  );
}

export default MeetingsPage;
