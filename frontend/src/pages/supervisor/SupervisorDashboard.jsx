import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import WelcomeBanner from "../../components/molecules/WelcomeBanner";
import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supervisorApi } from "../../api/client";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", danger: "#DC2626", success: "#15803D",
  surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const SHIFT_LABEL = {
  MORNING: "Ca Sáng · 06:00 - 14:00",
  AFTERNOON: "Ca Chiều · 14:00 - 18:00",
  EVENING: "Ca Tối · 18:00 - 22:00",
  NIGHT: "Ca Đêm · 22:00 - 06:00",
};
function timeAgo(ts) {
  if (!ts) return "";
  const diff = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diff < 1) return "vừa xong";
  if (diff < 60) return `${Math.round(diff)} phút trước`;
  if (diff < 1440) return `${Math.round(diff / 60)} giờ trước`;
  return `${Math.round(diff / 1440)} ngày trước`;
}

const STAT = [
  { key: "areaCount", label: "Khu vực", hint: "Khu phụ trách hiện tại", icon: "apartment", color: C.deepBlue, suffix: "" },
  { key: "attendanceRate", label: "Tỉ lệ", hint: "Điểm danh hôm nay", icon: "how_to_reg", color: C.orange, suffix: "%" },
  { key: "absentCount", label: "Nghỉ phép", hint: "Học sinh vắng mặt", icon: "event_busy", color: C.secondary, suffix: "" },
  { key: "newViolations", label: "Cảnh báo", hint: "Vi phạm nội quy mới", icon: "warning", color: C.danger, suffix: "" },
];

const LEAVE_STATUS = {
  PENDING: { label: "Chờ duyệt", bg: "#FEF3C7", text: "#B45309" },
  APPROVED: { label: "Đã xong", bg: "#DCFCE7", text: C.success },
  REJECTED: { label: "Từ chối", bg: "#FFDAD6", text: "#93000A" },
};

function StepBadge({ role, action }) {
  const ok = action === "APPROVE";
  const rejected = action === "REJECT";
  const bg = ok ? "#DCFCE7" : rejected ? "#FFDAD6" : C.surfaceHigh;
  const color = ok ? C.success : rejected ? "#93000A" : C.muted;
  const icon = ok ? "check" : rejected ? "close" : "schedule";
  return (
    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: bg, color }}>
      {role} <Ms name={icon} className="!text-[13px]" />
    </span>
  );
}

function SupervisorDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState("");

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm",
    avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getDashboard()
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const toggleTask = useCallback(async (task) => {
    const next = task.status === "DONE" ? "PENDING" : "DONE";
    try { await supervisorApi.updateTaskStatus(task.taskId, next); setRefresh((k) => k + 1); }
    catch (err) { alert(err.message); }
  }, []);

  async function addTask() {
    if (!newTask.trim()) { setAdding(false); return; }
    try {
      await supervisorApi.createTask({ title: newTask.trim(), shift: data?.shift });
      setNewTask(""); setAdding(false); setRefresh((k) => k + 1);
    } catch (err) { alert(err.message); }
  }

  const shortcuts = [
    { label: "Điểm danh", icon: "how_to_reg", primary: true, onClick: () => navigate("/supervisor/attendance") },
    { label: "Sổ trực", icon: "menu_book", primary: false, accent: C.orange, onClick: () => navigate("/supervisor/logbook") },
    { label: "Thêm vi phạm", icon: "person_add", onClick: () => navigate("/supervisor/attendance") },
    { label: "Gửi TB PH", icon: "mail", onClick: () => navigate("/supervisor/messages") },
  ];

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      {loading && <div className="space-y-4"><div className="h-28 animate-pulse rounded-3xl bg-slate-200/60" /><div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" /></div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Banner — component dùng chung cho mọi portal */}
          <WelcomeBanner
            name={headerUser.name}
            message="Chúc bạn một ca trực hiệu quả."
          />

          {/* 4 stat cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STAT.map((s) => {
              const raw = data.stats?.[s.key];
              const val = raw == null ? "—" : s.key === "areaCount" || s.key === "newViolations" ? String(raw).padStart(2, "0") : raw;
              return (
                <div key={s.key} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}`, borderTop: `3px solid ${s.color}` }}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${s.color}1a`, color: s.color }}><Ms name={s.icon} /></div>
                    <span className="text-xs font-medium" style={{ color: C.muted }}>{s.label}</span>
                  </div>
                  <p className="text-3xl font-extrabold leading-none" style={{ color: s.color }}>{val}{val !== "—" ? s.suffix : ""}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.hint}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Việc cần làm trong ca trực */}
            <section className="lg:col-span-2 rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}><Ms name="checklist" style={{ color: C.orange }} /> Việc cần làm trong ca trực</h3>
                <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: C.surfaceLow, color: C.muted }}>{SHIFT_LABEL[data.shift] ?? data.shift}</span>
              </div>
              <div className="space-y-2">
                {data.tasks.length === 0 && <p className="rounded-2xl border border-dashed py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có công việc nào trong ca.</p>}
                {data.tasks.map((t) => {
                  const done = t.status === "DONE";
                  return (
                    <div key={t.taskId} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ border: `1px solid ${C.border}`, backgroundColor: done ? "#F0FDF4" : "#fff" }}>
                      <button type="button" onClick={() => toggleTask(t)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors" style={{ borderColor: done ? C.success : C.border, backgroundColor: done ? C.success : "#fff", color: "#fff" }}>
                        {done && <Ms name="check" className="!text-[16px]" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold" style={{ color: C.onSurface, textDecoration: done ? "line-through" : "none" }}>{t.title}</p>
                        {t.note && <p className="text-xs text-slate-400">{t.note}{t.dueTime ? ` · ${done && t.completedAt ? `hoàn thành ${t.completedAt}` : t.dueTime}` : ""}</p>}
                      </div>
                      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase" style={done ? { backgroundColor: "#DCFCE7", color: C.success } : { backgroundColor: "#FEF3C7", color: "#B45309" }}>{done ? "Xong" : "Đang chờ"}</span>
                    </div>
                  );
                })}
                {adding ? (
                  <div className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ border: `1px dashed ${C.border}` }}>
                    <input autoFocus value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTask()} placeholder="Nội dung công việc..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                    <button type="button" onClick={addTask} className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: C.orange }}>Lưu</button>
                    <button type="button" onClick={() => { setAdding(false); setNewTask(""); }} className="rounded-full px-2 py-1.5 text-xs text-slate-400">Huỷ</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-3 text-sm font-medium transition-colors hover:bg-orange-50/40" style={{ borderColor: C.border, color: C.muted }}>
                    <Ms name="add" className="!text-[18px]" /> Thêm công việc mới
                  </button>
                )}
              </div>
            </section>

            {/* Lối tắt nhanh + Hoạt động gần đây */}
            <div className="space-y-6">
              <section className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <h3 className="mb-3 text-base font-bold" style={{ color: C.onSurface }}>Lối tắt nhanh</h3>
                <div className="grid grid-cols-2 gap-3">
                  {shortcuts.map((s) => (
                    <button key={s.label} type="button" onClick={s.onClick}
                      className="flex flex-col items-center gap-2 rounded-2xl px-3 py-4 text-sm font-bold transition-all hover:opacity-90 active:scale-95"
                      style={s.primary ? { backgroundColor: C.deepBlue, color: "#fff" } : s.accent ? { backgroundColor: s.accent, color: "#fff" } : { backgroundColor: C.surfaceLow, color: C.onSurface }}>
                      <Ms name={s.icon} className="!text-[24px]" /> {s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <h3 className="mb-3 text-base font-bold" style={{ color: C.onSurface }}>Hoạt động gần đây</h3>
                <div className="space-y-3">
                  {data.activity.length === 0 && <p className="text-sm text-slate-400">Chưa có hoạt động.</p>}
                  {data.activity.map((a, i) => {
                    const isLeave = a.kind === "LEAVE";
                    const icon = isLeave ? "fact_check" : a.action === "HANDOVER" ? "sync_alt" : a.action === "INCIDENT" ? "warning" : "edit_note";
                    const color = isLeave ? C.secondary : a.action === "INCIDENT" ? C.danger : C.orange;
                    const text = isLeave
                      ? `${a.actor} đã ${a.action === "APPROVE" ? "duyệt" : "từ chối"} đơn nghỉ của ${a.studentName}`
                      : a.title;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${color}1a`, color }}><Ms name={icon} className="!text-[16px]" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm" style={{ color: C.onSurface }}>{text}</p>
                          <p className="text-xs text-slate-400">{timeAgo(a.ts)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          </div>

          {/* Trạng thái phê duyệt gần đây */}
          <section className="mt-6 overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Trạng thái phê duyệt gần đây</h3>
            </div>
            {data.leaveApprovals.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Chưa có đơn nghỉ nào.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: C.surfaceLow }}>
                      {["Học sinh", "Loại đơn", "Lộ trình phê duyệt", "Trạng thái cuối"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaveApprovals.map((l) => {
                      const st = LEAVE_STATUS[l.status] ?? LEAVE_STATUS.PENDING;
                      return (
                        <tr key={l.id} style={{ borderTop: `1px solid ${C.surfaceLow}` }}>
                          <td className="px-5 py-3 font-semibold" style={{ color: C.onSurface }}>{l.studentName}{l.className ? <span className="ml-1 text-xs font-normal text-slate-400">({l.className})</span> : ""}</td>
                          <td className="px-5 py-3 text-slate-600">{l.leaveType === "SICK_LEAVE" ? "Nghỉ ốm" : l.leaveType === "FAMILY_LEAVE" ? "Nghỉ việc gia đình" : l.leaveType || "—"}</td>
                          <td className="px-5 py-3"><span className="flex items-center gap-1.5"><StepBadge role="GVCN" action={l.gvcnAction} /><Ms name="arrow_forward" className="!text-[14px] text-slate-300" /><StepBadge role="GVQN" action={l.gvqnAction} /></span></td>
                          <td className="px-5 py-3"><span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </DashboardShell>
  );
}

export default SupervisorDashboard;
