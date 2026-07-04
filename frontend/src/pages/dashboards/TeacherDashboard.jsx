import { useMemo } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClipboard,
  FiTrendingUp,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useTeacherDashboard } from "../../hooks/useTeacherDashboard";

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, iconBg, iconColor, label, value, subtext, loading }) {
  return (
    <div
      className="rounded-2xl bg-white p-5 shadow-sm"
      style={{ border: "1px solid #FFE7D6" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-medium text-slate-500">{label}</p>

          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <p
              className="text-2xl font-bold leading-none"
              style={{ color: "#0F2747" }}
            >
              {value}
            </p>
          )}

          {subtext && (
            <p className="mt-1 text-xs text-slate-400">{subtext}</p>
          )}
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: iconBg }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Attendance Line Chart ────────────────────────────────────────────

const VI_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function WeeklyAttendanceChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex h-64 items-center justify-center rounded-2xl border border-dashed text-sm text-slate-400"
        style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
      >
        Chưa có dữ liệu điểm danh tuần này
      </div>
    );
  }

  const W = 700;
  const H = 260;
  const padL = 34;
  const padR = 18;
  const padT = 26;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = data.length;

  const xAt = (i) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (rate) => padT + (1 - rate / 100) * plotH;

  const points = data.map((d, i) => {
    const attended = d.present + d.late;
    const rate = d.total > 0 ? Math.round((attended / d.total) * 100) : null;
    const dateObj = new Date(d.date + "T00:00:00");
    return {
      i,
      rate,
      total: d.total,
      label: VI_DAYS[dateObj.getDay()],
      cx: xAt(i),
    };
  });

  const valid = points.filter((p) => p.rate !== null);
  const linePath = valid
    .map((p, k) => `${k === 0 ? "M" : "L"} ${p.cx} ${yAt(p.rate)}`)
    .join(" ");
  const areaPath =
    valid.length > 1
      ? `${linePath} L ${valid[valid.length - 1].cx} ${padT + plotH} L ${valid[0].cx} ${padT + plotH} Z`
      : "";

  const gridVals = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Biểu đồ tỷ lệ điểm danh tuần"
    >
      <defs>
        <linearGradient id="attArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F27123" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#F27123" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Gridlines + y-axis labels */}
      {gridVals.map((g) => (
        <g key={g}>
          <line
            x1={padL}
            y1={yAt(g)}
            x2={W - padR}
            y2={yAt(g)}
            stroke="#EEF2F6"
            strokeWidth="1"
          />
          <text
            x={padL - 8}
            y={yAt(g) + 3}
            textAnchor="end"
            fontSize="10"
            fontFamily="Segoe UI, system-ui, sans-serif"
            fill="#94A3B8"
          >
            {g}%
          </text>
        </g>
      ))}

      {/* Area fill + line */}
      {areaPath && <path d={areaPath} fill="url(#attArea)" />}
      {valid.length > 1 && (
        <path
          d={linePath}
          fill="none"
          stroke="#F27123"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Points, value labels, day labels */}
      {points.map((p) => (
        <g key={p.i}>
          {p.rate !== null && (
            <>
              <circle
                cx={p.cx}
                cy={yAt(p.rate)}
                r="4.5"
                fill="#fff"
                stroke="#F27123"
                strokeWidth="2.5"
              />
              <text
                x={p.cx}
                y={yAt(p.rate) - 12}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fontFamily="Segoe UI, system-ui, sans-serif"
                fill="#0F2747"
              >
                {p.rate}%
              </text>
            </>
          )}
          <text
            x={p.cx}
            y={H - 12}
            textAnchor="middle"
            fontSize="11"
            fontFamily="Segoe UI, system-ui, sans-serif"
            fill="#64748B"
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── At-Risk Student Row ──────────────────────────────────────────────────────

function AtRiskStudentRow({ student }) {
  const badgeColor = student.absenceRate >= 40 ? "#ef4444" : "#F27123";

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{ borderBottom: "1px solid #FFE7D6" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white overflow-hidden"
        style={{ backgroundColor: "#08509F" }}
      >
        {student.avatar ? (
          <img
            src={student.avatar}
            alt={student.fullName}
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          student.fullName?.[0]?.toUpperCase() || "?"
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm font-semibold"
          style={{ color: "#0F2747" }}
        >
          {student.fullName}
        </p>
        <p className="text-xs text-slate-400">
          {student.studentCode} · Vắng {student.absentCount} buổi
        </p>
      </div>

      <span
        className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
        style={{ backgroundColor: badgeColor }}
      >
        {student.absenceRate}%
      </span>
    </div>
  );
}

// ─── Parent Engagement Section ────────────────────────────────────────────────

function ParentEngagementSection({ engagement }) {
  const rate = engagement.readRate ?? 0;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div className="shrink-0 text-center sm:text-left">
        <p
          className="text-4xl font-bold leading-none"
          style={{ color: "#F27123" }}
        >
          {rate}%
        </p>
        <p className="mt-1 text-xs text-slate-500">Tỷ lệ đọc thông báo</p>
      </div>

      <div className="flex-1">
        <div className="mb-1.5 flex justify-between text-xs text-slate-500">
          <span>Đã đọc: {engagement.totalRead}</span>
          <span>Tổng đã gửi: {engagement.total}</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${rate}%`, backgroundColor: "#F27123" }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function SkeletonBlock({ className = "" }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-100 ${className}`}
    />
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

function TeacherDashboard() {
  const { user } = useAuth();
  const { data, loading, error } = useTeacherDashboard();

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(
        r.roleName,
      ),
    );

    return {
      name:
        data?.teacher?.fullName ||
        user?.fullName ||
        user?.username ||
        "Giáo viên",
      role: roleEntry?.description || "Giáo viên",
      avatar: data?.teacher?.avatar || user?.avatar || "",
    };
  }, [data, user]);

  const primaryClass = data?.primaryClass ?? null;
  const todayAtt = data?.todayAttendance ?? null;

  const weeklyRate = useMemo(() => {
    if (!data?.weeklyAttendance?.length) return null;
    const totals = data.weeklyAttendance.reduce(
      (acc, d) => ({
        attended: acc.attended + d.present + d.late,
        total: acc.total + d.total,
      }),
      { attended: 0, total: 0 },
    );
    return totals.total > 0
      ? Math.round((totals.attended / totals.total) * 100)
      : null;
  }, [data]);

  const sidebarFooterValue = loading
    ? "Đang tải..."
    : primaryClass?.className ?? "Chưa phân công";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp chủ nhiệm"
      sidebarFooterValue={sidebarFooterValue}
    >
      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được dữ liệu: {error}
        </div>
      )}

      {/* No-class banner */}
      {!loading && !error && !primaryClass && (
        <div
          className="mb-6 rounded-xl px-4 py-3 text-sm"
          style={{
            border: "1px solid #FFE7D6",
            backgroundColor: "#FFF7F2",
            color: "#0F2747",
          }}
        >
          Tài khoản chưa được phân công lớp học. Vui lòng liên hệ quản trị viên.
        </div>
      )}

      {/* ── Section 1: Stat Cards ── */}
      <section className="mb-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={FiCheckCircle}
            iconBg="#FFF0E8"
            iconColor="#F27123"
            label="Có mặt hôm nay"
            loading={loading}
            value={
              todayAtt?.total === 0
                ? "—"
                : String(todayAtt?.present ?? "—")
            }
            subtext={
              todayAtt === null
                ? ""
                : todayAtt.total === 0
                  ? "Chưa điểm danh"
                  : `/ ${todayAtt.total} học sinh`
            }
          />

          <StatCard
            icon={FiAlertTriangle}
            iconBg="#FEF2F2"
            iconColor="#ef4444"
            label="Vắng không phép"
            loading={loading}
            value={
              todayAtt?.total === 0
                ? "—"
                : String(todayAtt?.absentUnexcused ?? "—")
            }
            subtext={
              todayAtt === null
                ? ""
                : todayAtt.total === 0
                  ? "Chưa điểm danh"
                  : "hôm nay"
            }
          />

          <StatCard
            icon={FiClipboard}
            iconBg="#EBF3FF"
            iconColor="#08509F"
            label="Đơn xin nghỉ chờ duyệt"
            loading={loading}
            value={String(data?.pendingLeaveRequests ?? "—")}
            subtext="đang chờ xử lý"
          />

          <StatCard
            icon={FiTrendingUp}
            iconBg="#ECFDF5"
            iconColor="#10b981"
            label="Chuyên cần tuần này"
            loading={loading}
            value={
              weeklyRate !== null ? `${weeklyRate}%` : "—"
            }
            subtext={
              weeklyRate === null
                ? "Chưa có dữ liệu"
                : "tỷ lệ có mặt"
            }
          />
        </div>
      </section>

      {/* ── Section 2: Chart + At-Risk ── */}
      <section className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Weekly Attendance Chart */}
        <div
          className="rounded-2xl bg-white p-6 shadow-sm xl:col-span-2"
          style={{ border: "1px solid #FFE7D6" }}
        >
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3
                className="mb-0.5 text-base font-bold"
                style={{ color: "#0F2747" }}
              >
                Điểm danh tuần này
              </h3>
              <p className="text-xs text-slate-500">
                {primaryClass
                  ? `Lớp ${primaryClass.className} · ${primaryClass.gradeName}`
                  : "Chưa có lớp phụ trách"}
              </p>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span
                className="inline-block h-1 w-5 rounded-full"
                style={{ backgroundColor: "#F27123" }}
              />
              Tỷ lệ có mặt (%)
            </div>
          </div>

          {loading ? (
            <SkeletonBlock className="h-64" />
          ) : (
            <WeeklyAttendanceChart data={data?.weeklyAttendance} />
          )}
        </div>

        {/* At-Risk Students */}
        <div
          className="rounded-2xl bg-white p-6 shadow-sm"
          style={{ border: "1px solid #FFE7D6" }}
        >
          <div className="mb-4">
            <h3
              className="mb-0.5 text-base font-bold"
              style={{ color: "#0F2747" }}
            >
              Học sinh cần chú ý
            </h3>
            <p className="text-xs text-slate-500">Tỷ lệ vắng ≥ 20%</p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((n) => (
                <SkeletonBlock key={n} className="h-14" />
              ))}
            </div>
          ) : !data?.atRiskStudents?.length ? (
            <div
              className="flex h-44 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400"
              style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
            >
              Không có học sinh cần chú ý
            </div>
          ) : (
            <div>
              {data.atRiskStudents.map((student) => (
                <AtRiskStudentRow
                  key={student.studentId}
                  student={student}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: Parent Engagement ── */}
      <section>
        <div
          className="rounded-2xl bg-white p-6 shadow-sm"
          style={{ border: "1px solid #FFE7D6" }}
        >
          <div className="mb-4">
            <h3
              className="mb-0.5 text-base font-bold"
              style={{ color: "#0F2747" }}
            >
              Tương tác phụ huynh
            </h3>
            <p className="text-xs text-slate-500">
              Tỷ lệ đọc thông báo trong 30 ngày gần nhất
            </p>
          </div>

          {loading ? (
            <SkeletonBlock className="h-16" />
          ) : data?.parentEngagement?.readRate === null ? (
            <div
              className="flex h-16 items-center justify-center rounded-xl border border-dashed text-sm text-slate-400"
              style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}
            >
              Chưa có dữ liệu thông báo
            </div>
          ) : (
            <ParentEngagementSection
              engagement={data.parentEngagement}
            />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

export { TeacherDashboard };
