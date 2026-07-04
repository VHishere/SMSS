import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiAward,
  FiBarChart2,
  FiClipboard,
  FiInfo,
  FiMinusCircle,
  FiPlusCircle,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

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

const TABS = [
  { key: "records",   label: "Khen / Kỷ luật", icon: FiClipboard },
  { key: "conduct",   label: "Hạnh kiểm",      icon: FiAward },
  { key: "analytics", label: "Phân tích",      icon: FiBarChart2 },
  { key: "warnings",  label: "Cảnh báo",       icon: FiAlertTriangle },
];

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#08509F", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };
const BUCKET_COLOR = { "0-50": "#DC2626", "50-65": "#F59E0B", "65-80": "#08509F", "80-100": "#16A34A" };
const WARNING_LABEL = {
  LOW_CONDUCT:         { label: "Hạnh kiểm thấp", color: "#DC2626" },
  EXCESSIVE_VIOLATION: { label: "Vi phạm nhiều",  color: "#F59E0B" },
  INTERVENTION:        { label: "Cần can thiệp",  color: "#F27123" },
};
const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FFFBEB", text: "#F59E0B" },
  RESOLVED:    { label: "Đã xử lý",        bg: "#ECFDF5", text: "#16A34A" },
};

const selectCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

// ─── Records Tab ──────────────────────────────────────────────────────────────

