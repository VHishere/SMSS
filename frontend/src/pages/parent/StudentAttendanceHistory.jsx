import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudentAttendance } from "../../hooks/useParentStudentAttendance";
import { useParentStudentAttendanceStats } from "../../hooks/useParentStudentAttendanceStats";
import { useParentStudents } from "../../hooks/useParentStudents";
import { formatDateVN } from "../../utils/datetime";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";

// ─── FSchool Stitch design tokens (matches the teacher attendance portal) ────

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

const STATUS_PILL = {
  PRESENT:          { label: "Hiện diện", bg: "#F2712315", text: "#9F4200", border: "#F27123" },
  LATE:             { label: "Muộn",      bg: "#4A5F8215", text: "#4A5F82", border: "#4A5F82" },
  ABSENT_UNEXCUSED: { label: "Vắng",      bg: "#BA1A1A15", text: "#BA1A1A", border: "#BA1A1A" },
  ABSENT_EXCUSED:   { label: "Phép",      bg: "#225DAD15", text: "#225DAD", border: "#225DAD" },
  EARLY_LEAVE:      { label: "Về sớm",    bg: "#8298BE20", text: "#4A5F82", border: "#8298BE" },
};

// ── Date utilities ────────────────────────────────────────────────────────────

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatVN(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getSchoolYears() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const year  = today.getFullYear();
  const startYear = month >= 9 ? year : year - 1;
  return Array.from({ length: 3 }, (_, i) => {
    const y = startYear - i;
    return { value: `${y}-${y + 1}`, label: `Năm học ${y} – ${y + 1}` };
  });
}

function getWeeksForSchoolYear(schoolYear) {
  const startYear = parseInt(schoolYear.split("-")[0], 10);
  const endYear   = startYear + 1;

  const yearStart = new Date(startYear, 8, 1);
  const yearEnd   = new Date(endYear,   4, 31);

  const dow = yearStart.getDay();
  const firstMonday = new Date(yearStart);
  firstMonday.setDate(yearStart.getDate() + (dow === 0 ? -6 : 1 - dow));

  const weeks = [];
  let cur = new Date(firstMonday);
  let num = 1;

  while (cur <= yearEnd) {
    const end = new Date(cur);
    end.setDate(cur.getDate() + 6);
    weeks.push({
      value:     toISO(cur),
      startDate: toISO(cur),
      endDate:   toISO(end),
      label:     `Tuần ${num} · ${formatVN(cur)} – ${formatVN(end)}`,
    });
    cur = new Date(cur);
    cur.setDate(cur.getDate() + 7);
    num++;
  }

  return weeks;
}

function findDefaultWeek(weeks) {
  if (weeks.length === 0) return "";
  const today = toISO(new Date());
  const found  = weeks.find((w) => w.startDate <= today && w.endDate >= today);
  if (found) return found.value;
  if (today > weeks[weeks.length - 1].endDate) return weeks[weeks.length - 1].value;
  return weeks[0].value;
}

function getMonthRange(offsetMonths = 0) {
  const now   = new Date();
  const year  = now.getFullYear();
  const mo    = now.getMonth() + offsetMonths;
  const start = new Date(year, mo, 1);
  const end   = new Date(year, mo + 1, 0);
  return { startDate: toISO(start), endDate: toISO(end) };
}

function formatTableDate(dateStr) {
  const d  = new Date(dateStr + "T00:00:00");
  return `${VN_DAYS[d.getDay()]}, ${formatDateVN(dateStr)}`;
}

const VN_DAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const CONTEXT_LABEL = { CLASS: "Lớp học", DORM: "Ký túc xá" };

function StatusBadge({ typeName }) {
  if (!typeName) return <span style={{ color: C.onSurfaceVariant }}>—</span>;
  const cfg = STATUS_PILL[typeName.toUpperCase()] ?? { label: typeName, bg: "#EEEEEE", text: C.onSurfaceVariant, border: C.outlineVariant };
  return (
    <span
      className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase"
      style={{ backgroundColor: cfg.bg, color: cfg.text, borderColor: cfg.border }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Quick Stat Card (Stitch: left accent border, 48px number, progress) ─────

function QuickStatCard({ label, count, total, accent, iconName, iconColor, iconBg }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className="rounded-4xl bg-white p-5 shadow-sm transition-transform hover:-translate-y-1"
      style={{ borderLeft: `4px solid ${accent}` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.onSurfaceVariant }}>
            {label}
          </p>
          <h3 className="mt-2 text-5xl font-bold leading-none" style={{ color: C.onSurface }}>
            {count}
          </h3>
        </div>
        <div className="rounded-lg p-2" style={{ backgroundColor: iconBg }}>
          <Ms name={iconName} fill style={{ color: iconColor }} />
        </div>
      </div>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: "#E2E2E2" }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent }} />
      </div>
    </div>
  );
}

