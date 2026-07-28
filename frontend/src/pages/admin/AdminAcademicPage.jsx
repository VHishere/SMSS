import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { adminApi, staffApi } from "../../api/client";
import StaffPageHeader from "../../components/staff/StaffPageHeader";
import { useAdminAcademicMeta } from "../../hooks/useAdminAcademicMeta";
import { useAdminAcademicAnalytics } from "../../hooks/useAdminAcademicAnalytics";
import { useAdminAcademicWarnings } from "../../hooks/useAdminAcademicWarnings";
import PrettySelect from "../../components/molecules/PrettySelect";

const C = {
  onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", primary: "#9F4200",
  orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", tertiary: "#4A5F82",
  error: "#BA1A1A", success: "#15803D", surfaceLow: "#F3F3F3", surfaceHigh: "#E8E8E8",
};
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
function initials(name) {
  const p = (name || "").trim().split(/\s+/);
  return p.length ? (p.length === 1 ? p[0][0] : p[0][0] + p[p.length - 1][0]).toUpperCase() : "?";
}
const GROUP_WEIGHT = { TX: 1, GK: 2, CK: 3 };
function groupOf(t) {
  if (t.group) return t.group;
  if (t.key === "MIDTERM") return "GK";
  if (t.key === "FINAL") return "CK";
  if (typeof t.key === "string" && t.key.startsWith("TX")) return "TX";
  return null;
}
function weightOf(t) { return GROUP_WEIGHT[groupOf(t)] ?? t.weight ?? 1; }
function cellVal(raw) { const v = raw && typeof raw === "object" ? raw.scoreValue : raw; return v === "" || v == null ? null : Number(v); }
function weightedAvg(scores, scoreTypes) {
  const groupVals = { TX: [], GK: [], CK: [] };
  for (const t of scoreTypes) {
    const g = groupOf(t);
    if (!g || !(g in groupVals)) continue;
    const n = cellVal(scores?.[t.key]);
    if (n == null || !Number.isFinite(n)) continue;
    groupVals[g].push(n);
  }
  let s = 0, sw = 0;
  for (const g of Object.keys(GROUP_WEIGHT)) {
    if (!groupVals[g].length) continue;
    const avg = groupVals[g].reduce((a, b) => a + b, 0) / groupVals[g].length;
    s += avg * GROUP_WEIGHT[g]; sw += GROUP_WEIGHT[g];
  }
  return sw > 0 ? Math.round((s / sw) * 100) / 100 : null;
}
function band(avg) {
  if (avg == null) return null;
  if (avg >= 8) return { label: "GIỎI", bg: "#DCFCE7", text: "#15803D" };
  if (avg >= 6.5) return { label: "KHÁ", bg: "#EBF3FF", text: "#225DAD" };
  if (avg >= 5) return { label: "TRUNG BÌNH", bg: "#FEF3C7", text: "#B45309" };
  return { label: "KHÔNG ĐẠT", bg: "#FFDAD6", text: "#93000A" };
}

const TABS = [
  { key: "scores", label: "Số điểm", ms: "grade" },
  { key: "detail", label: "Chi tiết", ms: "person_search" },
  { key: "analytics", label: "Phân tích", ms: "insights" },
  { key: "warnings", label: "Cảnh báo", ms: "warning" },
];
const WARNING_LABEL = {
  LOW_GPA: { label: "GPA thấp", color: "#B45309" },
  MULTIPLE_FAIL: { label: "Trượt nhiều môn", color: C.error },
  DECLINING: { label: "Sa sút", color: C.orange },
  AT_RISK: { label: "Nguy cơ cao", color: C.error },
};
const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FEF3C7", text: "#B45309" },
  RESOLVED: { label: "Đã xử lý", bg: "#DCFCE7", text: C.success },
};
const BUCKET_COLOR = { "0-3.5": "#BA1A1A", "3.5-5": "#B45309", "5-6.5": "#225DAD", "6.5-8": "#4A5F82", "8-10": "#15803D" };

const selectCls = "rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";
const selectStyle = { borderColor: C.border, color: C.onSurface };
const THEAD_STYLE = { backgroundColor: C.deepBlue };
const TH = "px-4 py-3 text-xs font-medium uppercase tracking-wider";

// ─── Charts ───────────────────────────────────────────────────────────────────
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

