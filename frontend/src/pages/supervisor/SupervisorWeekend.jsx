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
const STATUS = {
  PENDING: { label: "Chờ xác nhận", bg: "#FEF3C7", text: "#B45309" },
  CONFIRMED: { label: "Đã xác nhận", bg: "#DCFCE7", text: C.success },
  REJECTED: { label: "Từ chối", bg: "#FFDAD6", text: "#93000A" },
};

function RegCard({ r, onSet, busy }) {
  const st = STATUS[r.status] ?? STATUS.PENDING;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(r.studentName)}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" style={{ color: C.onSurface }}>{r.studentName}</p>
        <p className="truncate text-xs text-slate-400">{r.className ? `${r.className} · ` : ""}{r.roomName ? `phòng ${r.roomName}` : ""}{r.pickupBy ? ` · đón: ${r.pickupBy}` : ""}</p>
      </div>
      {r.status === "PENDING" ? (
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" disabled={busy} title="Từ chối" onClick={() => onSet(r, "REJECTED")} className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50" style={{ backgroundColor: "rgba(220,38,38,0.1)", color: C.danger }}><Ms name="close" className="!text-[18px]" /></button>
          <button type="button" disabled={busy} title="Xác nhận" onClick={() => onSet(r, "CONFIRMED")} className="flex h-8 w-8 items-center justify-center rounded-lg text-white disabled:opacity-50" style={{ backgroundColor: C.success }}><Ms name="check" className="!text-[18px]" /></button>
        </div>
      ) : (
        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
      )}
    </div>
  );
}

function SupervisorWeekend() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(null);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm",
    role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getWeekend()
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [refresh]);

  async function onSet(r, status) {
    setBusy(r.id);
    try { await supervisorApi.setWeekendStatus(r.id, status); setRefresh((k) => k + 1); }
    catch (err) { alert(err.message); }
    finally { setBusy(null); }
  }

  const goHome = (data?.registrations ?? []).filter((r) => r.regType === "GO_HOME");
  const stay = (data?.registrations ?? []).filter((r) => r.regType === "STAY");
  const s = data?.summary;

  const CARDS = [
    { label: "Đăng ký về nhà", value: s?.goHome, icon: "home", color: C.orange },
    { label: "Ở lại nội trú", value: s?.stay, icon: "night_shelter", color: C.secondary },
    { label: "Đã xác nhận", value: s?.confirmed, icon: "task_alt", color: C.success },
    { label: "Chờ xác nhận", value: s?.pending, icon: "pending", color: "#B45309" },
  ];

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Đăng ký cuối tuần</h2>
        <p className="mt-1 text-sm text-slate-500">Tổng hợp học sinh đăng ký về nhà / ở lại nội trú {data?.weekendDate ? `— cuối tuần ${fmtDate(data.weekendDate)}` : ""}.</p>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="h-40 animate-pulse rounded-3xl bg-slate-200/60" />}

      {!loading && !error && data && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {CARDS.map((c) => (
              <div key={c.label} className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${c.color}` }}>
                <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: `${c.color}1a`, color: c.color }}><Ms name={c.icon} className="!text-[20px]" /></div>
                <p className="text-2xl font-extrabold leading-none" style={{ color: c.color }}>{String(c.value ?? 0).padStart(2, "0")}</p>
                <p className="mt-1 text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}><Ms name="home" style={{ color: C.orange }} /> Về nhà cuối tuần ({goHome.length})</h3>
              <div className="space-y-2">
                {goHome.length === 0 && <p className="rounded-2xl border border-dashed py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có đăng ký.</p>}
                {goHome.map((r) => <RegCard key={r.id} r={r} onSet={onSet} busy={busy === r.id} />)}
              </div>
            </section>
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold" style={{ color: C.onSurface }}><Ms name="night_shelter" style={{ color: C.secondary }} /> Ở lại nội trú ({stay.length})</h3>
              <div className="space-y-2">
                {stay.length === 0 && <p className="rounded-2xl border border-dashed py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Chưa có đăng ký.</p>}
                {stay.map((r) => <RegCard key={r.id} r={r} onSet={onSet} busy={busy === r.id} />)}
              </div>
            </section>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default SupervisorWeekend;
