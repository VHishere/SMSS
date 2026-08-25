import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import WarningInterventionModal from "../../components/organisms/WarningInterventionModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { academicApi } from "../../api/client";
import { useAcademicAnalytics } from "../../hooks/useAcademicAnalytics";
import { useAcademicMeta } from "../../hooks/useAcademicMeta";
import { useAcademicWarnings } from "../../hooks/useAcademicWarnings";

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
// ĐTB môn = (ĐĐGtx×1 + ĐĐGgk×2 + ĐĐGck×3)/6. TX (thường xuyên) là 1 NHÓM: lấy
// TRUNG BÌNH các đầu điểm (miệng + 15 phút) rồi mới nhân hệ số 1. GK×2, CK×3.
// Mẫu số = tổng hệ số các nhóm CÓ điểm (đủ 3 nhóm là /6). Phải KHỚP backend
// gpa.service + parent/student StudentGrades để không lệch giữa các role.
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
  if (avg >= 3.5) return { label: "YẾU", bg: "#FFEDD5", text: "#C2410C" };
  return { label: "KÉM", bg: "#FFDAD6", text: "#93000A" };
}

const TABS = [
  { key: "scores",    label: "Số điểm",  ms: "grade" },
  { key: "detail",    label: "Chi tiết", ms: "person_search" },
  { key: "analytics", label: "Phân tích", ms: "insights" },
  { key: "warnings",  label: "Cảnh báo", ms: "warning" },
];
const WARNING_LABEL = {
  LOW_GPA:       { label: "GPA thấp",        color: "#B45309" },
  MULTIPLE_FAIL: { label: "Trượt nhiều môn", color: C.error },
  DECLINING:     { label: "Sa sút",          color: C.orange },
  AT_RISK:       { label: "Nguy cơ cao",     color: C.error },
};
const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FEF3C7", text: "#B45309" },
  RESOLVED:    { label: "Đã xử lý",        bg: "#DCFCE7", text: C.success },
};
const BUCKET_COLOR = { "0-3.5": "#BA1A1A", "3.5-5": "#B45309", "5-6.5": "#225DAD", "6.5-8": "#4A5F82", "8-10": "#15803D" };

const THEAD = "text-white";
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

// ─── Số điểm (Gradebook) ──────────────────────────────────────────────────────
function createGradeDraft(data, scoreTypes) {
  const draft = {};
  for (const student of data?.students ?? []) {
    const row = { comment: student.comment ?? "" };
    for (const type of scoreTypes) {
      row[type.key] = student.scores?.[type.key]?.scoreValue ?? "";
    }
    draft[student.studentId] = row;
  }
  return draft;
}

