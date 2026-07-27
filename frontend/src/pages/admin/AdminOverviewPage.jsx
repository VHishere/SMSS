import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { adminApi } from "../../api/client";

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

const currencyFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
function formatCurrency(value) {
  return currencyFormatter.format(Number(value || 0));
}

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

  const [ops, setOps] = useState(null);
  const [opsLoading, setOpsLoading] = useState(true);

  const [fees, setFees] = useState(null);
  const [events, setEvents] = useState(null);
  const [messages, setMessages] = useState(null);
  const [modulesLoading, setModulesLoading] = useState(true);

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

  // UC-106: School-Wide Operations Dashboard — high-level school analytics
  // (total attendance, global counts, open warnings across the school).
  useEffect(() => {
    let mounted = true;

    adminApi
      .getOperationsDashboard()
      .then((response) => {
        if (mounted) setOps(response.data);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setOpsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Module overview — one glance at Học phí / Sự kiện / Tin nhắn, each
  // mirroring the stats already shown on their own sidebar pages.
  useEffect(() => {
    let mounted = true;

    Promise.all([
      adminApi.getFeesDashboard().then((r) => { if (mounted) setFees(r.data); }).catch(() => {}),
      adminApi.getEventsDashboard().then((r) => { if (mounted) setEvents(r.data.stats); }).catch(() => {}),
      adminApi.getMessagesDashboard().then((r) => { if (mounted) setMessages(r.data.stats); }).catch(() => {}),
    ]).finally(() => {
      if (mounted) setModulesLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "ACTIVE").length;
    const locked = users.filter((u) => u.status === "LOCKED").length;
    return { total, active, locked };
  }, [users]);

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

      {/* UC-106: School-Wide Operations Dashboard */}
      <div className={`${CARD} p-6`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold" style={{ color: C.onSurface }}>
            Vận hành toàn trường
          </h3>
          {ops?.schoolYear && (
            <span className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>
              Năm học {ops.schoolYear.yearName}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { ms: "school", color: C.deepBlue, label: "Học sinh", value: ops?.totals?.students },
            { ms: "meeting_room", color: C.secondary, label: "Lớp học", value: ops?.totals?.classes },
            { ms: "co_present", color: C.tertiary, label: "Giáo viên", value: ops?.totals?.teachers },
            {
              ms: "event_available",
              color: "#16A34A",
              label: "Chuyên cần (tháng)",
              value: ops?.attendance?.rate == null ? "—" : `${ops.attendance.rate}%`,
            },
            { ms: "warning", color: C.error, label: "Cảnh báo mở", value: ops?.warnings?.total },
          ].map((t) => (
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
                {opsLoading ? "—" : (t.value ?? "—")}
              </p>
            </div>
          ))}
        </div>

        {!opsLoading && ops && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>
                Sĩ số theo khối
              </h4>
              {ops.gradeBreakdown.length === 0 ? (
                <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
              ) : (
                <div className="space-y-3">
                  {ops.gradeBreakdown.map((g) => {
                    const max = Math.max(...ops.gradeBreakdown.map((x) => x.studentCount), 1);
                    const pct = Math.round((g.studentCount / max) * 100);
                    return (
                      <div key={g.gradeId}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span style={{ color: C.onSurface }}>{g.gradeName}</span>
                          <span className="font-bold" style={{ color: C.onSurfaceVariant }}>{g.studentCount}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.secondary }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>
                Cảnh báo đang mở theo loại
              </h4>
              <div className="space-y-3">
                {[
                  { label: "Học tập", value: ops.warnings.academic },
                  { label: "Hạnh kiểm", value: ops.warnings.behaviour },
                  { label: "Chuyên cần", value: ops.warnings.attendance },
                ].map((w) => {
                  const max = Math.max(ops.warnings.academic, ops.warnings.behaviour, ops.warnings.attendance, 1);
                  const pct = Math.round((w.value / max) * 100);
                  return (
                    <div key={w.label}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span style={{ color: C.onSurface }}>{w.label}</span>
                        <span className="font-bold" style={{ color: C.onSurfaceVariant }}>{w.value}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.error }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Module overview — quick stats for the other sidebar sections */}
      <div>
        <h3 className="mb-4 text-base font-bold" style={{ color: C.onSurface }}>
          Tổng quan các khu vực quản lý
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Tài khoản — kept compact instead of the previous 4-tile + list layout */}
          <ModuleCard
            icon="manage_accounts"
            color={C.deepBlue}
            title="Tài khoản"
            onClick={() => navigate("/admin/users")}
            loading={loading}
            rows={[
              { label: "Tổng số", value: stats.total },
              { label: "Đang hoạt động", value: stats.active },
              { label: "Đã khóa", value: stats.locked },
            ]}
          />

          <ModuleCard
            icon="payments"
            color="#16A34A"
            title="Học phí"
            onClick={() => navigate("/admin/fees")}
            loading={modulesLoading}
            rows={[
              { label: "Đã thu (năm nay)", value: fees ? formatCurrency(fees.totalCollected) : "—" },
              { label: "Còn phải thu", value: fees ? formatCurrency(fees.totalOutstanding) : "—" },
              { label: "Quá hạn", value: fees?.overdueCount },
            ]}
          />

          <ModuleCard
            icon="celebration"
            color={C.primaryContainer}
            title="Sự kiện"
            onClick={() => navigate("/admin/events")}
            loading={modulesLoading}
            rows={[
              { label: "Sắp diễn ra", value: events?.upcoming },
              { label: "Đang diễn ra", value: events?.ongoing },
              { label: "Tổng số", value: events?.total },
            ]}
          />

          <ModuleCard
            icon="chat"
            color={C.secondary}
            title="Tin nhắn"
            onClick={() => navigate("/admin/messages")}
            loading={modulesLoading}
            rows={[
              { label: "Tổng hội thoại", value: messages?.totalConversations },
              { label: "Chưa đọc", value: messages?.unreadMessages },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({ icon, color, title, onClick, loading, rows }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD} flex flex-col gap-3 p-5 text-left transition-transform hover:-translate-y-0.5`}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ backgroundColor: `${color}1A` }}
        >
          <Ms name={icon} style={{ color }} />
        </span>
        <h4 className="text-sm font-bold" style={{ color: C.onSurface }}>{title}</h4>
      </div>

      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span style={{ color: C.onSurfaceVariant }}>{r.label}</span>
            <span className="font-bold" style={{ color: C.onSurface }}>
              {loading ? "—" : (r.value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </button>
  );
}

export default AdminOverviewPage;
