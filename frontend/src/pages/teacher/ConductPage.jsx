import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import ConductEvaluationModal from "../../components/organisms/ConductEvaluationModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useBehaviourAnalytics } from "../../hooks/useBehaviourAnalytics";
import { useBehaviourMeta } from "../../hooks/useBehaviourMeta";
import { useBehaviourRecords } from "../../hooks/useBehaviourRecords";

const C = {
  onSurface: "#1A1C1C",
  muted: "#584238",
  border: "#DFC0B2",
  orange: "#F27123",
  secondary: "#225DAD",
  deepBlue: "#00458E",
  tertiary: "#4A5F82",
  error: "#BA1A1A",
  success: "#15803D",
  surfaceLow: "#F3F3F3",
  surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style, fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        ...(fill ? { fontVariationSettings: "'FILL' 1" } : {}),
        ...style,
      }}
    >
      {name}
    </span>
  );
}
function initials(n) {
  const p = (n || "").trim().split(/\s+/);
  return p.length
    ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase()
    : "?";
}

const TABS = [
  { key: "list", label: "Danh sách đánh giá", ms: "checklist" },
  { key: "analytics", label: "Phân tích", ms: "insights" },
];
const GRADE_COLOR = {
  TOT: "#15803D",
  KHA: "#00458E",
  TB: "#B45309",
  YEU: "#BA1A1A",
  NA: "#64748B",
};
const GRADE_BADGE = {
  TOT: { bg: "#DCFCE7", text: "#15803D" },
  KHA: { bg: "#EBF3FF", text: "#225DAD" },
  TB: { bg: "#FEF3C7", text: "#B45309" },
  YEU: { bg: "#FFDAD6", text: "#93000A" },
  NA: { bg: "#F1F5F9", text: "#475569" },
};
const AVA = ["#00458E", "#225DAD", "#4A5F82", "#F27123"];
const selectCls =
  "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selStyle = { borderColor: C.border, color: C.onSurface };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

function ConductPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const activeTab = sp.get("tab") || "list";
  const { data: meta, loading: metaLoading } = useBehaviourMeta();

  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [evalStudent, setEvalStudent] = useState(null);

  const classes = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const effClassId =
    classId || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId =
    semesterId ||
    (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const sem = semesters.find((s) => String(s.semesterId) === effSemesterId);

  const {
    data: analytics,
    loading,
    error,
  } = useBehaviourAnalytics(
    effClassId,
    effSemesterId,
    Boolean(effClassId && effSemesterId),
    refresh,
  );
  const violFilters = useMemo(
    () => ({
      classId: effClassId,
      behaviorType: "VIOLATION",
      startDate: sem?.startDate,
      endDate: sem?.endDate,
      page: 1,
      limit: 300,
      _rk: refresh,
    }),
    [effClassId, sem, refresh],
  );
  const { data: violData } = useBehaviourRecords(
    violFilters,
    Boolean(effClassId),
  );

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(
        r.roleName,
      ),
    );
    return {
      name: user?.fullName ?? user?.username ?? "Giáo viên",
      role: roleEntry?.description ?? "Giáo viên",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  const students = analytics?.students ?? [];
  const total = students.length;
  const totalViolations = students.reduce(
    (a, s) => a + (s.violationCount ?? 0),
    0,
  );
  const totGood = students.filter((s) => s.grade?.key === "TOT").length;
  const atRisk = students.filter((s) => (s.violationCount ?? 0) >= 2).length;

  function setTab(k) {
    setSp({ tab: k });
  }
  function bump() {
    setRefresh((k) => k + 1);
  }

  function exportCsv() {
    const head = [
      "Học sinh",
      "Mã",
      "Điểm rèn luyện",
      "Số vi phạm",
      "Xếp loại hạnh kiểm",
    ];
    const rows = students.map((s) => [
      s.studentName,
      s.studentCode,
      s.finalScore,
      s.violationCount ?? 0,
      s.grade?.label ?? "",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(
      new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `hanh-kiem-${effClassId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={
        classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"
      }
    >
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : (
        meta &&
        (classes.length === 0 ? (
          <div
            className="rounded-3xl px-4 py-3 text-sm"
            style={{
              border: `1px solid ${C.border}`,
              backgroundColor: C.surfaceLow,
              color: C.onSurface,
            }}
          >
            Bạn chưa phụ trách lớp nào.
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h1
                className="text-2xl font-extrabold tracking-tight sm:text-3xl"
                style={{ color: C.onSurface }}
              >
                Quản lý hạnh kiểm
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <PrettySelect
                  value={effClassId}
                  onChange={(e) => setClassId(e.target.value)}
                  className={selectCls}
                  style={selStyle}
                >
                  {classes.map((c) => (
                    <option key={c.classId} value={c.classId}>
                      {c.className}
                    </option>
                  ))}
                </PrettySelect>
                <PrettySelect
                  value={effSemesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  className={selectCls}
                  style={selStyle}
                >
                  {semesters.map((s) => (
                    <option key={s.semesterId} value={s.semesterId}>
                      {s.semesterName} · {s.schoolYearName}
                    </option>
                  ))}
                </PrettySelect>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium hover:bg-[#F3F3F3]"
                  style={{ borderColor: C.border, color: C.onSurface }}
                >
                  <Ms name="file_download" className="!text-[18px]" /> Xuất báo
                  cáo
                </button>
                <button
                  type="button"
                  onClick={() => students[0] && setEvalStudent(students[0])}
                  className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95"
                  style={{ backgroundColor: C.orange }}
                >
                  <Ms name="bolt" className="!text-[18px]" /> Đánh giá nhanh
                </button>
              </div>
            </div>

            {/* Tabs — dạng pill bo tròn, di chuyển trong thẻ (giống trang Điểm số) */}
            <div
              className="mb-6 flex w-fit items-center gap-1 rounded-full border p-1"
              style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}
            >
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
                  style={
                    activeTab === t.key
                      ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 }
                      : { color: C.muted, fontWeight: 500 }
                  }
                >
                  <Ms name={t.ms} className="!text-[18px]" />
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            {loading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[0, 1, 2].map((n) => (
                  <div
                    key={n}
                    className="h-28 animate-pulse rounded-3xl bg-slate-200/60"
                  />
                ))}
              </div>
            )}
            {error && (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {!loading && !error && analytics && activeTab === "list" && (
              <ListTab
                students={students}
                total={total}
                totalViolations={totalViolations}
                totGood={totGood}
                avgConduct={analytics.summary?.avgConduct}
                onEval={setEvalStudent}
              />
            )}
            {!loading && !error && analytics && activeTab === "analytics" && (
              <AnalyticsTab
                analytics={analytics}
                students={students}
                total={total}
                totGood={totGood}
                atRisk={atRisk}
                totalViolations={totalViolations}
                violRecords={violData?.items ?? []}
                violCats={meta.violationCategories ?? []}
                onOpenStudent={(id) =>
                  navigate(
                    `/teacher/behaviour/students/${id}?semesterId=${effSemesterId}`,
                  )
                }
              />
            )}
          </>
        ))
      )}

      {evalStudent && (
        <ConductEvaluationModal
          student={evalStudent}
          semesterId={Number(effSemesterId)}
          onClose={() => setEvalStudent(null)}
          onSaved={() => {
            setEvalStudent(null);
            bump();
          }}
        />
      )}
    </DashboardShell>
  );
}

// ─── Danh sách đánh giá ───────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color, iconBg }) {
  return (
    <div
      className="flex items-center justify-between rounded-3xl bg-white p-5 shadow-sm"
      style={{ border: `1px solid ${C.border}` }}
    >
      <div>
        <p
          className="mb-1 text-[11px] font-bold uppercase tracking-wider"
          style={{ color: C.muted }}
        >
          {label}
        </p>
        <p className="text-3xl font-extrabold leading-none" style={{ color }}>
          {value}
        </p>
        {sub && (
          <p
            className="mt-1.5 flex items-center gap-1 text-xs"
            style={{ color: C.muted }}
          >
            {sub}
          </p>
        )}
      </div>
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: iconBg, color }}
      >
        <Ms name={icon} />
      </div>
    </div>
  );
}
function ListTab({
  students,
  total,
  totalViolations,
  totGood,
  avgConduct,
  onEval,
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Điểm rèn luyện TB"
          value={avgConduct ?? "—"}
          sub={
            <>
              <Ms name="verified" className="!text-[14px]" /> {total} học sinh
            </>
          }
          icon="workspace_premium"
          color={C.orange}
          iconBg="rgba(242,113,35,0.1)"
        />
        <StatCard
          label="Tổng số vi phạm"
          value={totalViolations}
          sub={
            <>
              <Ms name="warning" className="!text-[14px]" /> {total} học sinh
            </>
          }
          icon="report"
          color={C.error}
          iconBg="rgba(186,26,26,0.1)"
        />
        <StatCard
          label="Xếp loại Tốt"
          value={totGood}
          sub={
            <>
              <Ms name="check_circle" className="!text-[14px]" />{" "}
              {total ? Math.round((totGood / total) * 1000) / 10 : 0}% tổng lớp
            </>
          }
          icon="military_tech"
          color={C.success}
          iconBg="rgba(21,128,61,0.1)"
        />
      </div>

      <div
        className="overflow-hidden rounded-3xl bg-white shadow-sm"
        style={{ border: `1px solid ${C.border}` }}
      >
        <div
          className="flex items-center justify-between border-b p-5"
          style={{ borderColor: C.border }}
        >
          <h3 className="font-bold" style={{ color: C.onSurface }}>
            Đánh giá chi tiết học sinh
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead
              className="text-white"
              style={{ backgroundColor: C.deepBlue }}
            >
              <tr className="text-left">
                <th className={TH}>Học sinh</th>
                <th className={`${TH} text-center`}>Điểm rèn luyện</th>
                <th className={`${TH} text-center`}>Vi phạm</th>
                <th className={`${TH} text-center`}>Hạnh kiểm</th>
                <th className={`${TH} text-center`}>Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {students.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-slate-400"
                  >
                    Chưa có dữ liệu hạnh kiểm.
                  </td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const gb = GRADE_BADGE[s.grade?.key] ?? GRADE_BADGE.NA;
                  return (
                    <tr
                      key={s.studentId}
                      className="transition-colors hover:bg-[#F3F3F3]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white"
                            style={{ backgroundColor: AVA[i % AVA.length] }}
                          >
                            {s.studentAvatar ? (
                              <img
                                src={s.studentAvatar}
                                alt={s.studentName}
                                className="h-9 w-9 rounded-full object-cover"
                              />
                            ) : (
                              initials(s.studentName)
                            )}
                          </div>
                          <div>
                            <div
                              className="text-sm font-medium"
                              style={{ color: C.onSurface }}
                            >
                              {s.studentName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {s.studentCode}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(s.finalScore, 100)}%`,
                                backgroundColor:
                                  GRADE_COLOR[s.grade?.key] ?? C.orange,
                              }}
                            />
                          </div>
                          <span
                            className="w-8 text-right text-sm font-bold"
                            style={{ color: C.onSurface }}
                          >
                            {s.finalScore}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(s.violationCount ?? 0) === 0 ? (
                          <span className="text-slate-400">0</span>
                        ) : (
                          <span
                            className="rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              backgroundColor: "rgba(186,26,26,0.1)",
                              color: C.error,
                            }}
                          >
                            {s.violationCount}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-bold"
                          style={{ backgroundColor: gb.bg, color: gb.text }}
                        >
                          {s.grade?.label ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onEval(s)}
                          title="Đánh giá"
                          className="rounded-full p-2 transition-colors hover:bg-[#F27123]/10"
                          style={{ color: C.orange }}
                        >
                          <Ms name="edit" className="!text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Phân tích ────────────────────────────────────────────────────────────────
function Ring({ pct, label, sub }) {
  const R = 34,
    cx = 44,
    cy = 44,
    Circ = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-4">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke="#F1F5F9"
          strokeWidth="9"
        />
        <circle
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={C.orange}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * Circ} ${Circ}`}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="16"
          fontWeight="800"
          fill={C.onSurface}
        >
          {pct}%
        </text>
      </svg>
      <div>
        <p className="text-2xl font-extrabold" style={{ color: C.onSurface }}>
          {label}
        </p>
        {sub}
      </div>
    </div>
  );
}
function AnalyticsTab({
  analytics,
  students,
  total,
  totGood,
  atRisk,
  totalViolations,
  violRecords,
  violCats,
  onOpenStudent,
}) {
  const dist = analytics.distribution ?? [];
  const goodKha = students.filter((s) =>
    ["TOT", "KHA"].includes(s.grade?.key),
  ).length;
  const goodKhaPct = total ? Math.round((goodKha / total) * 100) : 0;
  const trend = analytics.trend ?? [];
  const trendDelta =
    trend.length >= 2
      ? (trend[trend.length - 2].demerit ?? 0) -
        (trend[trend.length - 1].demerit ?? 0)
      : null;
  const distMax = Math.max(...dist.map((d) => d.count), 1);

  const catMap = useMemo(
    () => Object.fromEntries((violCats ?? []).map((c) => [c.key, c.label])),
    [violCats],
  );
  const violByCat = useMemo(() => {
    const m = {};
    for (const r of violRecords) {
      const k = r.category ?? "OTHER";
      m[k] = (m[k] ?? 0) + 1;
    }
    const arr = Object.entries(m)
      .map(([k, count]) => ({ label: catMap[k] ?? "Khác", count }))
      .sort((a, b) => b.count - a.count);
    return arr;
  }, [violRecords, catMap]);
  const violTotal = violByCat.reduce((a, c) => a + c.count, 0);
  const catColors = [C.orange, C.secondary, C.tertiary, "#94A3B8"];

  const distColorByLabel = (label) =>
    label.includes("Tốt")
      ? C.success
      : label.includes("Khá")
        ? C.secondary
        : label.includes("Đạt") || label.includes("bình")
          ? C.tertiary
          : C.error;

  return (
    <div className="space-y-6">
      {/* Stat row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div
          className="rounded-3xl bg-white p-5 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          <p
            className="mb-2 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Tỷ lệ Tốt/Khá
          </p>
          <Ring
            pct={goodKhaPct}
            label={`${goodKha}/${total}`}
            sub={
              <p className="text-xs" style={{ color: C.muted }}>
                học sinh xếp loại Tốt/Khá
              </p>
            }
          />
        </div>
        <div
          className="rounded-3xl bg-white p-5 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          <p
            className="mb-1 text-[11px] font-bold uppercase tracking-wider"
            style={{ color: C.muted }}
          >
            Xu hướng vi phạm
          </p>
          <div className="flex items-end justify-between">
            <div>
              <p
                className="text-3xl font-extrabold"
                style={{ color: C.onSurface }}
              >
                {totalViolations}
              </p>
              {trendDelta != null && (
                <p
                  className="text-xs"
                  style={{ color: trendDelta >= 0 ? C.success : C.error }}
                >
                  {trendDelta >= 0
                    ? `Giảm ${trendDelta}`
                    : `Tăng ${-trendDelta}`}{" "}
                  vụ so kỳ trước
                </p>
              )}
            </div>
            <div className="flex h-12 items-end gap-1">
              {trend.slice(-4).map((t, i) => {
                const mx = Math.max(
                  ...trend.map((x) => Math.abs(x.demerit ?? 0)),
                  1,
                );
                return (
                  <span
                    key={i}
                    className="w-3 rounded-t"
                    style={{
                      height: `${Math.max((Math.abs(t.demerit ?? 0) / mx) * 100, 8)}%`,
                      backgroundColor:
                        i === trend.slice(-4).length - 1
                          ? C.orange
                          : C.surfaceHigh,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-4 rounded-3xl bg-white p-5 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          <div
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: "rgba(186,26,26,0.1)", color: C.error }}
          >
            <Ms name="priority_high" />
          </div>
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: C.muted }}
            >
              Học sinh cần lưu ý
            </p>
            <p className="text-3xl font-extrabold" style={{ color: C.error }}>
              {String(atRisk).padStart(2, "0")}
            </p>
            <p className="text-xs" style={{ color: C.muted }}>
              ≥ 2 lỗi trong kỳ
            </p>
          </div>
        </div>
      </div>

      {/* Distribution bars */}
      <div
        className="rounded-3xl bg-white p-5 shadow-sm"
        style={{ border: `1px solid ${C.border}` }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold" style={{ color: C.onSurface }}>
            Phân bố xếp loại hạnh kiểm
          </h3>
          <div className="flex gap-3 text-xs" style={{ color: C.muted }}>
            <span className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: C.success }}
              />{" "}
              Tốt
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: C.secondary }}
              />{" "}
              Khá
            </span>
            <span className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: C.tertiary }}
              />{" "}
              Đạt/TB
            </span>
          </div>
        </div>
        {dist.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Chưa có dữ liệu.
          </p>
        ) : (
          <div
            className="flex items-end justify-around gap-4"
            style={{ height: 180 }}
          >
            {dist.map((d) => (
              <div
                key={d.key ?? d.label}
                className="flex h-full flex-1 flex-col items-center justify-end"
              >
                <span
                  className="mb-1 text-sm font-bold"
                  style={{ color: C.onSurface }}
                >
                  {d.count}
                </span>
                <div
                  className="w-full max-w-[64px] rounded-t-lg"
                  style={{
                    height: `${(d.count / distMax) * 130 + 4}px`,
                    backgroundColor: distColorByLabel(d.label),
                  }}
                />
                <span
                  className="mt-2 text-center text-[11px]"
                  style={{ color: C.muted }}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top positive */}
        <div
          className="rounded-3xl bg-white p-5 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          <h3
            className="mb-4 flex items-center gap-2 font-bold"
            style={{ color: C.onSurface }}
          >
            <Ms name="emoji_events" style={{ color: C.orange }} fill /> Top học
            sinh tích cực
          </h3>
          {(analytics.topPositive ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
          ) : (
            <div className="space-y-3">
              {analytics.topPositive.map((s, i) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => onOpenStudent(s.studentId)}
                  className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-colors hover:border-[#F27123]"
                  style={{ borderColor: C.border }}
                >
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: AVA[i % AVA.length] }}
                  >
                    {initials(s.studentName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-bold"
                      style={{ color: C.onSurface }}
                    >
                      {s.studentName}
                    </p>
                    <p className="text-xs" style={{ color: C.success }}>
                      +{s.meritPoints} điểm rèn luyện
                    </p>
                  </div>
                  <Ms name="chevron_right" className="text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Violation categories */}
        <div
          className="rounded-3xl bg-white p-5 shadow-sm"
          style={{ border: `1px solid ${C.border}` }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3
              className="flex items-center gap-2 font-bold"
              style={{ color: C.onSurface }}
            >
              <Ms name="pie_chart" style={{ color: C.error }} /> Phân loại vi
              phạm phổ biến
            </h3>
            <span className="text-xs" style={{ color: C.muted }}>
              Tổng: {violTotal} lỗi
            </span>
          </div>
          {violByCat.length === 0 ? (
            <p className="text-sm text-slate-400">Không có vi phạm nào.</p>
          ) : (
            <div className="space-y-3">
              {violByCat.slice(0, 5).map((c, i) => {
                const pct = violTotal
                  ? Math.round((c.count / violTotal) * 100)
                  : 0;
                return (
                  <div key={c.label}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span style={{ color: C.onSurface }}>{c.label}</span>
                      <span className="font-bold" style={{ color: C.muted }}>
                        {c.count} vụ ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: catColors[i % catColors.length],
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ConductPage;