function GradebookTab({ classId, subjectId, semesterId, scoreTypes, subjectName }) {
  const [loadState, setLoadState] = useState({ key: "", data: null, error: "" });
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ text: "", isError: false });

  const ready = Boolean(classId && subjectId && semesterId);
  const requestKey = ready ? `${classId}:${subjectId}:${semesterId}:${refreshKey}` : "";
  const data = loadState.key === requestKey ? loadState.data : null;
  const error = loadState.key === requestKey ? loadState.error : "";
  const loading = ready && loadState.key !== requestKey;

  useEffect(() => {
    if (!ready) return;
    let m = true;
    academicApi.getGradebook({ classId, subjectId, semesterId })
      .then((res) => {
        if (!m) return;
        setDraft(createGradeDraft(res.data, scoreTypes));
        setSaveMsg({ text: "", isError: false });
        setLoadState({ key: requestKey, data: res.data, error: "" });
      })
      .catch((e) => {
        if (m) setLoadState({ key: requestKey, data: null, error: e.message });
      });
    return () => { m = false; };
  }, [classId, subjectId, semesterId, scoreTypes, requestKey, ready]);

  function setCell(sid, key, value) { setDraft((p) => ({ ...p, [sid]: { ...p[sid], [key]: value } })); }

  const summary = useMemo(() => {
    const rows = Object.values(draft);
    const avgs = rows.map((r) => weightedAvg(r, scoreTypes)).filter((v) => v != null);
    if (!avgs.length) return null;
    const classAvg = Math.round((avgs.reduce((a, b) => a + b, 0) / avgs.length) * 100) / 100;
    const pass = avgs.filter((v) => v >= 5).length;
    const gioi = avgs.filter((v) => v >= 8).length;
    // Đủ điều kiện ĐĐGtx: ≥1 điểm miệng + 2 điểm 15 phút (chỉ xét HS đã có điểm).
    const oralKeys = scoreTypes.filter((t) => t.kind === "ORAL").map((t) => t.key);
    const quizKeys = scoreTypes.filter((t) => t.kind === "QUIZ_15").map((t) => t.key);
    const hasVal = (r, k) => r[k] !== "" && r[k] != null;
    const incompleteTx = (oralKeys.length || quizKeys.length)
      ? rows.filter((r) => {
          const started = scoreTypes.some((t) => hasVal(r, t.key));
          if (!started) return false;
          const oral = oralKeys.filter((k) => hasVal(r, k)).length;
          const quiz = quizKeys.filter((k) => hasVal(r, k)).length;
          return oral < 1 || quiz < 2;
        }).length
      : 0;
    return { classAvg, passRate: Math.round((pass / avgs.length) * 1000) / 10, gioiRate: Math.round((gioi / avgs.length) * 1000) / 10, count: avgs.length, incompleteTx };
  }, [draft, scoreTypes]);

  async function handleSave() {
    const byType = {};
    for (const sid of Object.keys(draft)) {
      const row = draft[sid];
      for (const t of scoreTypes) {
        const v = row[t.key];
        if (v === "" || v == null) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 10) { setSaveMsg({ text: "Điểm phải trong khoảng 0–10.", isError: true }); return; }
        (byType[t.key] ??= []).push({ studentId: Number(sid), scoreValue: n, comment: row.comment || null });
      }
    }
    const types = Object.keys(byType);
    if (!types.length) { setSaveMsg({ text: "Chưa nhập điểm nào.", isError: true }); return; }
    setSaving(true); setSaveMsg({ text: "", isError: false });
    try {
      let total = 0;
      for (const type of types) { const res = await academicApi.submitScores({ classId, subjectId, semesterId, scoreType: type, maxScore: 10, records: byType[type] }); total += res.data.saved; }
      setSaveMsg({ text: `Đã lưu ${total} điểm.`, isError: false }); setRefreshKey((k) => k + 1);
    } catch (err) { setSaveMsg({ text: err.message, isError: true }); } finally { setSaving(false); }
  }

  function exportCsv() {
    if (!data) return;
    const head = ["Học sinh", "Mã", ...scoreTypes.map((t) => t.label), "TB môn", "Xếp loại", "Ghi chú"];
    const rows = data.students.map((s) => {
      const r = draft[s.studentId] ?? {};
      const avg = weightedAvg(r, scoreTypes);
      return [s.studentName, s.studentCode, ...scoreTypes.map((t) => r[t.key] ?? ""), avg ?? "", band(avg)?.label ?? "", r.comment ?? ""];
    });
    // Chống CSV/formula injection: ô bắt đầu bằng = + - @ (hoặc tab/CR) → prefix ' để Excel coi là text.
    const csvCell = (c) => {
      const s = String(c ?? "");
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return `"${safe.replace(/"/g, '""')}"`;
    };
    const csv = [head, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `so-diem-${subjectName ?? subjectId}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (!ready) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Vui lòng chọn lớp, môn và học kỳ.</div>;
  if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;
  const inputCls = "w-16 rounded-xl border px-2 py-1.5 text-center text-sm outline-none focus:ring-1 focus:ring-[#9F4200]";

  return (
    <div className="space-y-5">
      {/* Summary banner */}
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

      <p className="flex items-center gap-1.5 text-xs" style={{ color: C.muted }}><Ms name="info" className="!text-[14px]" /> Thang điểm 10 · ĐTB tạm tính theo tổng hệ số của các nhóm đã có điểm; ĐTB chính thức cần đủ thường xuyên, giữa kỳ và cuối kỳ.</p>
      {summary?.incompleteTx > 0 && (
        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#B45309" }}><Ms name="warning" className="!text-[14px]" /> {summary.incompleteTx} học sinh chưa đủ đầu điểm thường xuyên (cần tối thiểu 1 điểm miệng + 2 điểm 15 phút).</p>
      )}

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        {data.students.length === 0 ? <p className="p-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={THEAD} style={THEAD_STYLE}>
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
                  const r = draft[s.studentId] ?? {};
                  const avg = weightedAvg(r, scoreTypes);
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
                      {scoreTypes.map((t) => (
                        <td key={t.key} className="px-3 py-2.5 text-center">
                          <input type="number" min="0" max="10" step="0.25" value={r[t.key] ?? ""} onChange={(e) => setCell(s.studentId, t.key, e.target.value)} placeholder="—" className={inputCls} style={{ borderColor: C.border, color: C.onSurface, backgroundColor: C.surfaceLow }} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center font-bold" style={{ color: C.orange }}>{avg ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <input type="text" value={r.comment ?? ""} onChange={(e) => setCell(s.studentId, "comment", e.target.value)} placeholder="Ghi chú..." className="w-40 rounded-xl border px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#9F4200]" style={{ borderColor: C.border, color: C.onSurface }} />
                      </td>
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
        {saveMsg.text && <span className={`text-xs font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}>{saveMsg.text}</span>}
        <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium hover:bg-[#F3F3F3]" style={{ borderColor: C.border, color: C.onSurface }}><Ms name="file_download" className="!text-[18px]" /> Xuất báo cáo</button>
        <button type="button" onClick={handleSave} disabled={saving || data.students.length === 0} className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
          <Ms name={saving ? "sync" : "save"} className={`!text-[18px] ${saving ? "animate-spin" : ""}`} /> {saving ? "Đang lưu..." : "Lưu điểm"}
        </button>
      </div>
    </div>
  );
}