// ─── Số điểm (read-only gradebook) ─────────────────────────────────────────────
function GradebookTab({ classId, subjectId, semesterId, scoreTypes, subjectName }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const ready = Boolean(classId && subjectId && semesterId);
  useEffect(() => {
    if (!ready) return;
    let m = true;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      adminApi.getAcademicGradebook({ classId, subjectId, semesterId })
        .then((res) => { if (m) setData(res.data); }).catch((e) => { if (m) setError(e.message); }).finally(() => { if (m) setLoading(false); });
    }, 0);
    return () => { m = false; clearTimeout(timer); };
  }, [classId, subjectId, semesterId, ready]);

  const summary = useMemo(() => {
    if (!data) return null;
    const avgs = data.students.map((s) => weightedAvg(s.scores, scoreTypes)).filter((v) => v != null);
    if (!avgs.length) return null;
    const classAvg = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
    const pass = avgs.filter((v) => v >= 5).length;
    const gioi = avgs.filter((v) => v >= 8).length;
    return { classAvg, passRate: Math.round((pass / avgs.length) * 1000) / 10, gioiRate: Math.round((gioi / avgs.length) * 1000) / 10, count: avgs.length };
  }, [data, scoreTypes]);

  function exportCsv() {
    if (!data) return;
    const head = ["Học sinh", "Mã", ...scoreTypes.map((t) => t.label), "TB môn", "Xếp loại", "Ghi chú"];
    const rows = data.students.map((s) => {
      const avg = weightedAvg(s.scores, scoreTypes);
      return [s.studentName, s.studentCode, ...scoreTypes.map((t) => cellVal(s.scores?.[t.key]) ?? ""), avg ?? "", band(avg)?.label ?? "", s.comment ?? ""];
    });
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `so-diem-${subjectName ?? subjectId}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!ready) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Vui lòng chọn lớp, môn và học kỳ.</div>;
  if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      {summary && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl p-5" style={{ backgroundColor: "rgba(242,113,35,0.08)" }}>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-white" style={{ backgroundColor: C.orange }}><Ms name="calculate" /></div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: C.primary }}>Trung bình môn {subjectName ? `· ${subjectName}` : ""}</p>
              <p className="text-3xl font-extrabold" style={{ color: C.orange }}>{summary.classAvg}</p>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-right"><p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>Tỷ lệ đạt</p><p className="text-lg font-bold" style={{ color: C.success }}>{summary.passRate}%</p></div>
            <div className="text-right"><p className="text-[10px] font-bold uppercase" style={{ color: C.muted }}>Xếp loại giỏi</p><p className="text-lg font-bold" style={{ color: C.secondary }}>{summary.gioiRate}%</p></div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        {data.students.length === 0 ? <p className="p-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-white" style={THEAD_STYLE}>
                <tr className="text-left">
                  <th className={TH}>Họ và tên</th>
                  {scoreTypes.map((t) => <th key={t.key} className={`${TH} whitespace-nowrap text-center`}>{t.label}</th>)}
                  <th className={`${TH} text-center`}>TB môn</th>
                  <th className={TH}>Ghi chú</th>
                  <th className={`${TH} text-center`}>Xếp loại</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: C.border }}>
                {data.students.map((s) => {
                  const avg = weightedAvg(s.scores, scoreTypes);
                  const b = band(avg);
                  return (
                    <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>
                            {s.studentAvatar ? <img src={s.studentAvatar} alt={s.studentName} className="h-8 w-8 rounded-full object-cover" /> : initials(s.studentName)}
                          </div>
                          <div className="min-w-0"><div className="truncate text-sm font-medium" style={{ color: C.onSurface }}>{s.studentName}</div><div className="text-xs text-slate-400">{s.studentCode}</div></div>
                        </div>
                      </td>
                      {scoreTypes.map((t) => <td key={t.key} className="px-3 py-2.5 text-center" style={{ color: C.onSurface }}>{cellVal(s.scores?.[t.key]) ?? "—"}</td>)}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.orange }}>{avg ?? "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-500">{s.comment || "—"}</td>
                      <td className="px-3 py-2.5 text-center">{b && <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: b.bg, color: b.text }}>{b.label}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: C.onSurface }}><Ms name="file_download" className="text-[18px]!" /> Xuất báo cáo</button>
      </div>
    </div>
  );
}

// ─── Chi tiết (per-student breakdown across all subjects) ──────────────────────
function DetailTab({ classId, semesterId, subjectOptions, scoreTypes, onOpenStudent }) {
  const [gradebooks, setGradebooks] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const ready = Boolean(classId && semesterId && subjectOptions.length);
  useEffect(() => {
    if (!ready) return;
    let m = true;
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all(subjectOptions.map((o) =>
        adminApi.getAcademicGradebook({ classId, subjectId: o.id, semesterId }).then((r) => ({ subjectId: o.id, subjectName: o.name, students: r.data.students })).catch(() => null)))
        .then((res) => { if (m) setGradebooks(res.filter(Boolean)); })
        .finally(() => { if (m) setLoading(false); });
    }, 0);
    return () => { m = false; clearTimeout(timer); };
  }, [classId, semesterId, subjectOptions, ready]);

  const roster = useMemo(() => {
    const map = {};
    for (const g of gradebooks ?? []) for (const s of g.students) map[s.studentId] = { studentId: s.studentId, studentName: s.studentName, studentCode: s.studentCode, studentAvatar: s.studentAvatar };
    return Object.values(map).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [gradebooks]);

  const studentId = selectedStudentId && roster.some((s) => String(s.studentId) === String(selectedStudentId))
    ? selectedStudentId
    : String(roster[0]?.studentId || "");

  const rows = useMemo(() => {
    if (!gradebooks || !studentId) return [];
    return gradebooks.map((g) => {
      const st = g.students.find((s) => String(s.studentId) === String(studentId));
      const scores = st?.scores ?? {};
      return { subjectName: g.subjectName, scores, avg: weightedAvg(scores, scoreTypes) };
    });
  }, [gradebooks, studentId, scoreTypes]);

  const student = roster.find((s) => String(s.studentId) === String(studentId));
  const withAvg = rows.filter((r) => r.avg != null);
  const overall = withAvg.length ? Math.round((withAvg.reduce((a, r) => a + r.avg, 0) / withAvg.length) * 100) / 100 : null;

  if (!ready) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn lớp, môn và học kỳ để xem chi tiết.</div>;
  if (loading || !gradebooks) return <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />;
  if (!roster.length) return <p className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Lớp chưa có học sinh có điểm.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {student && <div className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{student.studentAvatar ? <img src={student.studentAvatar} alt={student.studentName} className="h-11 w-11 rounded-full object-cover" /> : initials(student.studentName)}</div>}
          <div>
            <h3 className="text-lg font-bold" style={{ color: C.onSurface }}>{student?.studentName ?? "—"}</h3>
            <p className="text-xs text-slate-400">{student?.studentCode} · ĐTB {overall ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PrettySelect value={studentId} onChange={(e) => setSelectedStudentId(e.target.value)} className={selectCls} style={selectStyle}>
            {roster.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName} ({s.studentCode})</option>)}
          </PrettySelect>
          {onOpenStudent && (
            <button type="button" onClick={() => onOpenStudent(studentId)} className="inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold text-white" style={{ backgroundColor: C.orange }}><Ms name="open_in_new" className="text-[14px]!" /> Hồ sơ đầy đủ</button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-white" style={THEAD_STYLE}>
              <tr className="text-left">
                <th className={TH}>Môn học</th>
                {scoreTypes.map((t) => <th key={t.key} className={`${TH} text-center`}>{t.label}<br /><span className="text-[9px] opacity-70">HS {weightOf(t)}</span></th>)}
                <th className={`${TH} text-center`}>ĐTB</th>
                <th className={`${TH} text-center`}>Xếp loại</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {rows.map((r) => {
                const b = band(r.avg);
                return (
                  <tr key={r.subjectName} className="transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-3 font-semibold" style={{ color: C.onSurface }}>{r.subjectName}</td>
                    {scoreTypes.map((t) => <td key={t.key} className="px-4 py-3 text-center" style={{ color: C.muted }}>{cellVal(r.scores?.[t.key]) ?? "—"}</td>)}
                    <td className="px-4 py-3 text-center font-bold" style={{ color: C.orange }}>{r.avg ?? "—"}</td>
                    <td className="px-4 py-3 text-center">{b && <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: b.bg, color: b.text }}>{b.label}</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>ĐTB theo môn</h4>
        <BarChart items={withAvg.map((r) => ({ label: r.subjectName, value: r.avg }))} color="cycle" />
      </div>
    </div>
  );
}

// ─── Phân tích (Analytics) ──────────────────────────────────────────────────────
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
function AnalyticsTab({ classId, semesterId, onOpenStudent }) {
  const { data, trend, loading, error } = useAdminAcademicAnalytics(classId, semesterId, Boolean(classId && semesterId));
  if (!classId || !semesterId) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn lớp và học kỳ để xem phân tích.</div>;
  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const s = data.summary;
  const dist = data.distribution ?? [];
  const distTotal = dist.reduce((a, d) => a + d.count, 0);
  const gioiKha = dist.filter((d) => ["6.5-8", "8-10"].includes(d.key)).reduce((a, d) => a + d.count, 0);
  const gioiKhaRate = distTotal ? Math.round((gioiKha / distTotal) * 1000) / 10 : 0;
  const pts = (trend ?? []).filter((t) => t.classAverage != null);
  const delta = pts.length >= 2 ? Math.round((pts[pts.length - 1].classAverage - pts[pts.length - 2].classAverage) * 10) / 10 : null;
  const donutSeg = dist.map((d) => ({ label: d.label, count: d.count, color: BUCKET_COLOR[d.key] ?? "#94A3B8" }));
  const atRisk = (data.students ?? []).filter((st) => st.gpa != null && st.gpa < 6.5).slice(-6).reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label="Điểm TB lớp" value={s.classAverage ?? "—"} delta={delta} color={C.orange} />
        <StatCard label="Tỷ lệ khá/giỏi" value={`${gioiKhaRate}%`} sub={`${gioiKha}/${distTotal} học sinh · Đạt ${s.passRate}%`} color={C.secondary} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="bar_chart" className="text-[18px]!" style={{ color: C.orange }} /> So sánh theo môn</h3>
          <BarChart items={(data.subjectPerformance ?? []).map((p) => ({ label: p.subjectName, value: p.average }))} color="cycle" />
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="donut_large" className="text-[18px]!" style={{ color: C.secondary }} /> Phân bố xếp loại</h3>
          {distTotal > 0 ? <Donut segments={donutSeg} total={distTotal} centerLabel="học sinh" /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" className="text-[18px]!" style={{ color: C.secondary }} /> Phổ điểm chi tiết</h3>
        <p className="mb-3 text-xs text-slate-400">Sĩ số {s.totalStudents} · đã có điểm {s.scored}</p>
        <AreaChart points={dist.map((d) => ({ label: d.label, count: d.count }))} />
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.error }}><Ms name="priority_high" className="text-[18px]!" /> Học sinh cần lưu ý</h3>
        </div>
        {atRisk.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">Không có học sinh dưới ngưỡng khá.</p> : (
          <table className="min-w-full text-sm">
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {atRisk.map((st) => (
                <tr key={st.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{initials(st.studentName)}</div>
                      <div><div className="text-sm font-medium" style={{ color: C.onSurface }}>{st.studentName}</div><div className="text-xs text-slate-400">{st.studentCode}</div></div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-center"><span className="rounded-full px-2.5 py-1 text-sm font-bold" style={{ backgroundColor: "#FFDAD6", color: "#93000A" }}>{st.gpa}</span></td>
                  <td className="px-5 py-3 text-center text-slate-500">{st.standing?.label}</td>
                  <td className="px-5 py-3 text-right">
                    <button type="button" onClick={() => onOpenStudent(st.studentId)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: C.orange }}><Ms name="open_in_new" className="text-[13px]!" /> Hồ sơ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Cảnh báo (view-only) ───────────────────────────────────────────────────────
function WarningsTab({ classId, semesterId, onOpenStudent }) {
  const [statusFilter, setStatusFilter] = useState("");
  const filters = useMemo(() => ({ classId, semesterId, status: statusFilter }), [classId, semesterId, statusFilter]);
  const { data, loading, error } = useAdminAcademicWarnings(filters, Boolean(classId && semesterId));

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      high: items.filter((w) => ["AT_RISK", "MULTIPLE_FAIL"].includes(w.warningType)).length,
      declining: items.filter((w) => w.warningType === "DECLINING").length,
      low: items.filter((w) => w.warningType === "LOW_GPA").length,
      total: items.length,
    };
  }, [data]);

  if (!classId || !semesterId) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn lớp và học kỳ để xem cảnh báo.</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Nguy cơ cao", counts.high, C.error, "dangerous"], ["Sa sút", counts.declining, C.orange, "trending_down"], ["GPA thấp", counts.low, "#B45309", "priority_high"], ["Tổng cảnh báo", counts.total, C.secondary, "notifications_active"]].map(([label, val, color, icon]) => (
          <div key={label} className="rounded-3xl bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="mb-1 flex items-center gap-1.5"><Ms name={icon} className="text-[16px]!" style={{ color }} /><p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p></div>
            <p className="text-3xl font-extrabold leading-none" style={{ color }}>{String(val).padStart(2, "0")}</p>
          </div>
        ))}
      </div>

      <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} style={selectStyle}>
        <option value="">Tất cả trạng thái</option>
        <option value="OPEN">Mở</option>
        <option value="IN_PROGRESS">Đang can thiệp</option>
        <option value="RESOLVED">Đã xử lý</option>
      </PrettySelect>

      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Không có cảnh báo nào.</div>
        ) : (
          <div className="space-y-3">
            {data.items.map((w) => {
              const typeCfg = WARNING_LABEL[w.warningType] ?? { label: w.warningType, color: "#64748B" };
              const stCfg = WARNING_STATUS[w.status];
              return (
                <div key={w.warningId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeftWidth: 4, borderLeftColor: typeCfg.color }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: C.deepBlue }}>{w.studentAvatar ? <img src={w.studentAvatar} alt={w.studentName} className="h-10 w-10 rounded-full object-cover" /> : initials(w.studentName)}</div>
                      <div><p className="text-sm font-bold" style={{ color: C.onSurface }}>{w.studentName}</p><p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · GPA {w.gpaSnapshot ?? "—"}</p></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      {stCfg && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>}
                    </div>
                  </div>
                  {w.note && <p className="mt-3 text-sm text-slate-600">{w.note}</p>}
                  {w.intervention && <p className="mt-2 rounded-xl px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: C.surfaceLow }}><span className="font-semibold">Can thiệp: </span>{w.intervention}</p>}
                  <div className="mt-3">
                    <button type="button" onClick={() => onOpenStudent(w.studentId)} className="rounded-full px-4 py-1.5 text-xs font-medium transition" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>Xem hồ sơ</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────
// Read-only admin equivalent of teacher's "Quản lý sổ điểm" — same 4 tabs, but
// admin can pick ANY class/subject/semester (school-wide), and there's no
// score entry, warning generation, or intervention editing.
function AdminAcademicPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "scores";
  const { data: meta, loading: metaLoading, error: metaError } = useAdminAcademicMeta();
  const [subjects, setSubjects] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  useEffect(() => {
    staffApi.getLookups().then((res) => setSubjects(res.data.subjects || [])).catch(() => {});
  }, []);

  const classes = useMemo(() => meta?.classes ?? [], [meta]);
  const semesters = useMemo(() => meta?.semesters ?? [], [meta]);
  const subjectOptions = useMemo(() => subjects.map((s) => ({ id: String(s.subjectId), name: s.subjectName })), [subjects]);

  const classId = selectedClassId || String(classes[0]?.classId || "");
  const subjectId = selectedSubjectId || String(subjectOptions[0]?.id || "");
  const semesterId = selectedSemesterId || String(semesters[0]?.semesterId || "");
  const subjectName = subjectOptions.find((s) => String(s.id) === String(subjectId))?.name;

  function setTab(key) { setSearchParams({ tab: key }); }
  function openStudent(studentId) { navigate(`/admin/students/${studentId}?semesterId=${semesterId}`); }
  const showSubject = activeTab === "scores";

  const filterPicker = !metaLoading && classes.length > 0 && (
    <>
      <PrettySelect value={classId} onChange={(e) => setSelectedClassId(e.target.value)} className={selectCls} style={selectStyle}>
        {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
      </PrettySelect>
      {showSubject && (
        <PrettySelect value={subjectId} onChange={(e) => setSelectedSubjectId(e.target.value)} className={selectCls} style={selectStyle}>
          {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </PrettySelect>
      )}
      <PrettySelect value={semesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} className={selectCls} style={selectStyle}>
        {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
      </PrettySelect>
    </>
  );

  return (
    <>
      <StaffPageHeader title="Điểm số" action={filterPicker} />

      {metaError && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : classes.length === 0 ? (
        <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chưa có lớp học nào trong hệ thống.</div>
      ) : (
        <>
          <div className="mb-6 flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
            {TABS.map(({ key, label, ms }) => (
              <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                <Ms name={ms} className="text-[18px]!" /><span>{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}` }}>
            {activeTab === "scores" && <GradebookTab classId={classId} subjectId={subjectId} semesterId={semesterId} scoreTypes={meta.scoreTypes} subjectName={subjectName} />}
            {activeTab === "detail" && <DetailTab classId={classId} semesterId={semesterId} subjectOptions={subjectOptions} scoreTypes={meta.scoreTypes} onOpenStudent={openStudent} />}
            {activeTab === "analytics" && <AnalyticsTab classId={classId} semesterId={semesterId} onOpenStudent={openStudent} />}
            {activeTab === "warnings" && <WarningsTab classId={classId} semesterId={semesterId} onOpenStudent={openStudent} />}
          </div>
        </>
      )}
    </>
  );
}

export default AdminAcademicPage;
