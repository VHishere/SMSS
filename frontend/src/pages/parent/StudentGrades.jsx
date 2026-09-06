import {
  Fragment,
  useCallback,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import LessonFeedbackCard from "../../components/organisms/LessonFeedbackCard";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentStudentGrades } from "../../hooks/useParentStudentGrades";
import { getCurrentSchoolYearLabel } from "../../utils/formatters";
import { parentApi } from "../../api/client";
import PrettySelect from "../../components/molecules/PrettySelect";

// ─── FSchool Stitch design tokens (matches the teacher academic portal) ──────

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surface: "#F9F9F9", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};

function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?";
}

function band(avg) {
  const value = Number(avg);
  if (avg == null || Number.isNaN(value)) return null;
  if (value >= 8) return { label: "GIỎI", bg: "#DCFCE7", text: "#15803D" };
  if (value >= 6.5) return { label: "KHÁ", bg: "#EBF3FF", text: "#225DAD" };
  if (value >= 5) return { label: "TRUNG BÌNH", bg: "#FEF3C7", text: "#B45309" };
  if (value >= 3.5) return { label: "YẾU", bg: "#FFEDD5", text: "#C2410C" };
  return { label: "KÉM", bg: "#FFDAD6", text: "#93000A" };
}

const selectCls = "cursor-pointer rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selectStyle = { borderColor: C.border, color: C.onSurface };
const THEAD = "text-white";
const THEAD_STYLE = { backgroundColor: C.deepBlue };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

// ─── Charts (ported from the teacher academic portal) ─────────────────────────

