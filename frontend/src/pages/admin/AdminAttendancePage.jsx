import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import StaffPageHeader from "../../components/staff/StaffPageHeader";
import { adminApi } from "../../api/client";
import { useAdminAttendanceMeta } from "../../hooks/useAdminAttendanceMeta";
import { useAdminAttendanceOverview } from "../../hooks/useAdminAttendanceOverview";
import { useAdminAttendanceAnalytics } from "../../hooks/useAdminAttendanceAnalytics";
import { formatDateVN } from "../../utils/datetime";
import PrettySelect from "../../components/molecules/PrettySelect";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}

const TABS = [
  { key: "analytics", label: "Lịch sử & Thống kê", ms: "insights" },
  { key: "history", label: "Lịch sử điểm danh", ms: "history" },
  { key: "overview", label: "Tổng hợp lớp", ms: "fact_check" },
];

const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };
const THEAD_STYLE = { backgroundColor: C.deepBlue };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getMonthRange(offsetMonths = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const mo = now.getMonth() + offsetMonths;
  const start = new Date(year, mo, 1);
  const end = new Date(year, mo + 1, 0);
  return { startDate: toISO(start), endDate: toISO(end) };
}

const ANALYTICS_PERIODS = [
  { label: "Tháng này", ...getMonthRange(0) },
  { label: "Tháng trước", ...getMonthRange(-1) },
  { label: "2 tháng trước", ...getMonthRange(-2) },
];

const TYPE_LABEL = {
  PRESENT: { label: "Có mặt", color: "#15803D" },
  LATE: { label: "Đi muộn", color: "#B45309" },
  ABSENT_EXCUSED: { label: "Vắng có phép", color: "#225DAD" },
  ABSENT_UNEXCUSED: { label: "Vắng không phép", color: "#BA1A1A" },
  EARLY_LEAVE: { label: "Về sớm", color: "#7C3AED" },
};
const ALL_TYPES = ["PRESENT", "LATE", "ABSENT_EXCUSED", "ABSENT_UNEXCUSED", "EARLY_LEAVE"];

