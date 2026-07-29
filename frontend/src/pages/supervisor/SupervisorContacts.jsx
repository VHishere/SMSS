import { useEffect, useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { supervisorApi } from "../../api/client";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123",
  secondary: "#225DAD", deepBlue: "#00458E", success: "#15803D", surfaceLow: "#F3F3F3",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(n) {
  const p = (n || "").trim().split(/\s+/);
  return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?";
}

function SupervisorContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Quản nhiệm", role: "Giáo viên quản nhiệm", avatar: user?.avatar ?? "",
  }), [user]);

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    supervisorApi.getContacts()
      .then((res) => { if (m) setContacts(res.data.contacts); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, []);

  const shown = useMemo(() => contacts.filter((c) =>
    !q || `${c.studentName} ${c.parentName} ${c.studentCode} ${c.roomName || ""}`.toLowerCase().includes(q.toLowerCase())),
    [contacts, q]);

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.SUPERVISOR} sidebarFooterLabel="Khu vực" sidebarFooterValue="Quản nhiệm">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Liên lạc phụ huynh</h2>
          <p className="mt-1 text-sm text-slate-500">Danh bạ phụ huynh học sinh thuộc khu bạn phụ trách — gọi/nhắn khi cần phối hợp.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2" style={{ borderColor: C.border }}>
          <Ms name="search" className="!text-[18px] text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm HS / phụ huynh / phòng..." className="w-56 max-w-full bg-transparent text-sm outline-none" />
        </div>
      </div>

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {loading && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && !error && (
        shown.length === 0 ? (
          <div className="rounded-3xl border border-dashed py-12 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>Không có liên hệ nào.</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {shown.map((c, i) => (
              <div key={i} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: C.secondary }}>{initials(c.parentName)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-bold" style={{ color: C.onSurface }}>{c.parentName}</span>
                      {c.isPrimary ? <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "rgba(242,113,35,0.12)", color: C.orange }}>Chính</span> : null}
                    </div>
                    <p className="text-xs text-slate-400">{c.relationship || "Phụ huynh"} của <span className="font-medium text-slate-600">{c.studentName}</span>{c.roomName ? ` · ${c.roomName}` : ""}{c.className ? ` · ${c.className}` : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.phone && <a href={`tel:${c.phone}`} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(21,128,61,0.1)", color: C.success }}><Ms name="call" className="!text-[14px]" /> {c.phone}</a>}
                      {c.email && <a href={`mailto:${c.email}`} className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}><Ms name="mail" className="!text-[14px]" /> Email</a>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </DashboardShell>
  );
}

export default SupervisorContacts;
