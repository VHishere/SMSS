import { useMemo, useState } from "react";
import { FiBarChart2, FiList } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudentAttendance } from "../../hooks/useParentStudentAttendance";
import { useParentStudentAttendanceStats } from "../../hooks/useParentStudentAttendanceStats";
import { useParentStudents } from "../../hooks/useParentStudents";

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

// ── Display helpers ───────────────────────────────────────────────────────────

const CONTEXT_LABEL = { CLASS: "Lớp học", DORM: "Ký túc xá" };
const VN_DAYS       = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatTableDate(dateStr) {
  const d  = new Date(dateStr + "T00:00:00");
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${VN_DAYS[d.getDay()]}, ${dd}/${mm}/${d.getFullYear()}`;
}

const ATTENDANCE_TYPE_CONFIG = {
  PRESENT:          { label: "Có mặt",         cls: "bg-green-100 text-green-700" },
  LATE:             { label: "Đi muộn",         cls: "bg-yellow-100 text-yellow-700" },
  ABSENT_EXCUSED:   { label: "Vắng có phép",    cls: "bg-orange-100 text-orange-700" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", cls: "bg-red-100 text-red-700" },
  EARLY_LEAVE:      { label: "Về sớm",          cls: "bg-blue-100 text-blue-700" },
};

function StatusBadge({ typeName }) {
  if (!typeName) return <span className="text-slate-400">—</span>;
  const cfg = ATTENDANCE_TYPE_CONFIG[typeName.toUpperCase()] ?? {
    label: typeName,
    cls:   "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-block rounded-full px-3 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

const HISTORY_COLS = ["STT", "NGÀY", "LOẠI", "LỚP / MÔN HỌC", "GIÁO VIÊN", "TRẠNG THÁI", "GHI CHÚ"];

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

  const selectStyle = `
    rounded-lg border border-slate-200 bg-white px-3 py-2
    text-sm text-[#0F2747] shadow-sm outline-none
    focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]
  `;

  return (
    <div>
      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Năm học</label>
          <select
            value={selectedYear}
            onChange={(e) => {
              const year = e.target.value;
              setFilter({ year, weekStart: findDefaultWeek(getWeeksForSchoolYear(year)) });
            }}
            className={selectStyle}
          >
            {schoolYears.map((y) => (
              <option key={y.value} value={y.value}>{y.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Tuần học</label>
          <select
            value={selectedWeekStart}
            onChange={(e) => setFilter((f) => ({ ...f, weekStart: e.target.value }))}
            className={`${selectStyle} min-w-[280px]`}
          >
            {weeks.map((w) => (
              <option key={w.value} value={w.value}>{w.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-orange-100 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
          Đang tải dữ liệu điểm danh...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Không tải được dữ liệu: {error}
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
          {items.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-400">
              Không có dữ liệu điểm danh trong tuần này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-orange-100 bg-[#FFF7F2]">
                    {HISTORY_COLS.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-[#F27123]"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => (
                    <tr
                      key={row.attendanceId}
                      className={`border-b border-slate-50 ${idx % 2 === 1 ? "bg-slate-50/50" : "bg-white"}`}
                    >
                      <td className="px-4 py-3 text-slate-400">{idx + 1}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[#0F2747]">
                        {formatTableDate(row.attendanceDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {CONTEXT_LABEL[row.context] ?? row.context ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.subjectName ?? row.className ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{row.createdByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <StatusBadge typeName={row.typeName} />
                      </td>
                      <td className="px-4 py-3 text-slate-500">{row.note ?? "—"}</td>
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

// ── Stats Tab ─────────────────────────────────────────────────────────────────

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

const CONTEXT_OPTIONS = [
  { value: "",      label: "Tất cả" },
  { value: "CLASS", label: "Lớp học" },
  { value: "DORM",  label: "Ký túc xá" },
];

function SummaryCard({ typeName, count, rate }) {
  const cfg = TYPE_LABEL[typeName] ?? { label: typeName, color: "#475569" };
  return (
    <div
      className="rounded-xl bg-white p-4 shadow-sm"
      style={{ border: "1px solid #FFE7D6" }}
    >
      <p className="mb-1 text-xs font-medium text-slate-500">{cfg.label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color: "#0F2747" }}>
        {rate}%
      </p>
      <p className="mt-1 text-xs text-slate-400">{count} lần</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: cfg.color }}
        />
      </div>
    </div>
  );
}

function PieChart({ byType, total }) {
  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        Chưa có dữ liệu điểm danh trong giai đoạn này.
      </p>
    );
  }

  const CX = 90, CY = 90, R = 80;

  const slices = ALL_TYPES
    .map((key) => {
      const cfg   = TYPE_LABEL[key] ?? { label: key, color: "#94A3B8" };
      const count = byType[key]?.count ?? 0;
      return { key, color: cfg.color, count, fraction: count / total };
    })
    .filter((s) => s.count > 0);

  const paths = slices.reduce((acc, s) => {
    const prevAngle = acc.length > 0 ? acc[acc.length - 1].endAngle : -Math.PI / 2;
    const sweep     = s.fraction >= 1 ? Math.PI * 2 - 0.0001 : s.fraction * Math.PI * 2;
    const endAngle  = prevAngle + sweep;
    const largeArc  = sweep > Math.PI ? 1 : 0;
    const c1 = [Math.cos(prevAngle), Math.sin(prevAngle)];
    const c2 = [Math.cos(endAngle),  Math.sin(endAngle)];

    const d = [
      `M ${CX} ${CY}`,
      `L ${CX + R * c1[0]} ${CY + R * c1[1]}`,
      `A ${R} ${R} 0 ${largeArc} 1 ${CX + R * c2[0]} ${CY + R * c2[1]}`,
      "Z",
    ].join(" ");

    return [...acc, { ...s, d, endAngle }];
  }, []);

  return (
    <div className="flex justify-center">
      <svg
        viewBox="0 0 180 180"
        className="w-80"
        role="img"
        aria-label="Biểu đồ phân bố điểm danh"
      >
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.color} stroke="#fff" strokeWidth="1.5" />
        ))}
      </svg>
    </div>
  );
}

const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];

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

  const inputCls = `
    rounded-lg border border-slate-200 bg-white px-3 py-2
    text-sm text-[#0F2747] shadow-sm outline-none
    focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]
  `;

  return (
    <div>
      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-end gap-3">
        {/* Period preset */}
        <div className="flex rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm">
          {ANALYTICS_PERIODS.map((p, idx) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium transition"
              style={
                !useCustom && periodIdx === idx
                  ? { backgroundColor: "#F27123", color: "#fff" }
                  : { color: "#64748B" }
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range */}
        <div className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">Tùy chỉnh từ</label>
            <input
              type="date"
              value={customStart}
              onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500">đến</label>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
              className={inputCls}
            />
          </div>
        </div>

        {/* Context filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Phạm vi</label>
          <select
            value={context}
            onChange={(e) => setContext(e.target.value)}
            className={inputCls}
          >
            {CONTEXT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {ALL_TYPES.map((t) => (
              <SummaryCard
                key={t}
                typeName={t}
                count={data.summary.byType[t]?.count ?? 0}
                rate={data.summary.byType[t]?.rate ?? 0}
              />
            ))}
          </div>

          {/* Pie chart */}
          <div
            className="rounded-xl bg-white p-5 shadow-sm"
            style={{ border: "1px solid #FFE7D6" }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>
                  Phân bố trạng thái điểm danh
                </h3>
                <p className="text-xs text-slate-500">
                  {data.period.startDate} → {data.period.endDate}
                  <span className="ml-2 text-slate-400">
                    · Tổng {data.summary.totalRecords} lần ghi nhận
                  </span>
                </p>
              </div>

              {/* Legend — all 5 types */}
              <div className="flex shrink-0 flex-col gap-1.5">
                {ALL_TYPES.map((key) => {
                  const cfg   = TYPE_LABEL[key] ?? { label: key, color: "#94A3B8" };
                  const count = data.summary.byType[key]?.count ?? 0;
                  const rate  = data.summary.byType[key]?.rate  ?? 0;
                  return (
                    <div key={key} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: cfg.color, opacity: count === 0 ? 0.35 : 1 }}
                      />
                      <span className={count === 0 ? "text-slate-400" : "text-slate-600"}>
                        {cfg.label}
                      </span>
                      <span className={`ml-1 font-semibold ${count === 0 ? "text-slate-400" : "text-slate-700"}`}>
                        {count}
                      </span>
                      <span className="text-slate-400">({rate}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <PieChart byType={data.summary.byType} total={data.summary.totalRecords} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Tab navigation config ─────────────────────────────────────────────────────

const TABS = [
  { key: "history", label: "Lịch sử",  Icon: FiList      },
  { key: "stats",   label: "Thống kê", Icon: FiBarChart2 },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

function ParentStudentAttendanceHistory() {
  const { user }                                   = useAuth();
  const [searchParams, setSearchParams]            = useSearchParams();
  const { students, loading: studentsLoading }     = useParentStudents();

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

  const activeStudent = useMemo(
    () => students.find((s) => s.studentId === activeStudentId) ?? null,
    [students, activeStudentId],
  );

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
      sidebarFooterLabel="Điểm danh"
      sidebarFooterValue={activeTab === "stats" ? "Thống kê" : "Lịch sử"}
    >
      {/* Page header */}
      <section className="mb-6 rounded-2xl border border-orange-100 bg-white p-5 shadow-sm sm:p-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F27123]">
          Theo dõi học sinh
        </p>
        <h1 className="mb-1 text-2xl font-bold text-[#0F2747] sm:text-3xl">
          Điểm danh
        </h1>
        <p className="text-sm text-slate-500">
          Xem lịch sử và thống kê chuyên cần của học sinh.
        </p>
      </section>

      {/* Student selector — only when parent has multiple students */}
      {!studentsLoading && students.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {students.map((s) => (
            <button
              key={s.studentId}
              type="button"
              onClick={() =>
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev);
                  p.set("student", s.studentId);
                  return p;
                })
              }
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                s.studentId === activeStudentId
                  ? "bg-[#08509F] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.studentFullName}
              {s.className && (
                <span className="ml-1.5 opacity-70">· {s.className}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Student info banner */}
      {activeStudent && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
          {activeStudent.studentAvatar ? (
            <img
              src={activeStudent.studentAvatar}
              alt={activeStudent.studentFullName}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
              {activeStudent.studentFullName?.[0] ?? "?"}
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-[#0F2747]">
              {activeStudent.studentFullName}
            </span>
            <span className="ml-2 text-xs text-slate-500">
              {activeStudent.studentCode} · {activeStudent.relationship}
            </span>
          </div>
        </div>
      )}

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
            style={
              activeTab === key
                ? { backgroundColor: "#F27123", color: "#fff" }
                : { color: "#64748B" }
            }
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div
        className="rounded-2xl bg-white p-5 shadow-sm sm:p-6"
        style={{ border: "1px solid #FFE7D6" }}
      >
        {activeTab === "history" && <HistoryTab studentId={activeStudentId} />}
        {activeTab === "stats"   && <StatsTab   studentId={activeStudentId} />}
      </div>
    </DashboardShell>
  );
}

export default ParentStudentAttendanceHistory;