function formatDateTimeLocal(value) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function StatBox({ label, value, color = C.onSurface, children }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
      {children}
    </div>
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
        <text x={cx} y={cy + 18} textAnchor="middle" fontSize="10" fill={C.muted}>Lượt điểm danh</text>
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
        {n > 1 && <polyline points={line} fill="none" stroke={C.orange} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((p, i) => (
          <g key={p.date}>
            <circle cx={x(i)} cy={y(p.rate)} r="4" fill="#fff" stroke={C.orange} strokeWidth="2.5" />
            <text x={x(i)} y={y(p.rate) - 10} fontSize="10" fontWeight="700" fill={C.onSurface} textAnchor="middle">{p.rate}%</text>
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#8C7266" textAnchor="middle">{fmt(p.date)}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─── Lịch sử & Thống kê ───────────────────────────────────────────────────────
function AnalyticsTab({ classId }) {
  const [periodIdx, setPeriodIdx] = useState(0);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const period = ANALYTICS_PERIODS[periodIdx];
  const startDate = useCustom ? customStart : period.startDate;
  const endDate = useCustom ? customEnd : period.endDate;

  const { data, loading, error } = useAdminAttendanceAnalytics(classId, startDate || undefined, endDate || undefined);

  const donutSegments = data
    ? ALL_TYPES.map((t) => ({
        label: TYPE_LABEL[t].label,
        color: TYPE_LABEL[t].color,
        count: data.summary.byType[t]?.count ?? 0,
        rate: data.summary.byType[t]?.rate ?? 0,
      }))
    : [];

  const totalRecords = data?.summary.totalRecords ?? 0;
  const presentCount = data?.summary.byType.PRESENT?.count ?? 0;
  const lateCount = data?.summary.byType.LATE?.count ?? 0;
  const absentExcused = data?.summary.byType.ABSENT_EXCUSED?.count ?? 0;
  const absentUnexcused = data?.summary.byType.ABSENT_UNEXCUSED?.count ?? 0;
  const avgRate = totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Khoảng thời gian</label>
            <div className="flex flex-wrap gap-2">
              {ANALYTICS_PERIODS.map((p, idx) => {
                const active = !useCustom && periodIdx === idx;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setPeriodIdx(idx); setUseCustom(false); }}
                    className={`rounded-full px-4 py-1.5 text-xs transition-all ${active ? "font-bold text-white shadow-sm" : "border bg-white font-medium hover:bg-[#F3F3F3]"}`}
                    style={active ? { backgroundColor: C.orange } : { borderColor: C.border, color: C.muted }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Từ ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.orange : C.border }}>
              <Ms name="calendar_month" className="mr-2 text-[20px]!" style={{ color: C.primary }} />
              <input type="date" value={customStart} onChange={(e) => { setCustomStart(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none" style={{ color: C.onSurface }} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Đến ngày</label>
            <div className="flex items-center rounded-xl border bg-white px-3 shadow-sm" style={{ borderColor: useCustom ? C.orange : C.border }}>
              <Ms name="calendar_month" className="mr-2 text-[20px]!" style={{ color: C.primary }} />
              <input type="date" value={customEnd} onChange={(e) => { setCustomEnd(e.target.value); setUseCustom(true); }}
                className="cursor-pointer border-none bg-transparent py-2 text-sm font-medium outline-none" style={{ color: C.onSurface }} />
            </div>
          </div>
        </div>
      </section>

      {loading && <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{[0, 1, 2].map((n) => <div key={n} className="h-44 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatBox label="Tỷ lệ hiện diện trung bình" value={`${avgRate}%`} color={C.orange}>
              <div className="mt-4 h-1 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(avgRate, 100)}%`, backgroundColor: C.orange }} />
              </div>
            </StatBox>
            <StatBox label="Tổng số buổi vắng" value={absentExcused + absentUnexcused} color={C.error}>
              <p className="mt-2 text-xs italic" style={{ color: C.muted }}>{absentUnexcused} không phép · {absentExcused} có phép</p>
            </StatBox>
            <StatBox label="Số lượt đi muộn" value={lateCount} color={C.secondary} />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="flex flex-col rounded-3xl bg-white p-6 shadow-sm lg:col-span-2" style={{ border: `1px solid ${C.border}` }}>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Biểu đồ xu hướng chuyên cần</h3>
                <span className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium" style={{ borderColor: C.border, color: C.muted }}>
                  {formatDateVN(data.period.startDate)} – {formatDateVN(data.period.endDate)}
                </span>
              </div>
              <div className="flex flex-1 items-end">
                <AttendanceRateLine timeline={data.timeline} />
              </div>
            </div>
            <div className="flex flex-col items-center rounded-3xl bg-white p-6 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-6 w-full text-center text-base font-bold" style={{ color: C.onSurface }}>Phân bổ trạng thái</h3>
              {data.summary.totalRecords > 0 ? <DonutChart segments={donutSegments} total={data.summary.totalRecords} /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu trong giai đoạn này.</p>}
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
              <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Thống kê điểm danh chi tiết</h3>
            </div>
            {data.students.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-white" style={THEAD_STYLE}>
                    <tr>
                      <th className={TH}>Học sinh</th>
                      {["Có mặt", "Đi muộn", "Vắng có phép", "Vắng không phép", "Về sớm"].map((h) => <th key={h} className={`${TH} text-center`}>{h}</th>)}
                      <th className={TH}>Chuyên cần</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: C.border }}>
                    {data.students.map((s) => {
                      const rateColor = s.attendanceRate >= 80 ? "#15803D" : s.attendanceRate >= 60 ? "#D97706" : "#DC2626";
                      return (
                        <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                          <td className="px-6 py-4">
                            <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.fullName}</div>
                            <div className="text-xs" style={{ color: "#8C7266" }}>{s.studentCode}</div>
                          </td>
                          <td className="px-6 py-4 text-center" style={{ color: C.onSurface }}>{s.present}</td>
                          <td className="px-6 py-4 text-center"><span className={s.late > 0 ? "font-semibold text-amber-600" : "text-slate-400"}>{s.late}</span></td>
                          <td className="px-6 py-4 text-center"><span className={s.absentExcused > 0 ? "font-semibold text-blue-600" : "text-slate-400"}>{s.absentExcused}</span></td>
                          <td className="px-6 py-4 text-center"><span className={s.absentUnexcused > 0 ? "font-semibold text-red-600" : "text-slate-400"}>{s.absentUnexcused}</span></td>
                          <td className="px-6 py-4 text-center"><span className={s.earlyLeave > 0 ? "font-semibold text-purple-600" : "text-slate-400"}>{s.earlyLeave}</span></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-20 overflow-hidden rounded-full" style={{ backgroundColor: C.surfaceLow }}>
                                <div className="h-full rounded-full" style={{ width: `${Math.min(s.attendanceRate, 100)}%`, backgroundColor: rateColor }} />
                              </div>
                              <span className="text-xs font-semibold" style={{ color: rateColor }}>{s.attendanceRate}%</span>
                            </div>
                          </td>
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
    </div>
  );
}

// ─── Tổng hợp lớp (mọi lớp) + quét cảnh báo & báo PH ──────────────────────────
function HistoryTab({ classId }) {
  const [filters, setFilters] = useState({ startDate: "", endDate: "" });
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!classId) return;
    let mounted = true;
    setLoading(true);
    setError("");

    adminApi
      .getAttendanceHistory(classId, { ...filters, limit: 100 })
      .then((res) => {
        if (!mounted) return;
        setRows(res.data?.rows || []);
        setTotal(res.data?.total || 0);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [classId, filters]);

  const setFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-6 py-4" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
        <div>
          <h3 className="text-base font-bold" style={{ color: C.onSurface }}>Lịch sử điểm danh</h3>
          <p className="mt-1 text-xs" style={{ color: C.muted }}>{total} bản ghi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilter("startDate", e.target.value)}
            className={selectCls}
            style={selStyle}
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilter("endDate", e.target.value)}
            className={selectCls}
            style={selStyle}
          />
          <button
            type="button"
            onClick={() => setFilters({ startDate: "", endDate: "" })}
            className="rounded-full border bg-white px-4 py-2 text-sm font-semibold"
            style={{ borderColor: C.border, color: C.secondary }}
          >
            Xóa lọc
          </button>
        </div>
      </div>

      {loading && <div className="h-40 animate-pulse bg-slate-100" />}
      {error && <div className="m-6 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white" style={THEAD_STYLE}>
              <tr>
                <th className={TH}>Ngày</th>
                <th className={TH}>Học sinh</th>
                <th className={TH}>Trạng thái</th>
                <th className={TH}>Ghi chú</th>
                <th className={TH}>Thời điểm ghi</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    Chưa có bản ghi điểm danh.
                  </td>
                </tr>
              ) : rows.map((row) => {
                const type = TYPE_LABEL[row.typeName] || { label: row.typeName || "—", color: C.muted };
                return (
                  <tr key={row.attendanceId} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-6 py-4 font-medium" style={{ color: C.onSurface }}>{formatDateVN(row.attendanceDate)}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium" style={{ color: C.onSurface }}>{row.fullName}</div>
                      <div className="text-xs" style={{ color: C.muted }}>{row.studentCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${type.color}1A`, color: type.color }}>
                        {type.label}
                      </span>
                    </td>
                    <td className="px-6 py-4" style={{ color: C.muted }}>{row.note || "—"}</td>
                    <td className="px-6 py-4" style={{ color: C.muted }}>{formatDateTimeLocal(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const ABS_LEVEL = {
  OVER: { label: "Vượt ngưỡng", bg: "#FFDAD6", text: "#93000A" },
  LIMIT: { label: "Chạm ngưỡng", bg: "#FFE9CC", text: "#9A4A00" },
  WARN: { label: "Cảnh báo", bg: "#FEF3C7", text: "#B45309" },
  OK: { label: "Bình thường", bg: "#DCFCE7", text: "#15803D" },
};

function OverviewTab({ classId }) {
  const { data, loading, error } = useAdminAttendanceOverview(classId, 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700">
          <Ms name="notifications_active" className="text-[17px]!" />
          Cảnh báo 36/45 buổi được gửi tự động
        </div>
      </div>

      {loading && <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
          <div className="rounded-3xl p-4 text-sm" style={{ backgroundColor: "#FFF7F2", color: C.onSurface }}>
            <span className="font-semibold">Ngưỡng nghỉ:</span> tối đa {data.policy.maxAbsentSessions} buổi/năm (1 buổi = {data.policy.periodsPerSession} tiết) · cảnh báo từ {data.warnThreshold} buổi.
            {" "}<span style={{ color: "#93000A" }}>{data.summary.over} vượt ngưỡng</span> · <span style={{ color: "#9A4A00" }}>{data.summary.limit || 0} chạm ngưỡng</span> · <span style={{ color: "#B45309" }}>{data.summary.warn} cảnh báo</span> / {data.summary.total} HS.
          </div>

          <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-white" style={THEAD_STYLE}>
                  <tr>
                    <th className={TH}>Học sinh</th>
                    <th className={`${TH} text-center`}>Tiết đã ĐD</th>
                    <th className={`${TH} text-center`}>Đi muộn</th>
                    <th className={`${TH} text-center`}>Vắng CP</th>
                    <th className={`${TH} text-center`}>Vắng KP</th>
                    <th className={`${TH} text-center`}>Quy đổi buổi nghỉ</th>
                    <th className={`${TH} text-center`}>Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: C.border }}>
                  {data.students.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</td></tr>
                  ) : data.students.map((s) => {
                    const lv = ABS_LEVEL[s.level] ?? ABS_LEVEL.OK;
                    return (
                      <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                        <td className="px-4 py-2.5">
                          <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.fullName}</div>
                          <div className="text-xs text-slate-400">{s.studentCode}</div>
                        </td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.muted }}>{s.totalPeriods}</td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.muted }}>{s.late}</td>
                        <td className="px-4 py-2.5 text-center" style={{ color: C.muted }}>{s.absentExcused}</td>
                        <td className="px-4 py-2.5 text-center font-semibold" style={{ color: s.absentUnexcused > 0 ? "#BA1A1A" : C.muted }}>{s.absentUnexcused}</td>
                        <td className="px-4 py-2.5 text-center font-bold" style={{ color: C.onSurface }}>{s.absentSessions}</td>
                        <td className="px-4 py-2.5 text-center"><span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: lv.bg, color: lv.text }}>{lv.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
// Read-only-ish admin equivalent of teacher's "Điểm danh" page (Lịch sử &
// Thống kê + Tổng hợp lớp CN tabs), scoped to EVERY class school-wide instead
// of the teacher's own/homeroom classes — no daily roll-call marking here.
// Admin can still trigger "Quét cảnh báo & báo PH" (absence-warning scan +
// parent notification) for any class, since that's a monitoring action, not
// a per-lesson attendance edit.
function AdminAttendancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "analytics";
  const { data: meta, loading: metaLoading, error: metaError } = useAdminAttendanceMeta();

  const [selectedClassId, setSelectedClassId] = useState("");
  const classes = useMemo(() => meta?.classes ?? [], [meta]);
  const classId = selectedClassId || String(classes[0]?.classId || "");

  function setTab(key) { setSearchParams({ tab: key }); }

  const classPicker = !metaLoading && classes.length > 0 && (
    <PrettySelect value={classId} onChange={(e) => setSelectedClassId(e.target.value)} className={selectCls} style={selStyle}>
      {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
    </PrettySelect>
  );

  return (
    <>
      <StaffPageHeader title="Điểm danh" action={classPicker} />

      {metaError && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : classes.length === 0 ? (
        <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chưa có lớp học nào trong hệ thống.</div>
      ) : (
        <>
          <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="text-[18px]!" /><span>{label}</span>
              </button>
            ))}
          </div>

          {activeTab === "analytics" && <AnalyticsTab classId={classId} />}
          {activeTab === "history" && <HistoryTab classId={classId} />}
          {activeTab === "overview" && <OverviewTab classId={classId} />}
        </>
      )}
    </>
  );
}

export default AdminAttendancePage;