// ─── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ studentId }) {
  const schoolYears = useMemo(() => getSchoolYears(), []);

  const [filter, setFilter] = useState(() => {
    const year = schoolYears[0].value;
    return { year, weekStart: findDefaultWeek(getWeeksForSchoolYear(year)) };
  });

  const { year: selectedYear, weekStart: selectedWeekStart } = filter;

  const weeks = useMemo(() => getWeeksForSchoolYear(selectedYear), [selectedYear]);

  const selectedWeek = useMemo(
    () => weeks.find((w) => w.value === selectedWeekStart) ?? null,
    [weeks, selectedWeekStart],
  );

  const { data, loading, error } = useParentStudentAttendance(
    studentId,
    selectedWeek?.startDate,
    selectedWeek?.endDate,
  );

  const items = useMemo(() => [...(data?.items ?? [])].reverse(), [data]);

  const counts = useMemo(() => {
    const c = { PRESENT: 0, ABSENT_UNEXCUSED: 0, LATE: 0, ABSENT_EXCUSED: 0 };
    for (const row of data?.items ?? []) {
      if (c[row.typeName] !== undefined) c[row.typeName] += 1;
    }
    return c;
  }, [data]);

  const totalRecords = data?.items?.length ?? 0;

  const statCards = [
    { label: "Hiện diện", count: counts.PRESENT,          accent: C.primary,   iconName: "check_circle", iconColor: C.primaryContainer, iconBg: "rgba(242,113,35,0.10)" },
    { label: "Vắng mặt",  count: counts.ABSENT_UNEXCUSED, accent: C.error,     iconName: "cancel",       iconColor: C.error,            iconBg: "rgba(255,218,214,0.4)" },
    { label: "Đi muộn",   count: counts.LATE,             accent: C.tertiary,  iconName: "schedule",     iconColor: C.tertiary,         iconBg: "rgba(130,152,190,0.2)" },
    { label: "Nghỉ phép", count: counts.ABSENT_EXCUSED,   accent: C.secondary, iconName: "event_busy",   iconColor: C.secondary,        iconBg: "rgba(119,169,254,0.2)" },
  ];

  const selectStyle = "cursor-pointer border-none bg-transparent pr-8 text-sm font-medium outline-none";

  return (
    <div className="space-y-6">
      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {statCards.map((s) => (
          <QuickStatCard key={s.label} {...s} total={totalRecords} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
          <Ms name="event_note" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
          <select
            value={selectedYear}
            onChange={(e) => {
              const year = e.target.value;
              setFilter({ year, weekStart: findDefaultWeek(getWeeksForSchoolYear(year)) });
            }}
            className={selectStyle}
            style={{ color: C.onSurface }}
          >
            {schoolYears.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center rounded-xl border bg-white p-1 px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
          <Ms name="calendar_view_week" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
          <select
            value={selectedWeekStart}
            onChange={(e) => setFilter((f) => ({ ...f, weekStart: e.target.value }))}
            className={`${selectStyle} min-w-70`}
            style={{ color: C.onSurface }}
          >
            {weeks.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <div className="space-y-3">{[0, 1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-4xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-hidden rounded-4xl border bg-white shadow-md" style={{ borderColor: C.outlineVariant }}>
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Không có dữ liệu điểm danh trong tuần này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                  <tr>
                    {["STT", "Ngày", "Loại", "Lớp / môn học", "Giáo viên", "Trạng thái", "Ghi chú"].map((h) => (
                      <th key={h} className="px-6 py-4 text-xs font-medium tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: C.outlineVariant }}>
                  {items.map((row, idx) => (
                    <tr key={row.attendanceId} className="transition-colors hover:bg-[#F3F3F3]">
                      <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>{idx + 1}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium" style={{ color: C.onSurface }}>
                        {formatTableDate(row.attendanceDate)}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>
                        {CONTEXT_LABEL[row.context] ?? row.context ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: C.onSurface }}>
                        {row.subjectName ?? row.className ?? "—"}
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>{row.createdByName ?? "—"}</td>
                      <td className="px-6 py-4">
                        <StatusBadge typeName={row.typeName} />
                      </td>
                      <td className="px-6 py-4 text-sm" style={{ color: C.onSurfaceVariant }}>{row.note ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Analytics (Stats) Tab ─────────────────────────────────────────────────────

const ANALYTICS_PERIODS = [
  { label: "Tháng này",     ...getMonthRange(0)  },
  { label: "Tháng trước",   ...getMonthRange(-1) },
  { label: "2 tháng trước", ...getMonthRange(-2) },
];

const TYPE_LABEL = {
  PRESENT:          { label: "Có mặt",         color: "#059669" },
  LATE:             { label: "Đi muộn",         color: "#D97706" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    color: "#08509F" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", color: "#DC2626" },
  EARLY_LEAVE:      { label: "Về sớm",          color: "#7C3AED" },
};
const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];

const CONTEXT_OPTIONS = [
  { value: "",      label: "Tất cả" },
  { value: "CLASS", label: "Lớp học" },
  { value: "DORM",  label: "Ký túc xá" },
];

// Bento stat card (Stitch: "Statistics Overview Cards - Bento Style")
function AnalyticsSummaryCard({ label, value, unit, iconName, iconColor, iconBg, hoverClass = "", badge, decor, children }) {
  return (
    <div className={`relative flex flex-col justify-between overflow-hidden rounded-4xl border border-transparent bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)] transition-all ${hoverClass}`}>
      {decor}
      <div className="relative z-10 flex items-start justify-between">
        <div className="rounded-xl p-3" style={{ backgroundColor: iconBg, color: iconColor }}>
          <Ms name={iconName} className="text-3xl!" />
        </div>
        {badge}
      </div>
      <div className="relative z-10 mt-4">
        <h3 className="text-sm" style={{ color: C.onSurfaceVariant }}>{label}</h3>
        <p className="mt-1 text-4xl font-bold" style={{ color: C.onSurface }}>
          {value}
          {unit && <span className="text-lg font-normal" style={{ color: C.onSurfaceVariant }}> {unit}</span>}
        </p>
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function LateSparkline({ timeline }) {
  const pts = timeline.map((d) => d.late);
  if (pts.length < 2) {
    return <div className="mt-4 h-1 w-full rounded-full" style={{ backgroundColor: C.surfaceLow }} />;
  }
  const W = 120, H = 40, pad = 4;
  const max = Math.max(1, ...pts);
  const x = (i) => (i / (pts.length - 1)) * W;
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = pts.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `M 0,${H} L ${pts.map((v, i) => `${x(i)},${y(v)}`).join(" L ")} L ${W},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="mt-4 h-10 w-full">
      <path d={area} fill="rgba(34,93,173,0.10)" />
      <polyline points={line} fill="none" stroke={C.secondary} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function DonutChart({ segments, total }) {
  const R = 60, cx = 80, cy = 80, Circ = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const len = total > 0 ? (s.count / total) * Circ : 0;
    const off = total > 0 ? -(before / total) * Circ : 0;
    return { color: s.color, len, off };
  });
  return (
    <div className="flex w-full flex-col items-center">
      <svg width="160" height="160" viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F1F1" strokeWidth="18" />
        {arcs.map((a, i) => a.len > 0 && (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth="18"
            strokeDasharray={`${a.len} ${Circ}`} strokeDashoffset={a.off} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="26" fontWeight="700" fill={C.onSurface}>{total}</text>
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fill={C.onSurfaceVariant}>Lượt điểm danh</text>
      </svg>
      <div className="mt-6 w-full space-y-3">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span style={{ color: C.onSurface }}>{s.label}</span>
            </div>
            <span className="font-bold" style={{ color: C.onSurface }}>{s.count} ({s.rate ?? 0}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendanceRateLine({ timeline }) {
  const pts = timeline.filter((d) => d.total > 0).map((d) => ({ date: d.date, rate: Math.round(((d.present + d.late) / d.total) * 100) }));
  if (pts.length === 0) {
    return <p className="w-full py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>;
  }
  const stepX = 64, padX = 32, padTop = 24, chartH = 170, padBottom = 26;
  const n = pts.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (r) => padTop + (1 - r / 100) * chartH;
  const line = pts.map((p, i) => `${x(i)},${y(p.rate)}`).join(" ");
  const area = `M ${x(0)},${baseY} ${pts.map((p, i) => `L ${x(i)},${y(p.rate)}`).join(" ")} L ${x(n - 1)},${baseY} Z`;
  const fmt = (ds) => { const d = new Date(ds + "T00:00:00"); return `${d.getDate()}/${d.getMonth() + 1}`; };
  return (
    <div className="w-full overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F1F1" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#8C7266" textAnchor="end">{g}</text>
          </g>
        ))}
        {n > 1 && <path d={area} fill="rgba(242,113,35,0.12)" />}
        {n > 1 && <polyline points={line} fill="none" stroke={C.primaryContainer} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.rate)} r="4" fill="#fff" stroke={C.primaryContainer} strokeWidth="2.5" />
            <text x={x(i)} y={y(p.rate) - 10} fontSize="10" fontWeight="700" fill={C.onSurface} textAnchor="middle">{p.rate}%</text>
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#8C7266" textAnchor="middle">{fmt(p.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StatsTab({ studentId }) {
  const [periodIdx,   setPeriodIdx]   = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd,   setCustomEnd]   = useState("");
  const [useCustom,   setUseCustom]   = useState(false);
  const [context,     setContext]     = useState("");

  const period    = ANALYTICS_PERIODS[periodIdx];
  const startDate = useCustom ? customStart : period.startDate;
  const endDate   = useCustom ? customEnd   : period.endDate;

  const { data, loading, error } = useParentStudentAttendanceStats(
    studentId,
    startDate || undefined,
    endDate   || undefined,
    context   || undefined,
  );

  const donutSegments = data
    ? ALL_TYPES.map((t) => ({
        label: TYPE_LABEL[t].label,
        color: TYPE_LABEL[t].color,
        count: data.summary.byType[t]?.count ?? 0,
        rate:  data.summary.byType[t]?.rate  ?? 0,
      }))
    : [];

  const sortedTimeline = useMemo(
    () => [...(data?.timeline ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
    [data],
  );

  const totalRecords    = data?.summary.totalRecords ?? 0;
  const presentCount    = data?.summary.byType.PRESENT?.count ?? 0;
  const lateCount       = data?.summary.byType.LATE?.count ?? 0;
  const absentExcused   = data?.summary.byType.ABSENT_EXCUSED?.count ?? 0;
  const absentUnexcused = data?.summary.byType.ABSENT_UNEXCUSED?.count ?? 0;
  const avgRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 1000) / 10 : 0;

  const selectStyle = "cursor-pointer border-none bg-transparent pr-8 text-sm font-medium outline-none";

  return (
    <div className="space-y-6">
      {/* Filter section (Stitch: Filter & Search) */}
      <section className="rounded-4xl bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)]">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>
              Khoảng thời gian
            </label>
            <div className="flex flex-wrap gap-2">
              {ANALYTICS_PERIODS.map((p, idx) => {
                const active = !useCustom && periodIdx === idx;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
                    className={`rounded-full px-4 py-1.5 text-xs transition-all ${active ? "font-bold text-white shadow-sm" : "border bg-white font-medium hover:bg-[#F3F3F3]"}`}
                    style={active ? { backgroundColor: C.primaryContainer } : { borderColor: C.outlineVariant, color: C.onSurfaceVariant }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>Từ ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.primaryContainer : C.outlineVariant }}>
              <Ms name="calendar_month" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
              <input
                type="date"
                value={customStart}
                onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
                style={{ color: C.onSurface }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>Đến ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.primaryContainer : C.outlineVariant }}>
              <Ms name="calendar_month" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
              <input
                type="date"
                value={customEnd}
                onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none"
                style={{ color: C.onSurface }}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.onSurfaceVariant }}>Phạm vi</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: C.outlineVariant }}>
              <Ms name="filter_alt" className="mr-2 !text-[20px]!" style={{ color: C.primary }} />
              <select
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className={selectStyle}
                style={{ color: C.onSurface }}
              >
                {CONTEXT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[0, 1, 2].map((n) => <div key={n} className="h-44 animate-pulse rounded-4xl bg-slate-200/60" />)}
        </div>
      )}
      {error && <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          {/* Statistics overview (Stitch: bento cards) */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <AnalyticsSummaryCard
              label="Tỷ lệ hiện diện trung bình"
              value={`${avgRate}%`}
              iconName="verified_user"
              iconColor={C.primaryContainer}
              iconBg="rgba(242,113,35,0.10)"
              hoverClass="hover:border-[#F27123]"
              badge={data.timeline.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  <Ms name="event_available" className="text-[14px]!" /> {data.timeline.length} ngày học
                </span>
              ) : null}
            >
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(avgRate, 100)}%`, backgroundColor: C.primaryContainer }} />
              </div>
            </AnalyticsSummaryCard>

            <AnalyticsSummaryCard
              label="Tổng số buổi vắng"
              value={absentExcused + absentUnexcused}
              iconName="person_off"
              iconColor={C.error}
              iconBg="rgba(255,218,214,0.50)"
              hoverClass="hover:border-[#BA1A1A]"
              badge={
                <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                  {absentUnexcused} không phép
                </span>
              }
            >
              <p className="mt-2 text-xs italic" style={{ color: C.onSurfaceVariant }}>
                Trong đó {absentExcused} buổi vắng có phép
              </p>
            </AnalyticsSummaryCard>

            <AnalyticsSummaryCard
              label="Số lượt đi muộn"
              value={lateCount}
              unit="lượt"
              iconName="query_stats"
              iconColor={C.secondary}
              iconBg="rgba(119,169,254,0.20)"
              hoverClass="hover:border-[#225DAD]"
              decor={<div className="absolute -right-4 -top-4 h-32 w-32 rounded-full blur-3xl" style={{ backgroundColor: "rgba(34,93,173,0.05)" }} />}
            >
              <LateSparkline timeline={sortedTimeline} />
            </AnalyticsSummaryCard>
          </section>

          {/* Trend chart + status distribution (Stitch: Trend Chart Section) */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col rounded-4xl bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)] lg:col-span-2">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Biểu đồ xu hướng chuyên cần</h3>
                <span className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium" style={{ borderColor: C.outlineVariant, color: C.onSurfaceVariant }}>
                  {formatDateVN(data.period.startDate)} – {formatDateVN(data.period.endDate)}
                </span>
              </div>
              <div className="flex flex-1 items-end">
                <AttendanceRateLine timeline={sortedTimeline} />
              </div>
            </div>

            <div className="flex flex-col items-center rounded-4xl bg-white p-6 shadow-[0_4px_12px_rgba(15,39,71,0.08)]">
              <h3 className="mb-6 w-full text-center text-base font-bold" style={{ color: C.onSurface }}>Phân bổ trạng thái</h3>
              {data.summary.totalRecords > 0 ? (
                <DonutChart segments={donutSegments} total={data.summary.totalRecords} />
              ) : (
                <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>
              )}
            </div>
          </section>

          {/* Per-day detail table (Stitch: Detailed History Table) */}
          <section className="overflow-hidden rounded-4xl bg-white shadow-[0_4px_12px_rgba(15,39,71,0.08)]" style={{ border: `1px solid ${C.outlineVariant}` }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: C.outlineVariant, backgroundColor: C.surfaceLow }}>
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Thống kê điểm danh theo ngày</h3>
            </div>
            {sortedTimeline.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Ngày</th>
                        {["Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Về sớm"].map((h) => (
                          <th key={h} className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider">{h}</th>
                        ))}
                        <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider">Chuyên cần</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DFC0B2]">
                      {sortedTimeline.map((d) => {
                        const rate = d.total > 0 ? Math.round(((d.present + d.late) / d.total) * 100) : 0;
                        const rateColor = rate >= 80 ? "#059669" : rate >= 60 ? "#D97706" : "#DC2626";
                        return (
                          <tr key={d.date} className="transition-colors hover:bg-[#F3F3F3]">
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium" style={{ color: C.onSurface }}>{formatTableDate(d.date)}</div>
                            </td>
                            <td className="px-6 py-4 text-center" style={{ color: C.onSurface }}>{d.present}</td>
                            <td className="px-6 py-4 text-center"><span className={d.late > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>{d.late}</span></td>
                            <td className="px-6 py-4 text-center"><span className={d.absentExcused > 0 ? "font-semibold text-blue-600" : "text-slate-400"}>{d.absentExcused}</span></td>
                            <td className="px-6 py-4 text-center"><span className={d.absentUnexcused > 0 ? "font-semibold text-red-600" : "text-slate-400"}>{d.absentUnexcused}</span></td>
                            <td className="px-6 py-4 text-center"><span className={d.earlyLeave > 0 ? "font-semibold text-purple-600" : "text-slate-400"}>{d.earlyLeave}</span></td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-20 overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: rateColor }} />
                                </div>
                                <span className="text-xs font-semibold" style={{ color: rateColor }}>{rate}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t px-6 py-3" style={{ borderColor: C.outlineVariant, backgroundColor: C.surfaceLow }}>
                  <span className="text-sm italic" style={{ color: C.onSurfaceVariant }}>
                    Hiển thị {sortedTimeline.length} ngày học
                  </span>
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

function ParentStudentAttendanceHistory() {
  const { user }                                   = useAuth();
  const [searchParams, setSearchParams]            = useSearchParams();
  const { students, loading: studentsLoading, error: studentsError } = useParentStudents();

  const activeTab = searchParams.get("tab") || "history";

  function setTab(key) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("tab", key);
      return p;
    });
  }

  // ── Active student ──
  const paramStudentId = searchParams.get("student")
    ? parseInt(searchParams.get("student"), 10)
    : null;

  const activeStudentId = useMemo(() => {
    if (studentsLoading || students.length === 0) return null;
    if (paramStudentId && students.some((s) => s.studentId === paramStudentId))
      return paramStudentId;
    return students[0].studentId;
  }, [students, studentsLoading, paramStudentId]);

  // ── Header user ──
  const headerUser = useMemo(() => {
    const role = user?.roles?.find((r) => r.roleName === "PARENT");
    return {
      name:   user?.fullName ?? user?.username ?? "Phụ huynh",
      role:   role?.description ?? "Phụ huynh",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {studentsLoading && (
        <div className="space-y-4">
          <div className="h-12 animate-pulse rounded-4xl bg-slate-200/60" />
          <div className="h-64 animate-pulse rounded-4xl bg-slate-200/60" />
        </div>
      )}

      {studentsError && (
        <div className="rounded-4xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được danh sách học sinh: {studentsError}
        </div>
      )}

      {!studentsLoading && !studentsError && students.length === 0 && (
        <div className="rounded-4xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.outlineVariant}`, backgroundColor: "#FFF7F2", color: C.onSurface }}>
          Chưa có học sinh nào được liên kết với tài khoản của bạn. Vui lòng liên hệ nhà trường.
        </div>
      )}

      {!studentsLoading && !studentsError && students.length > 0 && (
        <div className="space-y-6">
          {/* Header Section (Stitch) */}
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 className="text-2xl font-semibold" style={{ color: C.onSurface }}>
              Điểm danh
            </h2>

            {students.length > 1 && (
              <div className="flex items-center rounded-xl border bg-white p-1 shadow-sm" style={{ borderColor: C.outlineVariant }}>
                <Ms name="family_restroom" className="px-3" style={{ color: C.primary }} />
                <select
                  value={activeStudentId ?? ""}
                  onChange={(e) =>
                    setSearchParams((prev) => {
                      const p = new URLSearchParams(prev);
                      p.set("student", e.target.value);
                      return p;
                    })
                  }
                  className="cursor-pointer border-none bg-transparent pr-8 text-sm font-medium outline-none"
                  style={{ color: C.onSurface }}
                >
                  {students.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.studentFullName}{s.className ? ` · ${s.className}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tab strip (Stitch pills) */}
          <div className="flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.outlineVariant }}>
            <button
              type="button"
              onClick={() => setTab("history")}
              className="rounded-full px-4 py-1.5 text-sm font-bold transition-all"
              style={activeTab === "history" ? { backgroundColor: C.primaryContainer, color: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: C.onSurfaceVariant }}
            >
              Lịch sử
            </button>
            <button
              type="button"
              onClick={() => setTab("stats")}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition-colors hover:bg-[#E8E8E8]"
              style={activeTab === "stats" ? { backgroundColor: C.primaryContainer, color: "#fff", fontWeight: 700, boxShadow: "0 1px 2px rgba(0,0,0,0.1)" } : { color: C.onSurfaceVariant }}
            >
              Thống kê
            </button>
          </div>

          {activeTab === "history" && <HistoryTab studentId={activeStudentId} />}
          {activeTab === "stats"   && <StatsTab   studentId={activeStudentId} />}
        </div>
      )}
    </DashboardShell>
  );
}

export default ParentStudentAttendanceHistory;