// ─── Chi tiết (student component breakdown across the teacher's subjects) ──────
function DetailTab({ classId, semesterId, subjectOptions, scoreTypes, onOpenStudent }) {
  const [loadState, setLoadState] = useState({ key: "", gradebooks: null });
  const [requestedStudentId, setRequestedStudentId] = useState("");

  const ready = Boolean(classId && semesterId && subjectOptions.length);
  const subjectsKey = subjectOptions.map((option) => option.id).join(",");
  const requestKey = ready ? `${classId}:${semesterId}:${subjectsKey}` : "";
  const gradebooks = loadState.key === requestKey ? loadState.gradebooks : null;
  const loading = ready && loadState.key !== requestKey;

  useEffect(() => {
    if (!ready) return;
    let m = true;
    Promise.all(subjectOptions.map((o) =>
      academicApi.getGradebook({ classId, subjectId: o.id, semesterId }).then((r) => ({ subjectId: o.id, subjectName: o.name, students: r.data.students })).catch(() => null)))
      .then((res) => { if (m) setLoadState({ key: requestKey, gradebooks: res.filter(Boolean) }); });
    return () => { m = false; };
  }, [classId, semesterId, subjectOptions, requestKey, ready]);

  const roster = useMemo(() => {
    const map = {};
    for (const g of gradebooks ?? []) for (const s of g.students) map[s.studentId] = { studentId: s.studentId, studentName: s.studentName, studentCode: s.studentCode, studentAvatar: s.studentAvatar };
    return Object.values(map).sort((a, b) => a.studentName.localeCompare(b.studentName));
  }, [gradebooks]);

  const studentId = roster.some((student) => String(student.studentId) === requestedStudentId)
    ? requestedStudentId
    : String(roster[0]?.studentId ?? "");

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
  const strongest = withAvg.length ? withAvg.reduce((a, b) => (b.avg > a.avg ? b : a)) : null;
  const weakest = withAvg.length ? withAvg.reduce((a, b) => (b.avg < a.avg ? b : a)) : null;

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
        <PrettySelect value={studentId} onChange={(e) => setRequestedStudentId(e.target.value)}>
          {roster.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName} ({s.studentCode})</option>)}
        </PrettySelect>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={THEAD} style={THEAD_STYLE}>
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>Cách tính điểm trung bình (ĐTB)</h4>
          <div className="space-y-2 text-sm">
            {scoreTypes.map((t) => (
              <div key={t.key} className="flex items-center justify-between"><span style={{ color: C.muted }}>{t.label}</span><span className="font-bold" style={{ color: C.onSurface }}>Hệ số {weightOf(t)}</span></div>
            ))}
          </div>
          <p className="mt-3 text-[11px] italic" style={{ color: C.muted }}>ĐTB = tổng (điểm nhóm × hệ số) / tổng hệ số của các nhóm đã có điểm. ĐĐGtx là trung bình các đầu điểm thường xuyên (miệng + 15 phút).</p>
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h4 className="mb-3 text-sm font-bold" style={{ color: C.onSurface }}>ĐTB theo môn</h4>
          <BarChart items={withAvg.map((r) => ({ label: r.subjectName, value: r.avg }))} color="cycle" />
        </div>
      </div>

      {strongest && weakest && (
        <div className="rounded-3xl p-5" style={{ backgroundColor: "rgba(34,93,173,0.06)", border: `1px solid ${C.border}` }}>
          <p className="mb-1 flex items-center gap-2 text-sm font-bold" style={{ color: C.secondary }}><Ms name="lightbulb" className="!text-[18px]" /> Nhận xét (tự động)</p>
          <p className="text-sm" style={{ color: C.onSurface }}>
            {student?.studentName} mạnh nhất ở môn <b>{strongest.subjectName}</b> ({strongest.avg}){strongest.subjectName !== weakest.subjectName && <> và cần cải thiện môn <b>{weakest.subjectName}</b> ({weakest.avg})</>}.
          </p>
          <button type="button" onClick={() => onOpenStudent(studentId)} className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: C.orange }}><Ms name="open_in_new" className="!text-[14px]" /> Mở hồ sơ đầy đủ</button>
        </div>
      )}
    </div>
  );
}

