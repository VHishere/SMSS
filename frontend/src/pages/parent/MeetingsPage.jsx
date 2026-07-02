import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar, FiCheckSquare, FiChevronLeft, FiChevronRight, FiClock, FiList, FiMail, FiSearch, FiGrid, FiUsers,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { parentMeetingApi } from "../../api/client";

const STATUS = {
  SCHEDULED: { label: "Đã lên lịch", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED: { label: "Hoàn thành",  bg: "#ECFDF5", text: "#16A34A" },
  CANCELLED: { label: "Đã hủy",      bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:  { label: "Lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const INVITE_STATUS = {
  SENT:     { label: "Đã mời",    bg: "#EBF3FF", text: "#08509F" },
  PENDING:  { label: "Chờ",       bg: "#FFFBEB", text: "#F59E0B" },
  ACCEPTED: { label: "Đã xác nhận", bg: "#ECFDF5", text: "#16A34A" },
  DECLINED: { label: "Từ chối",   bg: "#FEF2F2", text: "#DC2626" },
};
const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";
const WD = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function StatBox({ icon: Icon, label, value, color, bg }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: bg }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function MeetingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ upcoming: 0, pendingResponse: 0, accepted: 0, totalMeetings: 0 });
  const [view, setView] = useState("list");
  const [statusF, setStatusF] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refresh] = useState(0);
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    let m = true;
    parentMeetingApi.getDashboard()
      .then((res) => { if (m) setStats(res.data.stats); })
      .catch(() => {});
    return () => { m = false; };
  }, [refresh]);

  useEffect(() => {
    let m = true;
    setLoading(true);
    parentMeetingApi.list({ status: statusF, search, limit: 100 })
      .then((res) => { if (m) setData(res.data); })
      .catch(() => {})
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [statusF, search, refresh]);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh",
    role: "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  const meetings = data?.items ?? [];

  const byDay = useMemo(() => {
    const map = {};
    for (const m of meetings) {
      const day = m.meetingDate?.slice(0, 10);
      if (!day) continue;
      (map[day] = map[day] || []).push(m);
    }
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
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Cuộc họp sắp tới"
      sidebarFooterValue={String(stats.upcoming)}
    >
      {/* Header */}

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatBox icon={FiClock}       label="Sắp diễn ra"     value={stats.upcoming}       color="#F27123" bg="#FFF0E8" />
        <StatBox icon={FiMail}        label="Chờ xác nhận"    value={stats.pendingResponse} color="#08509F" bg="#EBF3FF" />
        <StatBox icon={FiCheckSquare} label="Đã xác nhận"     value={stats.accepted}        color="#16A34A" bg="#ECFDF5" />
        <StatBox icon={FiUsers}       label="Tổng cuộc họp"   value={stats.totalMeetings}   color="#0F2747" bg="#FFF7F2" />
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Trạng thái</label>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={selectCls}>
              <option value="">Tất cả</option>
              {Object.entries(STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tìm</label>
            <div className="flex items-center rounded-lg border border-slate-200 px-2.5">
              <FiSearch size={14} className="text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tiêu đề..."
                className="w-40 px-2 py-2 text-sm outline-none"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setView("list")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={view === "list" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
          >
            <FiList size={14} /> Danh sách
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={view === "calendar" ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}
          >
            <FiGrid size={14} /> Lịch
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2">
          {[0, 1, 2].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      )}

      {/* List view */}
      {!loading && view === "list" && (
        meetings.length === 0 ? (
          <div
            className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            Chưa có cuộc họp nào.
          </div>
        ) : (
          <div className="space-y-3">
            {meetings.map((m) => {
              const st = STATUS[m.status] ?? STATUS.SCHEDULED;
              const inv = INVITE_STATUS[m.invitationStatus] ?? INVITE_STATUS.SENT;
              return (
                <button
                  key={m.meetingId}
                  type="button"
                  onClick={() => navigate(`/parent/meetings/${m.meetingId}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
                  style={{ border: "1px solid #FFE7D6" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl"
                      style={{ backgroundColor: "#FFF7F2" }}
                    >
                      <span className="text-xs text-slate-400">{m.meetingDate?.slice(5, 7)}/{m.meetingDate?.slice(8, 10)}</span>
                      <span className="text-xs font-bold" style={{ color: "#F27123" }}>{m.meetingDate?.slice(11)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-[#0F2747]">{m.title}</p>
                      <p className="text-xs text-slate-400">
                        {m.teacherName ? `GV: ${m.teacherName}` : ""}
                        {m.className ? ` · ${m.className}` : ""}
                        {m.studentName ? ` · ${m.studentName}` : ""}
                        {m.location ? ` · ${m.location}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: inv.bg, color: inv.text }}
                    >
                      {inv.label}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{ backgroundColor: st.bg, color: st.text }}
                    >
                      {st.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Calendar view */}
      {!loading && view === "calendar" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMonthCursor((c) => c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <FiChevronLeft size={18} />
            </button>
            <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Tháng {monthCursor.m + 1}/{monthCursor.y}</h3>
            <button
              type="button"
              onClick={() => setMonthCursor((c) => c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })}
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <FiChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1">
            {WD.map((d) => (
              <div key={d} className="py-1 text-center text-xs font-bold text-slate-400">{d}</div>
            ))}
            {calendarCells.map((cell, i) => (
              <div
                key={i}
                className="min-h-[70px] rounded-lg p-1.5 text-xs"
                style={{ border: cell ? "1px solid #FFE7D6" : "none", backgroundColor: cell ? "#fff" : "transparent" }}
              >
                {cell && (
                  <>
                    <span className="text-slate-400">{cell.d}</span>
                    <div className="mt-1 space-y-0.5">
                      {cell.meetings.slice(0, 2).map((m) => (
                        <button
                          key={m.meetingId}
                          type="button"
                          onClick={() => navigate(`/parent/meetings/${m.meetingId}`)}
                          className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                          style={{ backgroundColor: "#F27123" }}
                        >
                          {m.meetingDate?.slice(11)} {m.title}
                        </button>
                      ))}
                      {cell.meetings.length > 2 && (
                        <span className="text-[10px] text-slate-400">+{cell.meetings.length - 2} nữa</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

export default MeetingsPage;
