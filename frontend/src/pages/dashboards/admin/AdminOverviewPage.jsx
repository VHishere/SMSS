import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminApi } from "../../../api/client";

// FSchool Admin Portal — Stitch design tokens (matches the parent/teacher portal)
const C = {
  onSurface: "#1A1C1C",
  onSurfaceVariant: "#584238",
  outlineVariant: "#DFC0B2",
  primary: "#9F4200",
  primaryContainer: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  tertiary: "#4A5F82",
  error: "#BA1A1A",
  surface: "#F9F9F9",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};

const CARD = "bg-white rounded-4xl shadow-[0px_4px_12px_rgba(15,39,71,0.08)]";

const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Nhân viên",
  HOMEROOM_TEACHER: "GVCN",
  SUBJECT_TEACHER: "GVBM",
  DORM_SUPERVISOR: "Quản nhiệm",
  PARENT: "Phụ huynh",
  STUDENT: "Học sinh",
};

function Ms({ name, className = "", style, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}
    >
      {name}
    </span>
  );
}

function AdminOverviewPage() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    adminApi
      .getUsers({})
      .then((response) => {
        if (mounted) setUsers(response.data || []);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const locked = users.filter((u) => u.status === "LOCKED").length;
    const inactive = users.filter((u) => u.status === "INACTIVE").length;
    return { total, active, locked, inactive };
  }, [users]);

  const roleBreakdown = useMemo(() => {
    const counts = {};
    for (const user of users) {
      for (const role of user.roleNames || []) {
        counts[role] = (counts[role] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [users]);

  const recentUsers = useMemo(
    () =>
      [...users]
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .slice(0, 5),
    [users],
  );

  const statTiles = [
    { ms: "group", color: C.secondary, label: "Tổng tài khoản", value: stats.total },
    { ms: "check_circle", color: "#16A34A", label: "Đang hoạt động", value: stats.active },
    { ms: "lock", color: C.error, label: "Đã khóa", value: stats.locked },
    { ms: "person_off", color: C.onSurfaceVariant, label: "Ngưng hoạt động", value: stats.inactive },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Welcome Header (Stitch) */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold" style={{ color: C.onSurface }}>
          Bảng điều khiển Admin
        </h2>
        <button
          type="button"
          onClick={() => navigate("/admin/users")}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
          style={{ backgroundColor: C.deepBlue }}
        >
          <Ms name="manage_accounts" className="!text-[20px]!" />
          <span>Quản lý tài khoản</span>
        </button>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statTiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col items-center rounded-4xl border bg-white p-4 text-center shadow-sm"
            style={{ borderColor: "rgba(223,192,178,0.3)" }}
          >
            <Ms name={t.ms} className="mb-1" style={{ color: t.color }} />
            <p className="text-[10px] font-bold uppercase tracking-tight" style={{ color: C.onSurfaceVariant }}>
              {t.label}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-none" style={{ color: C.onSurface }}>
              {loading ? "—" : t.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Role breakdown */}
        <div className={`${CARD} p-6 lg:col-span-1`}>
          <h3 className="mb-4 text-base font-bold" style={{ color: C.onSurface }}>
            Phân bổ theo vai trò
          </h3>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((n) => (
                <div key={n} className="h-6 animate-pulse rounded-full bg-slate-100" />
              ))}
            </div>
          ) : roleBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-3">
              {roleBreakdown.map(([role, count]) => {
                const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={role}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span style={{ color: C.onSurface }}>{ROLE_LABELS[role] || role}</span>
                      <span className="font-bold" style={{ color: C.onSurfaceVariant }}>
                        {count}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: C.primaryContainer }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recently created accounts */}
        <div className={`${CARD} lg:col-span-2`}>
          <div
            className="flex items-center justify-between p-6"
            style={{ borderBottom: `1px solid ${C.outlineVariant}` }}
          >
            <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
              Tài khoản tạo gần đây
            </h3>
            <button
              type="button"
              onClick={() => navigate("/admin/users")}
              className="text-sm font-bold hover:underline"
              style={{ color: C.secondary }}
            >
              Xem tất cả
            </button>
          </div>

          {loading ? (
            <div className="space-y-3 p-6">
              {[0, 1, 2].map((n) => (
                <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : recentUsers.length === 0 ? (
            <p className="p-6 text-sm text-slate-400">Chưa có tài khoản nào.</p>
          ) : (
            <div>
              {recentUsers.map((u, i) => (
                <div
                  key={u.userId}
                  className="flex items-center gap-4 p-4 px-6"
                  style={i > 0 ? { borderTop: `1px solid ${C.outlineVariant}` } : undefined}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{ backgroundColor: `${C.secondary}1A`, color: C.secondary }}
                  >
                    {(u.fullName || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold" style={{ color: C.onSurface }}>
                      {u.fullName}
                    </p>
                    <p className="mb-0 truncate text-xs" style={{ color: C.onSurfaceVariant }}>
                      {u.email}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs" style={{ color: C.onSurfaceVariant }}>
                    {u.joinedDate || "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminOverviewPage;