function RecordsTab({ classId, semester, students, categories, onChanged }) {
  const [behaviorType, setBehaviorType] = useState("POSITIVE");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState(null);

  const filters = useMemo(
    () => ({ classId, behaviorType, startDate: semester?.startDate, endDate: semester?.endDate, page: 1, limit: 50, _rk: refreshKey }),
    [classId, behaviorType, semester?.startDate, semester?.endDate, refreshKey],
  );
  const { data, loading, error } = useBehaviourRecords(filters, Boolean(classId));

  const isMerit = behaviorType === "POSITIVE";

  async function handleArchive(rec) {
    const reason = window.prompt("Lý do lưu trữ bản ghi này?");
    if (reason === null) return;
    if (!reason.trim()) { alert("Cần nhập lý do."); return; }
    try {
      await behaviourApi.archiveRecord(rec.behaviorId, reason.trim());
      setRefreshKey((k) => k + 1);
      onChanged();
    } catch (err) { alert(err.message); }
  }

  function refresh() { setRefreshKey((k) => k + 1); onChanged(); }

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
        <FiInfo size={14} className="mt-0.5 shrink-0" />
        <span>Ghi nhận <b>khen thưởng</b> (điểm cộng) và <b>vi phạm</b> (điểm trừ) của học sinh. Tổng điểm cộng/trừ sẽ tự tính ra điểm & xếp loại ở tab “Hạnh kiểm”.</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button type="button" onClick={() => setBehaviorType("POSITIVE")}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition"
            style={isMerit ? { backgroundColor: "#16A34A", color: "#fff" } : { color: "#64748B" }}>
            <FiPlusCircle size={14} /> Khen thưởng
          </button>
          <button type="button" onClick={() => setBehaviorType("VIOLATION")}
            className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition"
            style={!isMerit ? { backgroundColor: "#DC2626", color: "#fff" } : { color: "#64748B" }}>
            <FiMinusCircle size={14} /> Kỷ luật
          </button>
        </div>
        <button type="button" onClick={() => setModal({ mode: "create" })}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105"
          style={{ backgroundColor: isMerit ? "#16A34A" : "#DC2626" }}>
          {isMerit ? "+ Thêm khen thưởng" : "+ Ghi nhận vi phạm"}
        </button>
      </div>

      {loading && <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Chưa có bản ghi {isMerit ? "khen thưởng" : "vi phạm"} nào.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                    {["HỌC SINH", "NỘI DUNG", "ĐIỂM", "NGÀY", "GV GHI", ""].map((c, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r, idx) => (
                    <tr key={r.behaviorId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0F2747]">{r.studentName}</div>
                        <div className="text-xs text-slate-400">{r.studentCode} · {r.className ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-[#0F2747]">{r.title}</div>
                        {r.evidenceUrl && (
                          <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: "#08509F" }}>Xem minh chứng</a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: isMerit ? "#16A34A" : "#DC2626" }}>{isMerit ? "+" : "-"}{Math.abs(r.points)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.recordDate}</td>
                      <td className="px-4 py-3 text-slate-500">{r.createdByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setModal({ mode: "edit", record: r })}
                            className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>Sửa</button>
                          <button type="button" onClick={() => handleArchive(r)}
                            className="rounded-full px-3 py-1 text-xs font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Lưu trữ</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {modal && (
        <BehaviourRecordModal
          mode={modal.mode}
          behaviorType={behaviorType}
          record={modal.record}
          students={students}
          categories={isMerit ? categories.merit : categories.violation}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Conduct Tab (grade-first) ────────────────────────────────────────────────

function ConductTab({ analytics, loading, error, semesterId, onChanged }) {
  const [evalStudent, setEvalStudent] = useState(null);

  if (loading) return <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">Xếp loại tính tự động từ điểm khen thưởng / kỷ luật (Tốt ≥ 80, Khá ≥ 65, Đạt ≥ 50, còn lại Chưa đạt).</p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                {["HỌC SINH", "ĐIỂM THƯỞNG", "ĐIỂM TRỪ", "XẾP LOẠI HẠNH KIỂM", ""].map((c, i) => (
                  <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {analytics.students.map((s, idx) => (
                <tr key={s.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-[#0F2747]">{s.studentName}</div>
                    <div className="text-xs text-slate-400">{s.studentCode}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#16A34A" }}>+{s.meritPoints}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#DC2626" }}>-{Math.abs(s.demeritPoints)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: GRADE_COLOR[s.grade.key] }}>{s.grade.label}</span>
                    <span className="ml-2 text-xs text-slate-400">{s.finalScore}đ</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEvalStudent(s)}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-105" style={{ backgroundColor: "#F27123" }}>Đánh giá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {evalStudent && (
        <ConductEvaluationModal student={evalStudent} semesterId={semesterId} onClose={() => setEvalStudent(null)} onSaved={() => { setEvalStudent(null); onChanged(); }} />
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function StatBox({ label, value, color = "#0F2747" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function DonutChart({ segments, total }) {
  const R = 52, cx = 70, cy = 70, C = 2 * Math.PI * R;
  const arcs = segments.map((s, i) => {
    const before = segments.slice(0, i).reduce((sum, x) => sum + x.count, 0);
    const len = total > 0 ? (s.count / total) * C : 0;
    const off = total > 0 ? -(before / total) * C : 0;
    return { color: s.color, len, off };
  });
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
        {arcs.map((a, i) => a.len > 0 && (
          <circle key={i} cx={cx} cy={cy} r={R} fill="none" stroke={a.color} strokeWidth="16"
            strokeDasharray={`${a.len} ${C}`} strokeDashoffset={a.off} transform={`rotate(-90 ${cx} ${cy})`} />
        ))}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="#0F2747">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="10" fill="#64748B">học sinh</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold text-[#0F2747]">{s.count}</span>
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
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{Math.round(g)}</text>
          </g>
        ))}
        {n > 1 && <polyline points={seriesLine("merit")} fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {n > 1 && <polyline points={seriesLine("demerit")} fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {trend.map((t, i) => (
          <g key={t.month}>
            <circle cx={x(i)} cy={y(t.merit)} r="3.5" fill="#fff" stroke="#16A34A" strokeWidth="2" />
            <circle cx={x(i)} cy={y(Math.abs(t.demerit))} r="3.5" fill="#fff" stroke="#DC2626" strokeWidth="2" />
            <text x={x(i)} y={baseY + 16} fontSize="9" fill="#64748B" textAnchor="middle">{t.month}</text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#16A34A" }} /> Khen thưởng</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#DC2626" }} /> Kỷ luật</span>
      </div>
    </div>
  );
}

function AnalyticsTab({ analytics, loading, error }) {
  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;

  const s = analytics.summary;
  const donutSegments = (analytics.distribution ?? []).map((d) => ({ label: d.label, count: d.count, color: BUCKET_COLOR[d.key] ?? "#94A3B8" }));
  const donutTotal = donutSegments.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Sĩ số" value={s.totalStudents} color="#08509F" />
        <StatBox label="Điểm rèn luyện TB" value={s.avgConduct ?? "—"} color="#F27123" />
        <StatBox label="Tổng điểm thưởng" value={s.totalMerit} color="#16A34A" />
        <StatBox label="Tổng điểm trừ" value={s.totalDemerit} color="#DC2626" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Phân bố xếp loại hạnh kiểm</h3>
          {donutTotal > 0 ? <DonutChart segments={donutSegments} total={donutTotal} /> : <p className="py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiTrendingUp size={15} /> Khen thưởng vs Kỷ luật theo tháng</h3>
          <MeritTrendChart trend={analytics.trend} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiAward size={15} /> Học sinh tích cực nhất</h3>
          {analytics.topPositive.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {analytics.topPositive.map((s2, i) => (
                <div key={s2.studentId} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#FFF7F2" }}>
                  <span className="text-sm text-[#0F2747]">#{i + 1} {s2.studentName}</span>
                  <span className="text-sm font-bold" style={{ color: "#16A34A" }}>+{s2.meritPoints}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiAlertTriangle size={15} /> Vi phạm nhiều nhất</h3>
          {analytics.mostViolations.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {analytics.mostViolations.map((s2, i) => (
                <div key={s2.studentId} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#FFF7F2" }}>
                  <span className="text-sm text-[#0F2747]">#{i + 1} {s2.studentName}</span>
                  <span className="text-sm font-bold" style={{ color: "#DC2626" }}>-{Math.abs(s2.demeritPoints)} ({s2.violationCount} lần)</span>
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

  const filters = useMemo(
    () => ({ classId, semesterId, status: statusFilter, _rk: refreshKey }),
    [classId, semesterId, statusFilter, refreshKey],
  );
  const { data, loading, error } = useBehaviourWarnings(filters, Boolean(classId && semesterId));

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try {
      const res = await behaviourApi.generateWarnings(classId, semesterId);
      setGenMsg(`Đã tạo/cập nhật ${res.data.generated} cảnh báo.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setGenMsg(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
          <option value="">Tất cả trạng thái</option>
          <option value="OPEN">Mở</option>
          <option value="IN_PROGRESS">Đang can thiệp</option>
          <option value="RESOLVED">Đã xử lý</option>
        </select>
        <div className="flex items-center gap-3">
          {genMsg && <span className="text-xs text-slate-500">{genMsg}</span>}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50" style={{ backgroundColor: "#08509F" }}>
            <FiRefreshCw size={14} className={generating ? "animate-spin" : ""} />
            {generating ? "Đang quét..." : "Quét cảnh báo tự động"}
          </button>
        </div>
      </div>

      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Không có cảnh báo. Nhấn "Quét cảnh báo tự động".
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((w) => {
              const typeCfg = WARNING_LABEL[w.warningType] ?? { label: w.warningType, color: "#64748B" };
              const stCfg = WARNING_STATUS[w.status];
              return (
                <div key={w.warningId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#0F2747" }}>{w.studentName}</p>
                      <p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · HK {w.conductScore ?? "—"}đ</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      {stCfg && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>}
                    </div>
                  </div>
                  {w.note && <p className="mt-2 text-sm text-slate-600">{w.note}</p>}
                  {w.intervention && (
                    <p className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="font-semibold">Can thiệp: </span>{w.intervention}
                    </p>
                  )}
                  <div className="mt-3">
                    <button type="button" onClick={() => setEditWarning(w)}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-105" style={{ backgroundColor: "#F27123" }}>Can thiệp</button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {editWarning && (
        <BehaviourWarningModal warning={editWarning} onClose={() => setEditWarning(null)} onSaved={() => { setEditWarning(null); setRefreshKey((k) => k + 1); }} />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function BehaviourPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "records";

  const { data: meta, loading: metaLoading, error: metaError } = useBehaviourMeta();

  const [classId,    setClassId]    = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);

  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];

  const effClassId    = classId    || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");

  const { data: analytics, loading: aLoading, error: aError } =
    useBehaviourAnalytics(effClassId, effSemesterId, Boolean(effClassId && effSemesterId), analyticsRefresh);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName),
    );
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const categories = useMemo(
    () => ({ merit: meta?.meritCategories ?? [], violation: meta?.violationCategories ?? [] }),
    [meta],
  );

  const studentsForModal = useMemo(
    () => (analytics?.students ?? []).map((s) => ({ studentId: s.studentId, studentName: s.studentName, studentCode: s.studentCode })),
    [analytics],
  );

  function setTab(key) { setSearchParams({ tab: key }); }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"}
    >
      {metaError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : meta && (
        classes.length === 0 ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
            Bạn chưa phụ trách lớp nào.
          </div>
        ) : (
          <>
            {/* Toolbar: title + filters (right) */}
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>Hạnh kiểm</h1>
              <div className="flex flex-wrap items-end gap-3">
                <select value={effClassId} onChange={(e) => setClassId(e.target.value)} className={selectCls}>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </select>
                <select value={effSemesterId} onChange={(e) => setSemesterId(e.target.value)} className={selectCls}>
                  {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
                </select>
              </div>
            </div>

            {/* Tabs */}
            <div className="mb-6 flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              {TABS.map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => setTab(key)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition"
                  style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                  <Icon size={15} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
              {activeTab === "records" && (
                <RecordsTab
                  classId={effClassId}
                  semester={semesters.find((s) => String(s.semesterId) === effSemesterId)}
                  students={studentsForModal}
                  categories={categories}
                  onChanged={() => setAnalyticsRefresh((k) => k + 1)}
                />
              )}
              {activeTab === "conduct" && (
                <ConductTab analytics={analytics} loading={aLoading} error={aError} semesterId={Number(effSemesterId)} onChanged={() => setAnalyticsRefresh((k) => k + 1)} />
              )}
              {activeTab === "analytics" && (
                <AnalyticsTab analytics={analytics} loading={aLoading} error={aError} />
              )}
              {activeTab === "warnings" && (
                <WarningsTab classId={effClassId} semesterId={effSemesterId} />
              )}
            </div>
          </>
        )
      )}
    </DashboardShell>
  );
}

export default BehaviourPage;
