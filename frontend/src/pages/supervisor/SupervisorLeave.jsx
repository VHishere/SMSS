import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supervisorApi } from "../../api/client";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", success: "#15803D", danger: "#DC2626",
  surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(n) {
  const p = (n || "").trim().split(/\s+/);
  return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?";
}
function fmtDate(d) {
  if (!d) return "—";
  const x = new Date(d);
  return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
}
const LEAVE_TYPE = { SICK_LEAVE: "Nghỉ ốm", FAMILY_LEAVE: "Nghỉ việc gia đình", PERSONAL_LEAVE: "Nghỉ cá nhân", OTHER: "Khác" };

// Phân loại đơn theo trạng thái 2 cấp
function bucketOf(r) {
  if (r.gqExists) return r.gvqnAction === "APPROVE" ? "approved" : "rejected";
  if (r.status === "REJECTED" || r.gvcnAction === "REJECT") return "rejected";
  if (r.status === "CANCELLED") return "cancelled";
  if (r.gvcnAction === "APPROVE") return "pending_gvqn"; // chờ tôi (GVQN) duyệt
  return "pending_gvcn"; // chờ GVCN duyệt trước
}
const FILTERS = [
  { key: "pending_gvqn", label: "Chờ tôi duyệt" },
  { key: "pending_gvcn", label: "Chờ GVCN" },
  { key: "approved", label: "Đã duyệt" },
  { key: "rejected", label: "Từ chối" },
  { key: "all", label: "Tất cả" },
];

function StepBadge({ role, action }) {
  const ok = action === "APPROVE", rejected = action === "REJECT";
  const bg = ok ? "#DCFCE7" : rejected ? "#FFDAD6" : C.surfaceHigh;
  const color = ok ? C.success : rejected ? "#93000A" : C.muted;
  const icon = ok ? "check" : rejected ? "close" : "schedule";
  return <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: bg, color }}>{role} <Ms name={icon} className="!text-[13px]" /></span>;
}

function SupervisorLeave() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [filter, setFilter] = useState("pending_gvqn");
  const [busy, setBusy] = useState(null);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getLeaveRequests()
      .then((res) => { if (m) setRequests(res.data.requests.map((r) => ({ ...r, gqExists: r.gvqnAction != null }))); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  const counts = useMemo(() => {
    const c = { pending_gvqn: 0, pending_gvcn: 0, approved: 0, rejected: 0, all: requests.length };
    requests.forEach((r) => { const b = bucketOf(r); if (c[b] != null) c[b] += 1; });
    return c;
  }, [requests]);

  const shown = useMemo(() => requests.filter((r) => filter === "all" || bucketOf(r) === filter), [requests, filter]);

  async function decide(r, action) {
    let comment = null;
    if (action === "REJECT") {
      comment = window.prompt("Lý do từ chối (tuỳ chọn):", "") ?? null;
    }
    setBusy(r.id);
    try {
      await supervisorApi.decideLeaveRequest(r.id, action, comment);
      setRefresh((k) => k + 1);
    } catch (err) { alert(err.message); }
    finally { setBusy(null); }
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Duyệt đơn xin nghỉ</h2>
        <p className="mt-1 text-sm text-slate-500">Đơn xin nghỉ của học sinh thuộc khu bạn phụ trách — xác nhận cấp quản nhiệm sau khi GVCN đã duyệt.</p>
      </div>

      {/* Filter pills */}
      <div className="mb-5 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
        {FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setFilter(f.key)}
            className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm transition-all"
            style={filter === f.key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
            {f.label}<span className="rounded-full px-1.5 text-[11px] font-bold" style={filter === f.key ? { backgroundColor: "rgba(255,255,255,0.25)" } : { backgroundColor: C.surfaceHigh }}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="space-y-3">{[0, 1, 2].map((n) => <div key={n} className="h-28 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && !error && (
        shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed py-12 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Không có đơn nào trong mục này.</div>
        ) : (
          <div className="space-y-3">
            {shown.map((r) => {
              const bucket = bucketOf(r);
              const actionable = bucket === "pending_gvqn";
              return (
                <div key={r.id} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(r.studentName)}</div>
                      <div className="min-w-0">
                        <p className="font-bold" style={{ color: C.onSurface }}>{r.studentName} <span className="text-xs font-normal text-slate-400">{r.className ? `· ${r.className}` : ""}{r.roomName ? ` · phòng ${r.roomName}` : ""}</span></p>
                        <p className="text-sm text-slate-600">{LEAVE_TYPE[r.leaveType] ?? r.leaveType} · {fmtDate(r.startDate)} → {fmtDate(r.endDate)}</p>
                        {r.reason && <p className="mt-0.5 text-xs text-slate-500">Lý do: {r.reason}</p>}
                        <div className="mt-2 flex items-center gap-1.5">
                          <StepBadge role="GVCN" action={r.gvcnAction} /><Ms name="arrow_forward" className="!text-[14px] text-slate-300" /><StepBadge role="GVQN" action={r.gvqnAction} />
                          {r.attachmentId && <span className="ml-1 inline-flex items-center gap-1 text-xs text-slate-400"><Ms name="attachment" className="!text-[14px]" /> có minh chứng</span>}
                        </div>
                      </div>
                    </div>
                    {actionable ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button type="button" disabled={busy === r.id} onClick={() => decide(r, "REJECT")} className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold transition disabled:opacity-50" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}><Ms name="close" className="!text-[16px]" /> Từ chối</button>
                        <button type="button" disabled={busy === r.id} onClick={() => decide(r, "APPROVE")} className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-white transition disabled:opacity-50" style={{ backgroundColor: C.success }}><Ms name="check" className="!text-[16px]" /> Duyệt</button>
                      </div>
                    ) : (
                      <span className="shrink-0 self-center rounded-full px-3 py-1 text-xs font-bold" style={
                        bucket === "approved" ? { backgroundColor: "#DCFCE7", color: C.success }
                        : bucket === "rejected" ? { backgroundColor: "#FFDAD6", color: "#93000A" }
                        : bucket === "pending_gvcn" ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                        : { backgroundColor: C.surfaceHigh, color: C.muted }}>
                        {bucket === "approved" ? "Đã duyệt" : bucket === "rejected" ? "Từ chối" : bucket === "pending_gvcn" ? "Chờ GVCN" : "Đã huỷ"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </DashboardShell>
  );
}

export default SupervisorLeave;