function BarChart({ items, color = C.orange }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>;
  const bw = 46, gap = 26, padTop = 16, chartH = 150, baseY = padTop + chartH, padL = 30, padB = 26;
  const W = padL + items.length * (bw + gap) + gap;
  const H = baseY + padB;
  const y = (v) => padTop + (1 - Math.min(v, 10) / 10) * chartH;
  const colorFor = (i) => [C.orange, C.secondary, C.tertiary, C.deepBlue][i % 4];
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 5, 10].map((g) => <g key={g}><line x1={padL} y1={y(g)} x2={W - gap} y2={y(g)} stroke="#EEEEEE" /><text x={padL - 6} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}</text></g>)}
        {items.map((it, i) => {
          const x = padL + gap + i * (bw + gap);
          const h = baseY - y(it.value);
          return (
            <g key={it.label}>
              <rect x={x} y={y(it.value)} width={bw} height={Math.max(h, 1)} rx="6" fill={color === "cycle" ? colorFor(i) : color} />
              <text x={x + bw / 2} y={y(it.value) - 5} fontSize="10" fontWeight="700" fill={C.onSurface} textAnchor="middle">{it.value}</text>
              <text x={x + bw / 2} y={baseY + 16} fontSize="9" fill="#64748B" textAnchor="middle">{it.label.length > 8 ? it.label.slice(0, 7) + "…" : it.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Donut({ segments, total, centerLabel }) {
  const R = 52, cx = 70, cy = 70, Circ = 2 * Math.PI * R;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {segments.map((s, i) => {
          const before = segments.slice(0, i).reduce((a, x) => a + x.count, 0);
          const len = total > 0 ? (s.count / total) * Circ : 0;
          const off = total > 0 ? -(before / total) * Circ : 0;
          return len > 0 ? <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth="16" strokeDasharray={`${len} ${Circ}`} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`} /> : null;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill={C.onSurface}>{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fill="#64748B">{centerLabel}</text>
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

function AreaChart({ points }) {
  if (!points.length) return <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>;
  const stepX = 120, padX = 36, padTop = 16, chartH = 140, padB = 28;
  const n = points.length, maxV = Math.max(...points.map((p) => p.count), 1);
  const W = padX * 2 + Math.max(1, n - 1) * stepX, H = padTop + chartH + padB, baseY = padTop + chartH;
  const x = (i) => padX + i * stepX, y = (v) => padTop + (1 - v / maxV) * chartH;
  const line = points.map((p, i) => `${x(i)},${y(p.count)}`).join(" ");
  const area = `M ${x(0)},${baseY} ${points.map((p, i) => `L ${x(i)},${y(p.count)}`).join(" ")} L ${x(n - 1)},${baseY} Z`;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        <path d={area} fill="rgba(34,93,173,0.12)" />
        <polyline points={line} fill="none" stroke={C.secondary} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.label}>
            <circle cx={x(i)} cy={y(p.count)} r="4" fill="#fff" stroke={C.secondary} strokeWidth="2.5" />
            <text x={x(i)} y={y(p.count) - 10} fontSize="10" fontWeight="700" fill={C.onSurface} textAnchor="middle">{p.count}</text>
            <text x={x(i)} y={baseY + 16} fontSize="8.5" fill="#64748B" textAnchor="middle">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function StatCard({ label, value, delta, sub, color }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
        {delta != null && <span className="mb-0.5 flex items-center gap-0.5 text-xs font-bold" style={{ color: delta >= 0 ? C.success : C.error }}><Ms name={delta >= 0 ? "trending_up" : "trending_down"} className="text-[14px]!" />{delta >= 0 ? "+" : ""}{delta}</span>}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Grade-history business logic (parent-specific: multi-year, TX1-3/1 tiết/cuối kỳ) ──

const EXTRA_SUBJECTS = [
  { subjectId: "extra-self-management", subjectName: "Quản lý bản thân", subjectCode: "QLBT" },
  { subjectId: "extra-self-education", subjectName: "Giáo dục bản thân", subjectCode: "GDBT" },
  { subjectId: "extra-stem", subjectName: "STEM", subjectCode: "STEM" },
  { subjectId: "extra-vovinam", subjectName: "Vovinam", subjectCode: "VOVINAM" },
];

const SCORE_SLOTS = [
  { key: "tx1", label: "Miệng", weight: 1 },
  { key: "tx2", label: "15 phút", weight: 1 },
  { key: "tx3", label: "15 phút", weight: 1 },
  { key: "onePeriod", label: "Giữa kỳ", weight: 2 },
  { key: "final", label: "Cuối kỳ", weight: 3 },
];

const SUBJECT_ORDER = [
  "toan", "ngu van", "tieng anh", "tin hoc", "vat ly", "hoa hoc", "sinh hoc",
  "lich su", "dia ly", "giao duc cong dan", "cong nghe",
  "quan ly ban than", "giao duc ban than", "stem", "vovinam",
];

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function normalizeCode(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function getYearKey(item) {
  if (item?.schoolYearId) return `year-${item.schoolYearId}`;
  return `year-${normalizeCode(item?.schoolYearName)}`;
}

function getSemesterKey(item) {
  if (item?.semesterId) return `semester-${item.semesterId}`;
  return `semester-${normalizeCode(item?.semesterName)}`;
}

function getSubjectKey(item) {
  if (item?.subjectId) return `subject-${item.subjectId}`;
  return `subject-${normalizeCode(item?.subjectName || item?.subjectCode)}`;
}

function dateValue(value) {
  const result = new Date(value || "").getTime();
  return Number.isNaN(result) ? 0 : result;
}

function isExtraSubject(subjectName) {
  const normalizedName = normalizeText(subjectName);
  return EXTRA_SUBJECTS.some((subject) => normalizeText(subject.subjectName) === normalizedName);
}

function subjectSortIndex(subjectName) {
  const normalizedName = normalizeText(subjectName);
  const index = SUBJECT_ORDER.indexOf(normalizedName);
  return index === -1 ? 999 : index;
}

function sortSubjects(subjects) {
  return [...subjects].sort((first, second) => {
    const firstExtra = first.isExtra ? 1 : 0;
    const secondExtra = second.isExtra ? 1 : 0;
    if (firstExtra !== secondExtra) return firstExtra - secondExtra;
    const firstIndex = subjectSortIndex(first.subjectName);
    const secondIndex = subjectSortIndex(second.subjectName);
    if (firstIndex !== secondIndex) return firstIndex - secondIndex;
    return first.subjectName.localeCompare(second.subjectName);
  });
}

function mergeSubjectCatalog(subjects = []) {
  const subjectMap = new Map();
  subjects.forEach((subject) => {
    const key = normalizeText(subject.subjectName);
    if (key && !subjectMap.has(key)) subjectMap.set(key, subject);
  });
  EXTRA_SUBJECTS.forEach((subject) => {
    const key = normalizeText(subject.subjectName);
    if (!subjectMap.has(key)) subjectMap.set(key, subject);
  });
  return Array.from(subjectMap.values());
}

function formatScore(score) {
  if (score === null || score === undefined || score === "") return "--";
  const numberValue = Number(score);
  if (Number.isNaN(numberValue)) return score;
  return Number.isInteger(numberValue) ? String(numberValue) : numberValue.toFixed(1);
}

function scoreColor(score) {
  const value = Number(score);
  if (Number.isNaN(value)) return "bg-slate-100 text-slate-500";
  if (value >= 8) return "bg-green-50 text-green-700";
  if (value >= 6.5) return "bg-blue-50 text-[#225DAD]";
  if (value >= 5) return "bg-amber-50 text-amber-700";
  return "bg-red-50 text-red-600";
}

function detectScoreSlot(scoreType) {
  const type = normalizeCode(scoreType).toUpperCase();
  if (["TX1", "REGULAR_1", "FREQUENT_1", "THUONG_XUYEN_1"].includes(type)) return "tx1";
  if (["TX2", "REGULAR_2", "FREQUENT_2", "THUONG_XUYEN_2"].includes(type)) return "tx2";
  if (["TX3", "REGULAR_3", "FREQUENT_3", "THUONG_XUYEN_3"].includes(type)) return "tx3";
  if (["ONE_PERIOD", "ONE_PERIOD_TEST", "MOT_TIET", "PERIOD_TEST", "MIDTERM", "MID_TERM"].includes(type)) return "onePeriod";
  if (["FINAL", "FINAL_EXAM", "CUOI_KY", "END_TERM"].includes(type)) return "final";
  return "regular";
}

function getNextRegularSlot(scores) {
  if (!scores.tx1) return "tx1";
  if (!scores.tx2) return "tx2";
  if (!scores.tx3) return "tx3";
  return null;
}

function createEmptyScores() {
  return { tx1: null, tx2: null, tx3: null, onePeriod: null, final: null };
}

function createSubjectRow(subject) {
  return {
    subjectKey: getSubjectKey(subject),
    subjectId: subject.subjectId,
    subjectName: subject.subjectName,
    subjectCode: subject.subjectCode,
    isExtra: isExtraSubject(subject.subjectName),
    scores: createEmptyScores(),
    comments: [],
  };
}

function putGradeIntoSubjectRow(row, grade) {
  const detectedSlot = detectScoreSlot(grade.scoreType);
  let targetSlot = detectedSlot;
  if (detectedSlot === "regular") targetSlot = getNextRegularSlot(row.scores);
  if (!targetSlot) return;
  row.scores[targetSlot] = grade;
  if (grade.comment) row.comments.push(grade.comment);
}

function calculateSubjectAverage(scores) {
  // ĐTB = (ĐĐGtx×1 + Giữa kỳ×2 + Cuối kỳ×3)/6. ĐĐGtx = TRUNG BÌNH các đầu điểm
  // thường xuyên (miệng + 15 phút); mẫu số = tổng hệ số nhóm CÓ điểm.
  const val = (key) => {
    const g = scores[key];
    if (!g || g.scoreValue === null || g.scoreValue === undefined) return null;
    const raw = Number(g.scoreValue);
    const max = Number(g.maxScore ?? 10);
    const n = max > 0 ? (raw / max) * 10 : NaN;
    return Number.isNaN(n) ? null : n;
  };
  const groups = [
    { vals: ["tx1", "tx2", "tx3"].map(val).filter((v) => v !== null), weight: 1 },
    { vals: [val("onePeriod")].filter((v) => v !== null), weight: 2 },
    { vals: [val("final")].filter((v) => v !== null), weight: 3 },
  ];

  let total = 0;
  let totalWeight = 0;
  for (const grp of groups) {
    if (!grp.vals.length) continue;
    const avg = grp.vals.reduce((a, b) => a + b, 0) / grp.vals.length;
    total += avg * grp.weight;
    totalWeight += grp.weight;
  }

  if (totalWeight === 0) return null;
  return Number((total / totalWeight).toFixed(2));
}

function semesterOverallAverage(semester) {
  const avgs = (semester?.subjects ?? [])
    .map((s) => calculateSubjectAverage(s.scores))
    .filter((v) => v != null);
  if (!avgs.length) return null;
  return Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
}

function ensureYear(yearMap, item) {
  const yearKey = getYearKey(item);
  if (!yearMap.has(yearKey)) {
    yearMap.set(yearKey, {
      key: yearKey,
      label: item.schoolYearName || item.yearName || "Năm học",
      startDate: item.schoolYearStartDate || item.startDate || "",
      endDate: item.schoolYearEndDate || item.endDate || "",
      isActive: item.isActive || item.schoolYearIsActive || false,
      semesters: new Map(),
    });
  }
  return yearMap.get(yearKey);
}

function ensureSemester(year, item) {
  const semesterKey = getSemesterKey(item);
  if (!year.semesters.has(semesterKey)) {
    year.semesters.set(semesterKey, {
      key: semesterKey,
      label: item.semesterName || "Học kỳ",
      startDate: item.semesterStartDate || "",
      endDate: item.semesterEndDate || "",
      subjects: new Map(),
    });
  }
  return year.semesters.get(semesterKey);
}

function buildGradeHistory(data) {
  const yearMap = new Map();
  const subjectCatalog = mergeSubjectCatalog(data?.subjects || []);

  (data?.schoolYears || []).forEach((item) => {
    const year = ensureYear(yearMap, item);
    ensureSemester(year, item);
  });

  (data?.grades || []).forEach((grade) => {
    const year = ensureYear(yearMap, grade);
    const semester = ensureSemester(year, grade);
    const subjectKey = getSubjectKey(grade);
    if (!semester.subjects.has(subjectKey)) {
      semester.subjects.set(subjectKey, createSubjectRow({
        subjectId: grade.subjectId, subjectName: grade.subjectName, subjectCode: grade.subjectCode,
      }));
    }
    putGradeIntoSubjectRow(semester.subjects.get(subjectKey), grade);
  });

  yearMap.forEach((year) => {
    year.semesters.forEach((semester) => {
      subjectCatalog.forEach((subject) => {
        const subjectKey = getSubjectKey(subject);
        if (!semester.subjects.has(subjectKey)) semester.subjects.set(subjectKey, createSubjectRow(subject));
      });
    });
  });

  return Array.from(yearMap.values())
    .sort((first, second) => {
      const dateDiff = dateValue(second.startDate) - dateValue(first.startDate);
      if (dateDiff !== 0) return dateDiff;
      return second.label.localeCompare(first.label);
    })
    .map((year) => ({
      ...year,
      semesters: Array.from(year.semesters.values())
        .sort((first, second) => {
          const dateDiff = dateValue(first.startDate) - dateValue(second.startDate);
          if (dateDiff !== 0) return dateDiff;
          return first.label.localeCompare(second.label);
        })
        .map((semester) => ({
          ...semester,
          subjects: sortSubjects(Array.from(semester.subjects.values())),
        })),
    }));
}

// ─── Small display bits ────────────────────────────────────────────────────────

function ScoreCell({ grade }) {
  if (!grade) {
    return (
      <span className="inline-flex min-w-14 items-center justify-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-400">--</span>
    );
  }
  return (
    <span className={`inline-flex min-w-14 items-center justify-center rounded-full px-3 py-1.5 text-sm font-bold ${scoreColor(grade.scoreValue)}`}>
      {formatScore(grade.scoreValue)}
    </span>
  );
}

function SubjectBadge({ isExtra }) {
  if (isExtra) {
    return <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-bold text-purple-700">Môn bổ sung</span>;
  }
  return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-[#225DAD]">Môn học chính</span>;
}

function AverageBadge({ avg }) {
  const b = band(avg);
  if (!b) {
    return <span className="inline-flex min-w-16 items-center justify-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-400">--</span>;
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <span className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1.5 text-sm font-bold ${scoreColor(avg)}`}>{avg}</span>
      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ backgroundColor: b.bg, color: b.text }}>{b.label}</span>
    </div>
  );
}

// ─── Tab 1: Bảng điểm (full score table, mirrors teacher's Gradebook look) ────

function GradeSemesterTable({ semester }) {
  const mainSubjects = semester.subjects.filter((s) => !s.isExtra);
  const extraSubjects = semester.subjects.filter((s) => s.isExtra);
  const sections = [
    { key: "main", title: "Môn học chính", subjects: mainSubjects },
    { key: "extra", title: "Môn bổ sung", subjects: extraSubjects },
  ];

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: C.border }}>
        <h3 className="mb-0 text-base font-bold" style={{ color: C.onSurface }}>{semester.label}</h3>
        <span className="rounded-full px-4 py-2 text-xs font-bold" style={{ backgroundColor: C.surfaceLow, color: C.orange }}>
          {semester.startDate || "?"} - {semester.endDate || "?"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-270">
          <thead className={THEAD} style={THEAD_STYLE}>
            <tr>
              <th className={`${TH} w-65 text-left`}>Môn học</th>
              {SCORE_SLOTS.map((slot) => (
                <th key={slot.key} className={`${TH} text-center`}>
                  <div>{slot.label}</div>
                  <div className="mt-1 text-[10px] font-normal opacity-70">Hệ số {slot.weight}</div>
                </th>
              ))}
              <th className={`${TH} text-center`}>TB môn</th>
              <th className={`${TH} w-60 text-left`}>Nhận xét</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: C.border }}>
            {sections.map((section) => {
              if (section.subjects.length === 0) return null;
              return (
                <Fragment key={section.key}>
                  <tr>
                    <td colSpan={8} className="px-5 py-3 text-xs font-bold uppercase tracking-[0.14em]" style={{ backgroundColor: C.surfaceLow, color: C.orange }}>
                      {section.title}
                    </td>
                  </tr>
                  {section.subjects.map((subject) => {
                    const average = calculateSubjectAverage(subject.scores);
                    const comment = subject.comments.length > 0 ? subject.comments[0] : "Chưa có nhận xét";
                    return (
                      <tr key={`${semester.key}-${subject.subjectKey}`} className="transition-colors hover:bg-[#F3F3F3]">
                        <td className="px-5 py-4">
                          <div className="mb-2 flex flex-wrap items-center gap-2"><SubjectBadge isExtra={subject.isExtra} /></div>
                          <p className="mb-1 text-sm font-bold" style={{ color: C.onSurface }}>{subject.subjectName}</p>
                          <p className="mb-0 text-xs text-slate-500">{subject.subjectCode || "Chưa có mã môn"}</p>
                        </td>
                        {SCORE_SLOTS.map((slot) => (
                          <td key={`${subject.subjectKey}-${slot.key}`} className="px-4 py-4 text-center">
                            <ScoreCell grade={subject.scores[slot.key]} />
                          </td>
                        ))}
                        <td className="px-4 py-4 text-center"><AverageBadge avg={average} /></td>
                        <td className="px-5 py-4 text-sm text-slate-600">{comment}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoresTab({ visibleSemesters }) {
  return (
    <div className="space-y-5">
      {visibleSemesters.length > 0 ? (
        visibleSemesters.map((semester) => <GradeSemesterTable key={semester.key} semester={semester} />)
      ) : (
        <div className="rounded-3xl border border-dashed p-10 text-center text-sm text-slate-400" style={{ borderColor: C.border }}>
          Hiện chưa có dữ liệu điểm cho năm học này.
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Chi tiết (per-subject breakdown + bar chart, mirrors teacher's Detail tab) ──

function DetailTab({ semester, studentName, studentCode, studentAvatar }) {
  if (!semester) {
    return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn học kỳ để xem chi tiết.</div>;
  }

  const rows = semester.subjects.map((s) => ({ ...s, avg: calculateSubjectAverage(s.scores) }));
  const withAvg = rows.filter((r) => r.avg != null);
  const overall = withAvg.length ? Math.round((withAvg.reduce((a, r) => a + r.avg, 0) / withAvg.length) * 100) / 100 : null;
  const strongest = withAvg.length ? withAvg.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const weakest = withAvg.length ? withAvg.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

  if (!rows.length) {
    return <p className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Chưa có dữ liệu điểm trong học kỳ này.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: C.deepBlue }}>
          {studentAvatar ? <img src={studentAvatar} alt={studentName} className="h-11 w-11 rounded-full object-cover" /> : initials(studentName)}
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: C.onSurface }}>{studentName ?? "—"}</h3>
          <p className="text-xs text-slate-400">{studentCode} · ĐTB {overall ?? "—"} · {semester.label}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={THEAD} style={THEAD_STYLE}>
              <tr className="text-left">
                <th className={TH}>Môn học</th>
                {SCORE_SLOTS.map((t) => (
                  <th key={t.key} className={`${TH} text-center`}>{t.label}<br /><span className="text-[9px] opacity-70">HS {t.weight}</span></th>
                ))}
                <th className={`${TH} text-center`}>ĐTB</th>
                <th className={`${TH} text-center`}>Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {rows.map((r) => {
                const b = band(r.avg);
                return (
                  <tr key={r.subjectKey} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-3 font-semibold" style={{ color: C.onSurface }}>{r.subjectName}</td>
                    {SCORE_SLOTS.map((t) => (
                      <td key={t.key} className="px-4 py-3 text-center" style={{ color: C.muted }}>{formatScore(r.scores[t.key]?.scoreValue)}</td>
                    ))}
                    <td className="px-4 py-3 text-center font-bold" style={{ color: C.orange }}>{r.avg ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{b && <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: b.bg, color: b.text }}>{b.label}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>Cách tính điểm trung bình (ĐTB)</h4>
          <div className="space-y-2 text-sm">
            {SCORE_SLOTS.map((t) => (
              <div key={t.key} className="flex items-center justify-between"><span style={{ color: C.muted }}>{t.label}</span><span className="font-bold" style={{ color: C.onSurface }}>Hệ số {t.weight}</span></div>
            ))}
          </div>
          <p className="mt-3 text-[11px] italic" style={{ color: C.muted }}>ĐTB = Σ(điểm × hệ số) / Σ(hệ số) trên thang 10.</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>ĐTB theo môn</h4>
          <BarChart items={withAvg.map((r) => ({ label: r.subjectName, value: r.avg }))} color="cycle" />
        </div>
      </div>

      {strongest && weakest && (
        <div className="rounded-3xl p-5" style={{ backgroundColor: "rgba(34,93,173,0.06)", border: `1px solid ${C.border}` }}>
          <p className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: C.secondary }}><Ms name="lightbulb" className="text-[18px]!" /> Nhận xét (tự động)</p>
          <p className="text-sm" style={{ color: C.onSurface }}>
            {studentName} mạnh nhất ở môn <b>{strongest.subjectName}</b> ({strongest.avg}){strongest.subjectName !== weakest.subjectName && <> và cần cải thiện môn <b>{weakest.subjectName}</b> ({weakest.avg})</>}.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Phân tích (GPA trend across semesters + distribution, mirrors teacher's Analytics tab) ──

const BUCKET_COLOR = { "GIỎI": "#15803D", "KHÁ": "#225DAD", "TRUNG BÌNH": "#B45309", "KHÔNG ĐẠT": "#BA1A1A" };

function AnalyticsTab({ history, focusSemester }) {
  const timeline = useMemo(() => {
    const points = [];
    // Oldest → newest, across every school year already fetched for this student
    [...history].reverse().forEach((year) => {
      year.semesters.forEach((semester) => {
        const avg = semesterOverallAverage(semester);
        if (avg != null) points.push({ label: `${semester.label.replace("Học kỳ ", "HK")} ${year.label}`, value: avg, key: semester.key });
      });
    });
    return points;
  }, [history]);

  const currentAvg = focusSemester ? semesterOverallAverage(focusSemester) : null;
  const currentIdx = timeline.findIndex((p) => p.key === focusSemester?.key);
  const delta = currentIdx > 0 ? Math.round((timeline[currentIdx].value - timeline[currentIdx - 1].value) * 100) / 100 : null;

  const focusRows = (focusSemester?.subjects ?? []).map((s) => ({ ...s, avg: calculateSubjectAverage(s.scores) })).filter((r) => r.avg != null);
  const distMap = { "GIỎI": 0, "KHÁ": 0, "TRUNG BÌNH": 0, "KHÔNG ĐẠT": 0 };
  focusRows.forEach((r) => { const b = band(r.avg); if (b) distMap[b.label] += 1; });
  const distTotal = focusRows.length;
  const gioiKha = distMap["GIỎI"] + distMap["KHÁ"];
  const gioiKhaRate = distTotal ? Math.round((gioiKha / distTotal) * 1000) / 10 : 0;
  const donutSeg = Object.entries(distMap).filter(([, count]) => count > 0).map(([label, count]) => ({ label, count, color: BUCKET_COLOR[label] }));
  const needsImprovement = focusRows.filter((r) => r.avg < 6.5).sort((a, b) => a.avg - b.avg);

  if (!focusSemester) {
    return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn học kỳ để xem phân tích.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={`Điểm TB · ${focusSemester.label}`} value={currentAvg ?? "—"} delta={delta} color={C.orange} />
        <StatCard label="Tỷ lệ khá/giỏi" value={`${gioiKhaRate}%`} sub={`${gioiKha}/${distTotal} môn`} color={C.secondary} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" className="!text-[18px]!" style={{ color: C.secondary }} /> Xu hướng điểm TB qua các học kỳ</h3>
          <p className="mb-3 text-xs text-slate-400">Toàn bộ lịch sử học tập đã ghi nhận</p>
          <AreaChart points={timeline.map((p) => ({ label: p.label, count: p.value }))} />
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="donut_large" className="!text-[18px]!" style={{ color: C.secondary }} /> Phân bố xếp loại · {focusSemester.label}</h3>
          {distTotal > 0 ? <Donut segments={donutSeg} total={distTotal} centerLabel="môn học" /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.error }}><Ms name="priority_high" className="!text-[18px]!" /> Môn cần cải thiện · {focusSemester.label}</h3>
        </div>
        {needsImprovement.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Không có môn nào dưới ngưỡng khá.</p>
        ) : (
          <table className="min-w-full text-sm">
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {needsImprovement.map((r) => (
                <tr key={r.subjectKey} className="transition-colors hover:bg-[#F3F3F3]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}><Ms name="menu_book" className="text-[16px]!" /></div>
                      <div className="text-sm font-medium" style={{ color: C.onSurface }}>{r.subjectName}</div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center"><span className="rounded-full px-2.5 py-1 text-sm font-bold" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}>{r.avg}</span></td>
                  <td className="px-5 py-3 text-right text-slate-500">{band(r.avg)?.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "scores", label: "Bảng điểm", ms: "grade" },
  { key: "detail", label: "Chi tiết", ms: "person_search" },
  { key: "analytics", label: "Phân tích", ms: "insights" },
];

function ParentStudentGrades() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const { students, loading: studentsLoading } = useParentStudents();

  const activeTab = searchParams.get("tab") || "scores";

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

  const { data, loading: gradesLoading, error } = useParentStudentGrades(activeStudentId);
  const loading = studentsLoading || gradesLoading;

  const [selectedYearKey, setSelectedYearKey] = useState("");
  const [selectedSemesterKey, setSelectedSemesterKey] = useState("ALL");

  function setTab(key) { setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("tab", key); return p; }); }

  function selectStudent(id) {
    setSearchParams({ student: id });
    setSelectedYearKey("");
    setSelectedSemesterKey("ALL");
  }

  const headerUser = useMemo(() => {
    const parentRole = user?.roles?.find((role) => role.roleName === "PARENT");
    return { name: user?.fullName || user?.username || "Phụ huynh", role: parentRole?.description || "Phụ huynh", avatar: user?.avatar || "" };
  }, [user]);

  const history = useMemo(() => buildGradeHistory(data), [data]);

  const feedbackFetcher = useCallback(
    () => parentApi.getStudentLessonFeedback(activeStudentId),
    [activeStudentId],
  );

  const yearOptions = useMemo(
    () => history.map((year) => ({ key: year.key, label: year.isActive ? `${year.label} - hiện tại` : year.label })),
    [history],
  );

  const activeYearKey = selectedYearKey || yearOptions[0]?.key || "";
  const selectedYear = useMemo(() => history.find((year) => year.key === activeYearKey), [history, activeYearKey]);

  const semesterOptions = useMemo(() => {
    const semesters = selectedYear?.semesters || [];
    return [{ key: "ALL", label: "Tất cả học kỳ" }, ...semesters.map((s) => ({ key: s.key, label: s.label }))];
  }, [selectedYear]);

  const visibleSemesters = useMemo(() => {
    if (!selectedYear) return [];
    if (selectedSemesterKey === "ALL") return selectedYear.semesters;
    return selectedYear.semesters.filter((s) => s.key === selectedSemesterKey);
  }, [selectedYear, selectedSemesterKey]);

  // "Chi tiết" / "Phân tích" need one concrete semester: the selected one, or the most recent in the selected year
  const focusSemester = useMemo(() => {
    if (!selectedYear?.semesters?.length) return null;
    if (selectedSemesterKey !== "ALL") return selectedYear.semesters.find((s) => s.key === selectedSemesterKey) ?? null;
    // Default to the most recent semester that actually has grades; fall back to the latest one otherwise.
    const withData = [...selectedYear.semesters].reverse().find((s) => semesterOverallAverage(s) != null);
    return withData ?? selectedYear.semesters[selectedYear.semesters.length - 1];
  }, [selectedYear, selectedSemesterKey]);

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.PARENT}
      sidebarFooterLabel="Năm học hiện tại"
      sidebarFooterValue={getCurrentSchoolYearLabel(students)}
    >
      {loading && <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />}

      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-600">
          Không tải được bảng điểm: {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>
              Bảng điểm
            </h2>

            <div className="flex flex-wrap items-end gap-2">
              {students.length > 1 && (
                <PrettySelect value={activeStudentId ?? ""} onChange={(e) => selectStudent(Number(e.target.value))} className={selectCls} style={selectStyle}>
                  {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentFullName}</option>)}
                </PrettySelect>
              )}
              <PrettySelect
                value={activeYearKey}
                onChange={(e) => { setSelectedYearKey(e.target.value); setSelectedSemesterKey("ALL"); }}
                className={selectCls}
                style={selectStyle}
              >
                {yearOptions.map((y) => <option key={y.key} value={y.key}>{y.label}</option>)}
              </PrettySelect>
              {activeTab !== "analytics" && (
                <PrettySelect value={selectedSemesterKey} onChange={(e) => setSelectedSemesterKey(e.target.value)} className={selectCls} style={selectStyle}>
                  {semesterOptions.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </PrettySelect>
              )}
            </div>
          </div>

          <div className="mb-6 flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="!text-[18px]!" /><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}` }}>
            {activeTab === "scores" && <ScoresTab visibleSemesters={visibleSemesters} />}
            {activeTab === "detail" && (
              <DetailTab
                semester={focusSemester}
                studentName={activeStudent?.studentFullName}
                studentCode={activeStudent?.studentCode}
                studentAvatar={activeStudent?.studentAvatar}
              />
            )}
            {activeTab === "analytics" && <AnalyticsTab history={history} focusSemester={focusSemester} />}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default ParentStudentGrades;