// ─── Phân tích (Analytics) ────────────────────────────────────────────────────
function StatCard({ label, value, delta, sub, color }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
        {delta != null && <span className="mb-0.5 flex items-center gap-0.5 text-xs font-bold" style={{ color: delta >= 0 ? C.success : C.error }}><Ms name={delta >= 0 ? "trending_up" : "trending_down"} className="!text-[14px]" />{delta >= 0 ? "+" : ""}{delta}</span>}
      </div>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
function AnalyticsTab({ classId, semesterId, onOpenStudent }) {
  const { data, trend, loading, error } = useAcademicAnalytics(classId, semesterId, Boolean(classId && semesterId));
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
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="bar_chart" className="!text-[18px]" style={{ color: C.orange }} /> So sánh theo môn</h3>
          <BarChart items={(data.subjectPerformance ?? []).map((p) => ({ label: p.subjectName, value: p.average }))} color="cycle" />
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="donut_large" className="!text-[18px]" style={{ color: C.secondary }} /> Phân bố xếp loại</h3>
          {distTotal > 0 ? <Donut segments={donutSeg} total={distTotal} centerLabel="học sinh" /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <h3 className="mb-1 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" className="!text-[18px]" style={{ color: C.secondary }} /> Phổ điểm chi tiết</h3>
        <p className="mb-3 text-xs text-slate-400">Sĩ số {s.totalStudents} · đã có điểm {s.scored}</p>
        <AreaChart points={dist.map((d) => ({ label: d.label, count: d.count }))} />
      </div>

      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b px-5 py-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
          <h3 className="flex items-center gap-1.5 text-sm font-bold" style={{ color: C.error }}><Ms name="priority_high" className="!text-[18px]" /> Học sinh cần lưu ý</h3>
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
                    <button type="button" onClick={() => onOpenStudent(st.studentId)} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: C.orange }}><Ms name="open_in_new" className="!text-[13px]" /> Hồ sơ</button>
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

// ─── Cảnh báo (Warnings) ──────────────────────────────────────────────────────
function WarningsTab({ classId, semesterId, onOpenStudent }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [editWarning, setEditWarning] = useState(null);
  const filters = useMemo(() => ({ classId, semesterId, status: statusFilter, _rk: refreshKey }), [classId, semesterId, statusFilter, refreshKey]);
  const { data, loading, error } = useAcademicWarnings(filters, Boolean(classId && semesterId));

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      high: items.filter((w) => ["AT_RISK", "MULTIPLE_FAIL"].includes(w.warningType)).length,
      declining: items.filter((w) => w.warningType === "DECLINING").length,
      low: items.filter((w) => w.warningType === "LOW_GPA").length,
      total: items.length,
    };
  }, [data]);

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try { const res = await academicApi.generateWarnings(classId, semesterId); setGenMsg(`Đã tạo/cập nhật ${res.data.generated} cảnh báo.`); setRefreshKey((k) => k + 1); }
    catch (err) { setGenMsg(err.message); } finally { setGenerating(false); }
  }

  if (!classId || !semesterId) return <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Chọn lớp và học kỳ để xem cảnh báo.</div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[["Nguy cơ cao", counts.high, C.error, "dangerous"], ["Sa sút", counts.declining, C.orange, "trending_down"], ["GPA thấp", counts.low, "#B45309", "priority_high"], ["Tổng cảnh báo", counts.total, C.secondary, "notifications_active"]].map(([label, val, color, icon]) => (
          <div key={label} className="rounded-3xl bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="mb-1 flex items-center gap-1.5"><Ms name={icon} className="!text-[16px]" style={{ color }} /><p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p></div>
            <p className="text-3xl font-extrabold leading-none" style={{ color }}>{String(val).padStart(2, "0")}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <PrettySelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mở</option>
          <option value="IN_PROGRESS">Đang can thiệp</option>
          <option value="RESOLVED">Đã xử lý</option>
        </PrettySelect>
        <div className="flex items-center gap-3">
          {genMsg && <span className="text-xs text-slate-500">{genMsg}</span>}
          <button type="button" onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.deepBlue }}>
            <Ms name="autorenew" className={`!text-[18px] ${generating ? "animate-spin" : ""}`} /> {generating ? "Đang quét..." : "Quét cảnh báo tự động"}
          </button>
        </div>
      </div>

      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Không có cảnh báo. Nhấn "Quét cảnh báo tự động" để tạo theo ngưỡng.</div>
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
                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setEditWarning(w)} className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition hover:opacity-90" style={{ backgroundColor: C.orange }}>Can thiệp</button>
                    <button type="button" onClick={() => onOpenStudent(w.studentId)} className="rounded-full px-4 py-1.5 text-xs font-medium transition" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: C.secondary }}>Xem hồ sơ</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      {editWarning && <WarningInterventionModal warning={editWarning} onClose={() => setEditWarning(null)} onSaved={() => { setEditWarning(null); setRefreshKey((k) => k + 1); }} />}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
function AcademicPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "scores";
  const { data: meta, loading: metaLoading, error: metaError } = useAcademicMeta();

  const [requestedClassId, setRequestedClassId] = useState("");
  const [requestedSubjectId, setRequestedSubjectId] = useState("");
  const [requestedSemesterId, setRequestedSemesterId] = useState("");

  const assignments = useMemo(() => meta?.assignments ?? [], [meta]);
  const classOptions = useMemo(() => { const m = {}; for (const a of assignments) m[a.classId] = a.className; return Object.entries(m).map(([id, name]) => ({ id, name })); }, [assignments]);
  const classId = classOptions.some((option) => String(option.id) === requestedClassId)
    ? requestedClassId
    : String(classOptions[0]?.id ?? "");
  const subjectOptions = useMemo(() => assignments.filter((a) => String(a.classId) === String(classId)).map((a) => ({ id: String(a.subjectId), name: a.subjectName })), [assignments, classId]);
  const subjectId = subjectOptions.some((option) => String(option.id) === requestedSubjectId)
    ? requestedSubjectId
    : String(subjectOptions[0]?.id ?? "");
  const semesterId = meta?.semesters?.some((semester) => String(semester.semesterId) === requestedSemesterId)
    ? requestedSemesterId
    : String(meta?.semesters?.[0]?.semesterId ?? "");

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  function setTab(key) { setSearchParams({ tab: key }); }
  function openStudent(studentId) { navigate(`/teacher/academic/students/${studentId}?semesterId=${semesterId}`); }
  const showSubject = activeTab === "scores" || activeTab === "detail";
  const subjectName = subjectOptions.find((s) => String(s.id) === String(subjectId))?.name;

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Học kỳ" sidebarFooterValue={meta?.semesters.find((s) => String(s.semesterId) === String(semesterId))?.semesterName ?? "—"}>
      {metaError && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : meta && (
        assignments.length === 0 ? (
          <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Bạn chưa được phân công dạy lớp/môn nào.</div>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Quản lý sổ điểm</h2>
              <div className="flex flex-wrap items-end gap-2">
                <PrettySelect value={classId} onChange={(e) => setRequestedClassId(e.target.value)}>
                  {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </PrettySelect>
                {showSubject && (
                  <PrettySelect value={subjectId} onChange={(e) => setRequestedSubjectId(e.target.value)}>
                    {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </PrettySelect>
                )}
                <PrettySelect value={semesterId} onChange={(e) => setRequestedSemesterId(e.target.value)}>
                  {meta.semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
                </PrettySelect>
              </div>
            </div>

            <div className="mb-6 flex w-fit items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
              {TABS.map(({ key, label, ms }) => (
                <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all" style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                  <Ms name={ms} className="!text-[18px]" /><span>{label}</span>
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
        )
      )}
    </DashboardShell>
  );
}

export default AcademicPage;
