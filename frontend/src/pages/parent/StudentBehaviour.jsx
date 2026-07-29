import { useMemo, useState } from "react";

import DashboardShell from "../../components/templates/DashboardShell";

import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentBehaviourSemesters } from "../../hooks/useParentBehaviourSemesters";
import { useParentBehaviourRecords } from "../../hooks/useParentBehaviourRecords";
import { useParentBehaviourConduct } from "../../hooks/useParentBehaviourConduct";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
import PrettySelect from "../../components/molecules/PrettySelect";

// ─── FSchool Stitch design tokens (matches the teacher behaviour portal) ─────

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surface: "#F9F9F9", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style, fill = false }) {
  return <span className={`material-symbols-outlined ${className}`} style={{ ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}), ...style }}>{name}</span>;
}

function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  if (!p.length) return "?";
  if (p.length === 1) return p[0][0]?.toUpperCase() ?? "?";
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function humanizeCategory(key) {
  if (!key) return "Khác";
  return String(key)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function monthLabel(dateStr) {
  const d = new Date(`${dateStr}-01T00:00:00`);
  return `T${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

const AVA = ["#00458E", "#4A5F82", "#225DAD", "#F27123"];
const CAT_COLORS = ["#00458E", "#F27123", "#225DAD", "#15803D", "#B45309", "#7C3AED", "#BA1A1A", "#4A5F82"];

const TABS = [
  { key: "overview", label: "Tổng quan", ms: "dashboard" },
  { key: "analytics", label: "Phân tích", ms: "insights" },
];

const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };
const THEAD = "text-white";
const THEAD_STYLE = { backgroundColor: C.deepBlue };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

function AvatarChip({ name, avatar, i = 0, size = 9 }) {
  const cls = size === 8 ? "h-8 w-8" : "h-9 w-9";
  return (
    <div className={`flex ${cls} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`} style={{ backgroundColor: AVA[i % AVA.length] }}>
      {avatar ? <img src={avatar} alt={name} className={`${cls} rounded-full object-cover`} /> : initials(name)}
    </div>
  );
}

function recStatus(r) {
  if (r.behaviorType === "VIOLATION") return { label: "Vi phạm", bg: "rgba(186,26,26,0.1)", text: C.error, delta: `-${Math.abs(r.points)}`, dcolor: C.error };
  if (r.points >= 20) return { label: "Khen thưởng cao", bg: "rgba(242,113,35,0.1)", text: C.orange, delta: `+${r.points}`, dcolor: C.orange };
  return { label: "Khen thưởng", bg: "rgba(34,93,173,0.1)", text: C.secondary, delta: `+${r.points}`, dcolor: C.secondary };
}

// ─── StatBox (ported from teacher's analytics tab) ────────────────────────────

function StatBox({ label, value, color = C.onSurface }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

// ─── Charts (ported from teacher's analytics tab) ─────────────────────────────

function DonutChart({ segments, total }) {
  const R = 52, cx = 70, cy = 70, Circ = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const len = total > 0 ? (s.count / total) * Circ : 0;
    const off = total > 0 ? -(before / total) * Circ : 0;
    return { color: s.color, len, off };
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs.map((a, i) => a.len > 0 && <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth="16" strokeDasharray={`${a.len} ${Circ}`} strokeDashoffset={a.off} transform={`rotate(-90 ${cx} ${cy})`} />)}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill={C.onSurface}>{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#64748B">bản ghi</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold" style={{ color: C.onSurface }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeritTrendChart({ trend }) {
  if (!trend.length) return <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>;
  const stepX = 84, padX = 34, padTop = 18, chartH = 120, padBottom = 26;
  const n = trend.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const maxV = Math.max(...trend.flatMap((t) => [t.merit, Math.abs(t.demerit)]), 1);
  const x = (i) => padX + i * stepX;
  const y = (v) => padTop + (1 - v / maxV) * chartH;
  const seriesLine = (key) => trend.map((t, i) => `${x(i)},${y(Math.abs(t[key]))}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, maxV / 2, maxV].map((g, i) => (
          <g key={i}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#EEEEEE" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{Math.round(g)}</text>
          </g>
        ))}
        {n > 1 && <polyline points={seriesLine("merit")} fill="none" stroke={C.success} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {n > 1 && <polyline points={seriesLine("demerit")} fill="none" stroke={C.error} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {trend.map((t, i) => (
          <g key={t.month}>
            <circle cx={x(i)} cy={y(t.merit)} r="3.5" fill="#fff" stroke={C.success} strokeWidth="2" />
            <circle cx={x(i)} cy={y(Math.abs(t.demerit))} r="3.5" fill="#fff" stroke={C.error} strokeWidth="2" />
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#64748B" textAnchor="middle">{t.month}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: C.success }} /> Khen thưởng</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: C.error }} /> Kỷ luật</span>
      </div>
    </div>
  );
}

// ─── Tab 1: Tổng quan (records table + official conduct evaluation) ──────────

function OverviewTab({ records, conduct }) {
  const [typeFilter, setTypeFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => (typeFilter ? records.filter((r) => r.behaviorType === typeFilter) : records),
    [records, typeFilter],
  );
  const shown = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: recent records table */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm lg:col-span-2" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: C.border }}>
          <h4 className="font-bold" style={{ color: C.onSurface }}>Ghi nhận gần đây</h4>
          <PrettySelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={selStyle}>
            <option value="">Tất cả các loại</option>
            <option value="POSITIVE">Khen thưởng</option>
            <option value="VIOLATION">Vi phạm</option>
          </PrettySelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={THEAD} style={THEAD_STYLE}>
              <tr>
                <th className={TH}>Tiêu đề</th>
                <th className={TH}>Danh mục</th>
                <th className={TH}>Trạng thái</th>
                <th className={`${TH} text-right`}>Điểm rèn luyện</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {shown.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">Chưa có ghi nhận nào.</td></tr>
              ) : shown.map((r, i) => {
                const st = recStatus(r);
                return (
                  <tr key={r.behaviorId} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarChip name={r.title} i={i} size={8} />
                        <div className="min-w-0">
                          <p className="font-bold" style={{ color: C.onSurface }}>{r.title}</p>
                          <p className="text-[11px]" style={{ color: C.muted }}>{r.recordDate} • {r.createdByName ?? "—"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4" style={{ color: C.onSurface }}>{humanizeCategory(r.category)}</td>
                    <td className="px-4 py-4"><span className="rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span></td>
                    <td className="px-4 py-4 text-right font-bold" style={{ color: st.dcolor, fontFamily: "monospace" }}>{st.delta}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length > 6 && (
          <div className="flex justify-center border-t p-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
            <button type="button" onClick={() => setShowAll((v) => !v)} className="text-sm font-bold hover:underline" style={{ color: C.secondary }}>
              {showAll ? "Thu gọn" : `Xem tất cả ${filtered.length} bản ghi`}
            </button>
          </div>
        )}
      </div>

      {/* Right: official conduct evaluation */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>
              <Ms name="workspace_premium" />
            </div>
            <div>
              <h4 className="font-bold" style={{ color: C.onSurface }}>Đánh giá hạnh kiểm</h4>
              {conduct && <p className="text-[11px]" style={{ color: C.muted }}>{conduct.semesterName} · {conduct.schoolYearName}</p>}
            </div>
          </div>

          {!conduct ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu đánh giá cho học kỳ này.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl p-4" style={{ backgroundColor: C.surfaceLow }}>
                  <p className="mb-1 text-[11px] font-bold uppercase" style={{ color: C.muted }}>Điểm nền</p>
                  <p className="text-xl font-bold" style={{ color: C.onSurface }}>{conduct.baseScore}</p>
                </div>
                <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(21,128,61,0.08)" }}>
                  <p className="mb-1 text-[11px] font-bold uppercase" style={{ color: C.muted }}>Điểm cộng</p>
                  <p className="text-xl font-bold" style={{ color: C.success }}>+{conduct.meritPoints}</p>
                </div>
                <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(186,26,26,0.08)" }}>
                  <p className="mb-1 text-[11px] font-bold uppercase" style={{ color: C.muted }}>Điểm trừ</p>
                  <p className="text-xl font-bold" style={{ color: C.error }}>-{conduct.demeritPoints}</p>
                </div>
                <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(242,113,35,0.08)" }}>
                  <p className="mb-1 text-[11px] font-bold uppercase" style={{ color: C.muted }}>Xếp loại</p>
                  <p className="text-xl font-bold" style={{ color: C.orange }}>{conduct.conductGrade || "—"}</p>
                </div>
              </div>
              {conduct.comment && (
                <p className="mt-4 text-sm" style={{ color: C.muted }}>{conduct.comment}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 2: Phân tích (per-record category distribution + monthly trend) ─────

function AnalyticsTab({ records }) {
  const donutSegments = useMemo(() => {
    const counts = {};
    records.forEach((r) => { const key = humanizeCategory(r.category); counts[key] = (counts[key] ?? 0) + 1; });
    return Object.entries(counts).map(([label, count], i) => ({ label, count, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [records]);
  const donutTotal = donutSegments.reduce((sum, d) => sum + d.count, 0);

  const trend = useMemo(() => {
    const byMonth = {};
    records.forEach((r) => {
      const key = String(r.recordDate).slice(0, 7); // YYYY-MM
      if (!byMonth[key]) byMonth[key] = { key, merit: 0, demerit: 0 };
      if (r.behaviorType === "POSITIVE") byMonth[key].merit += r.points;
      else byMonth[key].demerit += Math.abs(r.points);
    });
    return Object.values(byMonth)
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((t) => ({ ...t, month: monthLabel(t.key) }));
  }, [records]);

  if (records.length === 0) {
    return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chưa có dữ liệu để phân tích trong học kỳ này.</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h3 className="mb-4 text-sm font-bold" style={{ color: C.onSurface }}>Phân bố theo danh mục</h3>
        {donutTotal > 0 ? <DonutChart segments={donutSegments} total={donutTotal} /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
      </div>
      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" className="text-[18px]!" style={{ color: C.orange }} /> Khen thưởng vs Kỷ luật theo tháng</h3>
        <MeritTrendChart trend={trend} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function StudentBehaviour() {
  const { user } = useAuth();
  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");
  const { data: semesters, loading: semestersLoading } = useParentBehaviourSemesters(effStudentId);

  const effSemesterId = selectedSemesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const effSemester = semesters.find((s) => String(s.semesterId) === effSemesterId);

  const recordFilters = useMemo(
    () => ({ startDate: effSemester?.startDate, endDate: effSemester?.endDate, page: 1, limit: 100 }),
    [effSemester?.startDate, effSemester?.endDate],
  );

  const { data: recordsData, loading: recordsLoading, error: recordsError } =
    useParentBehaviourRecords(effStudentId, recordFilters, Boolean(effStudentId));

  const { data: conductData, loading: conductLoading, error: conductError } =
    useParentBehaviourConduct(effStudentId, effSemesterId);

  const headerUser = useMemo(() => ({
    name: user?.fullName ?? user?.username ?? "Phụ huynh",
    role: "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  function selectStudent(id) {
    setSelectedStudentId(String(id));
    setSelectedSemesterId("");
  }

  const records = recordsData?.items || [];
  const loading = studentsLoading || semestersLoading || recordsLoading || conductLoading;
  const error = recordsError || conductError;

  const summary = useMemo(
    () =>
      conductData
        ? {
            meritCount: conductData.aggregate?.meritCount || 0,
            meritPoints: conductData.aggregate?.meritPoints || 0,
            violationCount: conductData.aggregate?.violationCount || 0,
            demeritPoints: Math.abs(conductData.aggregate?.demeritPoints || 0),
            totalRecords: (conductData.aggregate?.meritCount || 0) + (conductData.aggregate?.violationCount || 0),
          }
        : null,
    [conductData],
  );

  const conduct = useMemo(
    () =>
      conductData
        ? {
            finalScore: conductData.computed?.finalScore,
            conductGrade: conductData.conductGradeLabel ?? conductData.computed?.grade?.label,
            baseScore: conductData.computed?.base,
            meritPoints: conductData.computed?.meritPoints,
            demeritPoints: Math.abs(conductData.computed?.demeritPoints || 0),
            comment: conductData.existing?.comment,
            semesterName: effSemester?.semesterName,
            schoolYearName: effSemester?.schoolYearName,
          }
        : null,
    [conductData, effSemester],
  );

  const summaryScore = useMemo(() => {
    if (conduct?.finalScore != null) return conduct.finalScore;
    const merit = Number(summary?.meritPoints || 0);
    const demerit = Number(summary?.demeritPoints || 0);
    return Math.max(0, 100 + merit - demerit);
  }, [conduct, summary]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {/* Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Hạnh kiểm</h2>
        <div className="flex flex-wrap items-center gap-2">
          {!studentsLoading && students.length > 1 && (
            <PrettySelect value={effStudentId} onChange={(e) => selectStudent(e.target.value)} className={selectCls} style={selStyle}>
              {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentFullName}</option>)}
            </PrettySelect>
          )}
          <PrettySelect value={effSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} className={selectCls} style={selStyle}>
            {semestersLoading ? (
              <option>Đang tải...</option>
            ) : (
              semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)
            )}
          </PrettySelect>
        </div>
      </div>

      {loading && <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}

      {!loading && error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">Không tải được hạnh kiểm: {error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Stat boxes */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBox label="Điểm hạnh kiểm" value={summaryScore} color={C.secondary} />
            <StatBox label="Sự kiện tích cực" value={summary?.meritCount || 0} color={C.success} />
            <StatBox label="Vi phạm" value={summary?.violationCount || 0} color={C.error} />
            <StatBox label="Tổng bản ghi" value={summary?.totalRecords || 0} color={C.orange} />
          </div>

          {/* Tabs */}
          <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setActiveTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
                style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="text-[18px]!" /><span>{label}</span>
              </button>
            ))}
          </div>

          {activeTab === "overview" && <OverviewTab records={records} conduct={conduct} />}
          {activeTab === "analytics" && <AnalyticsTab records={records} />}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentBehaviour;
