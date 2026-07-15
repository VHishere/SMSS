import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import BehaviourRecordModal from "../../components/organisms/BehaviourRecordModal";
import ConductEvaluationModal from "../../components/organisms/ConductEvaluationModal";
import BehaviourWarningModal from "../../components/organisms/BehaviourWarningModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { behaviourApi } from "../../api/client";
import { useBehaviourAnalytics } from "../../hooks/useBehaviourAnalytics";
import { useBehaviourMeta } from "../../hooks/useBehaviourMeta";
import { useBehaviourRecords } from "../../hooks/useBehaviourRecords";
import { useBehaviourWarnings } from "../../hooks/useBehaviourWarnings";

// ─── FSchool Stitch design tokens ────────────────────────────────────────────
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
function todayLocal() { const p = (n) => String(n).padStart(2, "0"); const d = new Date(); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function ago(dt) {
  if (!dt) return "";
  const d = new Date(String(dt).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return "";
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 60) return `${Math.max(m, 0)} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const dd = Math.floor(h / 24);
  if (dd === 1) return "Hôm qua";
  return `${dd} ngày trước`;
}

const TABS = [
  { key: "overview",  label: "Tổng quan",      ms: "dashboard" },
  { key: "warnings",  label: "Cảnh báo",       ms: "warning" },
];

const GRADE_COLOR = { TOT: "#15803D", KHA: "#00458E", TB: "#B45309", YEU: "#BA1A1A", NA: "#64748B" };
const BUCKET_COLOR = { "0-50": "#BA1A1A", "50-65": "#B45309", "65-80": "#00458E", "80-100": "#15803D" };
const WARNING_LABEL = {
  LOW_CONDUCT:         { label: "Hạnh kiểm thấp", color: "#BA1A1A" },
  EXCESSIVE_VIOLATION: { label: "Vi phạm nhiều",  color: "#B45309" },
  INTERVENTION:        { label: "Cần can thiệp",  color: "#F27123" },
};
const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FEF3C7", text: "#B45309" },
  RESOLVED:    { label: "Đã xử lý",        bg: "#DCFCE7", text: "#15803D" },
};
const AVA = ["#00458E", "#4A5F82", "#225DAD", "#F27123"];

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

// ─── Overview dashboard (Stitch "Quản lý nề nếp") ─────────────────────────────
function OverviewTab({ records, warnings, students, meritCategories, catMap, onChanged, onEdit }) {
  const [catFilter, setCatFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(
    () => (catFilter ? records.filter((r) => r.category === catFilter) : records),
    [records, catFilter],
  );
  const shown = showAll ? filtered : filtered.slice(0, 6);

  // Quick award
  const [qaStudent, setQaStudent] = useState("");
  const [qaPoints, setQaPoints] = useState(10);
  const [qaBusy, setQaBusy] = useState(false);
  const [qaMsg, setQaMsg] = useState("");
  async function givePoints() {
    if (!qaStudent) { setQaMsg("Chọn học sinh"); return; }
    const cat = meritCategories[0]?.key;
    if (!cat) { setQaMsg("Chưa có danh mục khen thưởng"); return; }
    setQaBusy(true); setQaMsg("");
    try {
      await behaviourApi.createRecord({ studentId: Number(qaStudent), behaviorType: "POSITIVE", title: "Cộng điểm nhanh", category: cat, points: Number(qaPoints), severityLevel: "LOW", recordDate: todayLocal(), description: null, evidenceUrl: null });
      setQaMsg("Đã cộng điểm ✓"); setQaStudent(""); onChanged();
    } catch (e) { setQaMsg(e.message); } finally { setQaBusy(false); }
  }

  // Evaluations feed (real warnings; fallback to notable merits)
  const feed = useMemo(() => {
    const items = (warnings ?? []).slice(0, 5).map((w) => ({
      key: `w${w.warningId}`,
      title: WARNING_LABEL[w.warningType]?.label ?? "Cảnh báo hành vi",
      time: ago(w.createdAt),
      student: w.studentName,
      desc: w.note || "Cần theo dõi và can thiệp kịp thời.",
      action: w.status === "RESOLVED"
        ? { label: "Đã xử lý", icon: "check_circle", color: C.success }
        : { label: "Yêu cầu tham vấn", icon: "report", color: C.error },
    }));
    if (items.length < 3) {
      for (const r of records.filter((x) => x.behaviorType === "POSITIVE" && x.points >= 10).slice(0, 3 - items.length)) {
        items.push({ key: `m${r.behaviorId}`, title: "Đề xuất khen thưởng", time: ago(r.recordDate), student: r.studentName, desc: r.title, action: { label: "Đề xuất Khen thưởng", icon: "star", color: C.secondary, fill: true } });
      }
    }
    return items;
  }, [warnings, records]);

  const catOptions = Object.entries(catMap);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left: recent records table */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm lg:col-span-2" style={{ border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between border-b p-5" style={{ borderColor: C.border }}>
          <h4 className="font-bold" style={{ color: C.onSurface }}>Ghi nhận gần đây</h4>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="rounded-lg border bg-white px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={selStyle}>
            <option value="">Tất cả các mục</option>
            {catOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className={THEAD} style={THEAD_STYLE}>
              <tr>
                <th className={TH}>Học sinh</th>
                <th className={TH}>Loại</th>
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
                  <tr key={r.behaviorId} onClick={() => onEdit(r)} className="cursor-pointer transition-colors hover:bg-[#F3F3F3]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <AvatarChip name={r.studentName} avatar={r.studentAvatar} i={i} size={8} />
                        <div className="min-w-0">
                          <p className="font-bold" style={{ color: C.onSurface }}>{r.studentName}</p>
                          <p className="text-[11px]" style={{ color: C.muted }}>{r.className ?? "—"} • {r.studentCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p style={{ color: C.onSurface }}>{r.title}</p>
                      <p className="text-[11px]" style={{ color: C.muted }}>{catMap[r.category] ?? (r.behaviorType === "VIOLATION" ? "Vi phạm" : "Khen thưởng")}</p>
                    </td>
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
              {showAll ? "Thu gọn" : `Xem tất cả ${filtered.length} hồ sơ`}
            </button>
          </div>
        )}
      </div>

      {/* Right: evaluations feed + quick award */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h4 className="mb-4 flex items-center justify-between font-bold" style={{ color: C.onSurface }}>
            Đánh giá gần đây <Ms name="more_vert" style={{ color: "#94A3B8" }} />
          </h4>
          <div className="max-h-[400px] space-y-4 overflow-y-auto pr-1">
            {feed.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Chưa có cảnh báo/đánh giá nào.</p>
            ) : feed.map((f) => (
              <div key={f.key} className="rounded-2xl border p-3 transition-all hover:border-[#F27123]" style={{ borderColor: C.border }}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h5 className="text-sm font-bold" style={{ color: C.onSurface }}>{f.title}</h5>
                  <span className="rounded px-2 py-0.5 text-[10px]" style={{ backgroundColor: C.surfaceHigh, color: C.muted }}>{f.time}</span>
                </div>
                <p className="mb-2 text-sm" style={{ color: C.muted }}><span className="font-semibold" style={{ color: C.onSurface }}>{f.student}</span>: {f.desc}</p>
                <div className="flex items-center gap-2">
                  <Ms name={f.action.icon} className="!text-[16px]" style={{ color: f.action.color }} fill={f.action.fill} />
                  <span className="text-xs font-bold" style={{ color: f.action.color }}>{f.action.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl p-5" style={{ backgroundColor: "rgba(242,113,35,0.05)", border: "1px solid rgba(242,113,35,0.2)" }}>
          <h4 className="mb-4 text-xs font-extrabold uppercase tracking-widest" style={{ color: C.orange }}>Cộng điểm nhanh</h4>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs" style={{ color: C.muted }}>Học sinh</label>
              <select value={qaStudent} onChange={(e) => setQaStudent(e.target.value)} className="w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={selStyle}>
                <option value="">Chọn học sinh...</option>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs" style={{ color: C.muted }}>Mức điểm</label>
              <div className="flex gap-2">
                {[5, 10, 20].map((v) => (
                  <button key={v} type="button" onClick={() => setQaPoints(v)}
                    className="flex-1 rounded-lg border py-2 text-xs font-bold transition-colors"
                    style={qaPoints === v ? { backgroundColor: C.orange, color: "#fff", borderColor: C.orange } : { borderColor: C.orange, color: C.orange }}>
                    +{v}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={givePoints} disabled={qaBusy}
              className="w-full rounded-full py-3 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.orange }}>
              {qaBusy ? "Đang lưu..." : "Giao điểm"}
            </button>
            {qaMsg && <p className="text-center text-xs" style={{ color: qaMsg.includes("✓") ? C.success : C.error }}>{qaMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Conduct Tab (grade-first) ────────────────────────────────────────────────
function ConductTab({ analytics, loading, error, semesterId, onChanged }) {
  const [evalStudent, setEvalStudent] = useState(null);
  if (loading) return <div className="space-y-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;
  return (
    <div>
      <p className="mb-3 flex items-center gap-1.5 text-xs" style={{ color: C.muted }}>
        <Ms name="info" className="!text-[14px]" /> Xếp loại tính tự động từ điểm khen thưởng / kỷ luật (Tốt ≥ 80, Khá ≥ 65, Đạt ≥ 50, còn lại Chưa đạt).
      </p>
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className={THEAD} style={THEAD_STYLE}>
              <tr className="text-left">{["HỌC SINH", "ĐIỂM THƯỞNG", "ĐIỂM TRỪ", "XẾP LOẠI HẠNH KIỂM", ""].map((c, i) => <th key={i} className={TH}>{c}</th>)}</tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.border }}>
              {analytics.students.map((s, i) => (
                <tr key={s.studentId} className="transition-colors hover:bg-[#F3F3F3]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AvatarChip name={s.studentName} avatar={s.studentAvatar} i={i} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium" style={{ color: C.onSurface }}>{s.studentName}</div>
                        <div className="text-xs text-slate-400">{s.studentCode}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: C.success }}>+{s.meritPoints}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: C.error }}>-{Math.abs(s.demeritPoints)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: GRADE_COLOR[s.grade.key] }}>{s.grade.label}</span>
                    <span className="ml-2 text-xs text-slate-400">{s.finalScore}đ rèn luyện</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEvalStudent(s)} className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition hover:opacity-90" style={{ backgroundColor: C.orange }}>Đánh giá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {evalStudent && <ConductEvaluationModal student={evalStudent} semesterId={semesterId} onClose={() => setEvalStudent(null)} onSaved={() => { setEvalStudent(null); onChanged(); }} />}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function StatBox({ label, value, color = C.onSurface }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm" style={{ borderLeft: `4px solid ${color}` }}>
      <p className="mb-1 text-xs font-bold uppercase tracking-wider" style={{ color: C.muted }}>{label}</p>
      <p className="text-3xl font-extrabold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}
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
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#64748B">học sinh</text>
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
function AnalyticsTab({ analytics, loading, error }) {
  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0, 1, 2, 3].map((n) => <div key={n} className="h-24 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>;
  if (error) return <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;
  const s = analytics.summary;
  const donutSegments = (analytics.distribution ?? []).map((d) => ({ label: d.label, count: d.count, color: BUCKET_COLOR[d.key] ?? "#94A3B8" }));
  const donutTotal = donutSegments.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Sĩ số" value={s.totalStudents} color={C.secondary} />
        <StatBox label="Điểm rèn luyện TB" value={s.avgConduct ?? "—"} color={C.orange} />
        <StatBox label="Tổng điểm thưởng" value={s.totalMerit} color={C.success} />
        <StatBox label="Tổng điểm trừ" value={s.totalDemerit} color={C.error} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: C.onSurface }}>Phân bố xếp loại hạnh kiểm</h3>
          {donutTotal > 0 ? <DonutChart segments={donutSegments} total={donutTotal} /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="show_chart" className="!text-[18px]" style={{ color: C.orange }} /> Khen thưởng vs Kỷ luật theo tháng</h3>
          <MeritTrendChart trend={analytics.trend} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.success }}><Ms name="emoji_events" className="!text-[18px]" /> Học sinh tích cực nhất</h3>
          {analytics.topPositive.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {analytics.topPositive.map((s2, i) => (
                <div key={s2.studentId} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: C.surfaceLow }}>
                  <span className="text-sm" style={{ color: C.onSurface }}>#{i + 1} {s2.studentName}</span>
                  <span className="text-sm font-bold" style={{ color: C.success }}>+{s2.meritPoints}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.error }}><Ms name="warning" className="!text-[18px]" /> Vi phạm nhiều nhất</h3>
          {analytics.mostViolations.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {analytics.mostViolations.map((s2, i) => (
                <div key={s2.studentId} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ backgroundColor: C.surfaceLow }}>
                  <span className="text-sm" style={{ color: C.onSurface }}>#{i + 1} {s2.studentName}</span>
                  <span className="text-sm font-bold" style={{ color: C.error }}>-{Math.abs(s2.demeritPoints)} ({s2.violationCount} lần)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Warnings Tab ─────────────────────────────────────────────────────────────
function WarningsTab({ classId, semesterId }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [editWarning, setEditWarning] = useState(null);
  const filters = useMemo(() => ({ classId, semesterId, status: statusFilter, _rk: refreshKey }), [classId, semesterId, statusFilter, refreshKey]);
  const { data, loading, error } = useBehaviourWarnings(filters, Boolean(classId && semesterId));

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try { const res = await behaviourApi.generateWarnings(classId, semesterId); setGenMsg(`Đã tạo/cập nhật ${res.data.generated} cảnh báo.`); setRefreshKey((k) => k + 1); }
    catch (err) { setGenMsg(err.message); } finally { setGenerating(false); }
  }
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls} style={selStyle}>
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mở</option>
          <option value="IN_PROGRESS">Đang can thiệp</option>
          <option value="RESOLVED">Đã xử lý</option>
        </select>
        <div className="flex items-center gap-3">
          {genMsg && <span className="text-xs text-slate-500">{genMsg}</span>}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-50" style={{ backgroundColor: C.deepBlue }}>
            <Ms name="autorenew" className={`!text-[18px] ${generating ? "animate-spin" : ""}`} />
            {generating ? "Đang quét..." : "Quét cảnh báo tự động"}
          </button>
        </div>
      </div>
      {loading && <div className="space-y-2">{[0, 1, 2].map((n) => <div key={n} className="h-16 animate-pulse rounded-3xl bg-slate-200/60" />)}</div>}
      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: `1px solid ${C.border}` }}>Không có cảnh báo. Nhấn "Quét cảnh báo tự động".</div>
        ) : (
          <div className="space-y-3">
            {data.items.map((w, i) => {
              const typeCfg = WARNING_LABEL[w.warningType] ?? { label: w.warningType, color: "#64748B" };
              const stCfg = WARNING_STATUS[w.status];
              return (
                <div key={w.warningId} className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}`, borderLeftWidth: 4, borderLeftColor: typeCfg.color }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AvatarChip name={w.studentName} avatar={w.studentAvatar} i={i} />
                      <div>
                        <p className="text-sm font-bold" style={{ color: C.onSurface }}>{w.studentName}</p>
                        <p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · HK {w.conductScore ?? "—"}đ</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      {stCfg && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>}
                    </div>
                  </div>
                  {w.note && <p className="mt-2 text-sm text-slate-600">{w.note}</p>}
                  {w.intervention && <p className="mt-2 rounded-xl px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: C.surfaceLow }}><span className="font-semibold">Can thiệp: </span>{w.intervention}</p>}
                  <div className="mt-3">
                    <button type="button" onClick={() => setEditWarning(w)} className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition hover:opacity-90" style={{ backgroundColor: C.orange }}>Can thiệp</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
      {editWarning && <BehaviourWarningModal warning={editWarning} onClose={() => setEditWarning(null)} onSaved={() => { setEditWarning(null); setRefreshKey((k) => k + 1); }} />}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function BehaviourPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const { data: meta, loading: metaLoading, error: metaError } = useBehaviourMeta();

  const [classId, setClassId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [createMenu, setCreateMenu] = useState(false);
  const [createType, setCreateType] = useState(null); // "POSITIVE" | "VIOLATION"
  const [editRecord, setEditRecord] = useState(null);
  const menuRef = useRef(null);

  const classes = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const effClassId = classId || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const sem = semesters.find((s) => String(s.semesterId) === effSemesterId);

  const { data: analytics, loading: aLoading, error: aError } = useBehaviourAnalytics(effClassId, effSemesterId, Boolean(effClassId && effSemesterId), refresh);

  const recFilters = (type) => ({ classId: effClassId, behaviorType: type, startDate: sem?.startDate, endDate: sem?.endDate, page: 1, limit: 50, _rk: refresh });
  const { data: meritData } = useBehaviourRecords(recFilters("POSITIVE"), Boolean(effClassId));
  const { data: violData } = useBehaviourRecords(recFilters("VIOLATION"), Boolean(effClassId));
  const { data: warnData } = useBehaviourWarnings({ classId: effClassId, semesterId: effSemesterId, _rk: refresh }, Boolean(effClassId && effSemesterId));

  const records = useMemo(
    () => [...(meritData?.items ?? []), ...(violData?.items ?? [])].sort((a, b) => String(b.recordDate).localeCompare(String(a.recordDate))),
    [meritData, violData],
  );

  useEffect(() => {
    if (!createMenu) return;
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setCreateMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [createMenu]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) => ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const categories = useMemo(() => ({ merit: meta?.meritCategories ?? [], violation: meta?.violationCategories ?? [] }), [meta]);
  const catMap = useMemo(() => {
    const m = {};
    for (const c of [...(meta?.meritCategories ?? []), ...(meta?.violationCategories ?? [])]) m[c.key] = c.label;
    return m;
  }, [meta]);
  const studentsForModal = useMemo(
    () => (analytics?.students ?? []).map((s) => ({ studentId: s.studentId, studentName: s.studentName, studentCode: s.studentCode })),
    [analytics],
  );

  function setTab(key) { setSearchParams({ tab: key }); }
  function bump() { setRefresh((k) => k + 1); }

  function exportCsv() {
    const head = ["Học sinh", "Mã", "Lớp", "Loại", "Danh mục", "Điểm", "Ngày", "GV ghi"];
    const rows = records.map((r) => [r.studentName, r.studentCode, r.className ?? "", r.behaviorType === "VIOLATION" ? "Vi phạm" : "Khen thưởng", catMap[r.category] ?? "", (r.behaviorType === "VIOLATION" ? "-" : "+") + Math.abs(r.points), r.recordDate, r.createdByName ?? ""]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ne-nep-${effClassId}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.TEACHER} sidebarFooterLabel="Lớp" sidebarFooterValue={classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"}>
      {metaError && <div className="mb-4 rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/60" />
      ) : meta && (
        classes.length === 0 ? (
          <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: `1px solid ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>Bạn chưa phụ trách lớp nào.</div>
        ) : (
          <>
            {/* Header */}
            <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: C.onSurface }}>Quản lý nề nếp</h2>
              <div className="flex flex-wrap items-center gap-2">
                <select value={effClassId} onChange={(e) => setClassId(e.target.value)} className={selectCls} style={selStyle}>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </select>
                <select value={effSemesterId} onChange={(e) => setSemesterId(e.target.value)} className={selectCls} style={selStyle}>
                  {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
                </select>
                <button type="button" onClick={exportCsv} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90" style={{ backgroundColor: C.secondary }}>
                  <Ms name="file_download" className="!text-[18px]" /> Xuất báo cáo
                </button>
                <div className="relative" ref={menuRef}>
                  <button type="button" onClick={() => setCreateMenu((v) => !v)} className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-90 active:scale-95" style={{ backgroundColor: C.orange }}>
                    <Ms name="add" className="!text-[18px]" /> Ghi nhận sự việc
                  </button>
                  {createMenu && (
                    <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border bg-white shadow-lg" style={{ borderColor: C.border }}>
                      <button type="button" onClick={() => { setCreateType("POSITIVE"); setCreateMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#F3F3F3]" style={{ color: C.success }}><Ms name="add_circle" className="!text-[18px]" /> Khen thưởng</button>
                      <button type="button" onClick={() => { setCreateType("VIOLATION"); setCreateMenu(false); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-[#F3F3F3]" style={{ color: C.error }}><Ms name="do_not_disturb_on" className="!text-[18px]" /> Vi phạm</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex w-fit flex-wrap items-center gap-1 rounded-full border p-1" style={{ backgroundColor: C.surfaceLow, borderColor: C.border }}>
              {TABS.map(({ key, label, ms }) => (
                <button key={key} type="button" onClick={() => setTab(key)} className="flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm transition-all"
                  style={activeTab === key ? { backgroundColor: C.orange, color: "#fff", fontWeight: 700 } : { color: C.muted, fontWeight: 500 }}>
                  <Ms name={ms} className="!text-[18px]" /><span>{label}</span>
                </button>
              ))}
            </div>

            {activeTab === "overview" && (
              <OverviewTab records={records} warnings={warnData?.items ?? []} students={studentsForModal} meritCategories={categories.merit} catMap={catMap} onChanged={bump} onEdit={(r) => setEditRecord(r)} />
            )}
            {activeTab === "warnings" && (
              <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}` }}>
                <WarningsTab classId={effClassId} semesterId={effSemesterId} />
              </div>
            )}
          </>
        )
      )}

      {createType && (
        <BehaviourRecordModal mode="create" behaviorType={createType} students={studentsForModal}
          categories={createType === "POSITIVE" ? categories.merit : categories.violation}
          onClose={() => setCreateType(null)} onSaved={() => { setCreateType(null); bump(); }} />
      )}
      {editRecord && (
        <BehaviourRecordModal mode="edit" behaviorType={editRecord.behaviorType} record={editRecord}
          categories={editRecord.behaviorType === "POSITIVE" ? categories.merit : categories.violation}
          onClose={() => setEditRecord(null)} onSaved={() => { setEditRecord(null); bump(); }} />
      )}
    </DashboardShell>
  );
}

export default BehaviourPage;
