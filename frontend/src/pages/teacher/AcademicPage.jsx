import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiEdit3,
  FiExternalLink,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import WarningInterventionModal from "../../components/organisms/WarningInterventionModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { academicApi } from "../../api/client";
import { useAcademicAnalytics } from "../../hooks/useAcademicAnalytics";
import { useAcademicMeta } from "../../hooks/useAcademicMeta";
import { useAcademicWarnings } from "../../hooks/useAcademicWarnings";

const TABS = [
  { key: "scores",    label: "Bảng điểm", icon: FiEdit3 },
  { key: "analytics", label: "Thống kê",  icon: FiBarChart2 },
  { key: "warnings",  label: "Cảnh báo",  icon: FiAlertTriangle },
];

const WARNING_LABEL = {
  LOW_GPA:       { label: "GPA thấp",        color: "#F59E0B" },
  MULTIPLE_FAIL: { label: "Trượt nhiều môn", color: "#DC2626" },
  DECLINING:     { label: "Sa sút",          color: "#F27123" },
  AT_RISK:       { label: "Nguy cơ cao",     color: "#DC2626" },
};

const WARNING_STATUS = {
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FFFBEB", text: "#F59E0B" },
  RESOLVED:    { label: "Đã xử lý",        bg: "#ECFDF5", text: "#16A34A" },
};

const selectCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

// ─── Gradebook Tab (multi-score-type entry + list) ────────────────────────────

function GradebookTab({ classId, subjectId, semesterId, scoreTypes }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ text: "", isError: false });

  const ready = Boolean(classId && subjectId && semesterId);

  useEffect(() => {
    if (!ready) return;
    let m = true;
    setLoading(true); setError("");
    academicApi.getGradebook({ classId, subjectId, semesterId })
      .then((res) => { if (m) setData(res.data); })
      .catch((e) => { if (m) setError(e.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [classId, subjectId, semesterId, refreshKey, ready]);

  useEffect(() => {
    if (!data) return;
    const init = {};
    for (const s of data.students) {
      const row = { comment: s.comment ?? "" };
      for (const t of scoreTypes) row[t.key] = s.scores?.[t.key]?.scoreValue ?? "";
      init[s.studentId] = row;
    }
    setDraft(init);
    setSaveMsg({ text: "", isError: false });
  }, [data, scoreTypes]);

  function setCell(studentId, key, value) {
    setDraft((p) => ({ ...p, [studentId]: { ...p[studentId], [key]: value } }));
  }

  async function handleSave() {
    const byType = {};
    for (const sid of Object.keys(draft)) {
      const row = draft[sid];
      for (const t of scoreTypes) {
        const v = row[t.key];
        if (v === "" || v === null || v === undefined) continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > 10) {
          setSaveMsg({ text: "Điểm phải trong khoảng 0–10.", isError: true });
          return;
        }
        (byType[t.key] ??= []).push({ studentId: Number(sid), scoreValue: n, comment: row.comment || null });
      }
    }
    const types = Object.keys(byType);
    if (types.length === 0) { setSaveMsg({ text: "Chưa nhập điểm nào.", isError: true }); return; }

    setSaving(true); setSaveMsg({ text: "", isError: false });
    try {
      let total = 0;
      for (const type of types) {
        const res = await academicApi.submitScores({ classId, subjectId, semesterId, scoreType: type, maxScore: 10, records: byType[type] });
        total += res.data.saved;
      }
      setSaveMsg({ text: `Đã lưu ${total} điểm.`, isError: false });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Vui lòng chọn lớp, môn và học kỳ.</div>;
  }
  if (loading) {
    return <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  }
  if (!data) return null;

  const inputCls = "w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-center text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">Thang điểm 10. Nhập tất cả đầu điểm ngay trên bảng — không cần đổi bộ lọc.</p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        {data.students.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>Học sinh</th>
                  {scoreTypes.map((t) => (
                    <th key={t.key} className="whitespace-nowrap px-3 py-3 text-center text-xs font-bold" style={{ color: "#F27123" }}>{t.label}</th>
                  ))}
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>Nhận xét</th>
                </tr>
              </thead>
              <tbody>
                {data.students.map((s, idx) => (
                  <tr key={s.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#08509F" }}>
                          {s.studentAvatar ? <img src={s.studentAvatar} alt={s.studentName} className="h-8 w-8 rounded-full object-cover" /> : (s.studentName?.[0]?.toUpperCase() ?? "?")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-[#0F2747]">{s.studentName}</div>
                          <div className="text-xs text-slate-400">{s.studentCode}</div>
                        </div>
                      </div>
                    </td>
                    {scoreTypes.map((t) => (
                      <td key={t.key} className="px-3 py-2.5 text-center">
                        <input type="number" min="0" max="10" step="0.25"
                          value={draft[s.studentId]?.[t.key] ?? ""}
                          onChange={(e) => setCell(s.studentId, t.key, e.target.value)}
                          placeholder="—" className={inputCls} />
                      </td>
                    ))}
                    <td className="px-4 py-2.5">
                      <input type="text" value={draft[s.studentId]?.comment ?? ""}
                        onChange={(e) => setCell(s.studentId, "comment", e.target.value)}
                        placeholder="Ghi chú..."
                        className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {saveMsg.text && <span className={`text-xs font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}>{saveMsg.text}</span>}
        <button type="button" onClick={handleSave} disabled={saving || data.students.length === 0}
          className="rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
          style={{ backgroundColor: "#F27123" }}>
          {saving ? "Đang lưu..." : "Lưu điểm"}
        </button>
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function StatBox({ label, value, suffix = "", color = "#0F2747" }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}{suffix}</p>
    </div>
  );
}

function TrendLineChart({ trend }) {
  const pts = trend.filter((t) => t.classAverage != null);
  if (pts.length === 0) return <p className="text-sm text-slate-400">Chưa đủ dữ liệu nhiều kỳ.</p>;
  const stepX = 100, padX = 36, padTop = 22, chartH = 130, padBottom = 30;
  const n = pts.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (v) => padTop + (1 - Math.min(v, 10) / 10) * chartH;
  const line = pts.map((t, i) => `${x(i)},${y(t.classAverage)}`).join(" ");
  const area = `M ${x(0)},${baseY} ${pts.map((t, i) => `L ${x(i)},${y(t.classAverage)}`).join(" ")} L ${x(n - 1)},${baseY} Z`;
  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="block">
        {[0, 2.5, 5, 7.5, 10].map((g) => (
          <g key={g}>
            <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
            <text x={padX - 10} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}</text>
          </g>
        ))}
        {n > 1 && <path d={area} fill="rgba(242,113,35,0.10)" />}
        {n > 1 && <polyline points={line} fill="none" stroke="#F27123" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {pts.map((t, i) => (
          <g key={t.semesterName}>
            <circle cx={x(i)} cy={y(t.classAverage)} r="4.5" fill="#fff" stroke="#F27123" strokeWidth="2.5" />
            <text x={x(i)} y={y(t.classAverage) - 11} fontSize="11" fontWeight="700" fill="#0F2747" textAnchor="middle">{t.classAverage}</text>
            <text x={x(i)} y={baseY + 18} fontSize="9" fill="#64748B" textAnchor="middle">{t.semesterName}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function AnalyticsTab({ classId, semesterId, onOpenStudent }) {
  const { data, trend, loading, error } = useAcademicAnalytics(classId, semesterId, Boolean(classId && semesterId));

  if (!classId || !semesterId) {
    return <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Chọn lớp và học kỳ để xem thống kê.</div>;
  }
  if (loading) {
    return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const s = data.summary;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Điểm TB lớp" value={s.classAverage ?? "—"} color="#F27123" />
        <StatBox label="Tỷ lệ đạt" value={s.passRate} suffix="%" color="#16A34A" />
        <StatBox label="Tỷ lệ trượt" value={s.failRate} suffix="%" color="#DC2626" />
        <StatBox label="Đã có điểm" value={`${s.scored}/${s.totalStudents}`} color="#08509F" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-500">Cao nhất</p>
          <p className="text-sm font-bold" style={{ color: "#16A34A" }}>{s.highest ? `${s.highest.name} · ${s.highest.gpa}` : "—"}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-500">Thấp nhất</p>
          <p className="text-sm font-bold" style={{ color: "#DC2626" }}>{s.lowest ? `${s.lowest.name} · ${s.lowest.gpa}` : "—"}</p>
        </div>
      </div>

      {/* Single line chart: class-average trend */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}>
          <FiTrendingUp size={15} /> Xu hướng điểm TB lớp qua các kỳ
        </h3>
        <TrendLineChart trend={trend} />
      </div>

      {/* Centered ranking */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="border-b px-5 py-3 text-center" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
          <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Bảng xếp hạng lớp</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: "#FFE7D6" }}>
                {["HẠNG", "HỌC SINH", "GPA", "XẾP LOẠI", ""].map((c, i) => (
                  <th key={i} className="px-4 py-2.5 text-center text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((st, idx) => (
                <tr key={st.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-2.5 text-center font-bold" style={{ color: "#0F2747" }}>#{st.rank}</td>
                  <td className="px-4 py-2.5 text-center">
                    <div className="text-sm font-medium text-[#0F2747]">{st.studentName}</div>
                    <div className="text-xs text-slate-400">{st.studentCode}</div>
                  </td>
                  <td className="px-4 py-2.5 text-center font-semibold" style={{ color: "#08509F" }}>{st.gpa}</td>
                  <td className="px-4 py-2.5 text-center text-slate-600">{st.standing?.label}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button type="button" onClick={() => onOpenStudent(st.studentId)}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition"
                      style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
                      <FiExternalLink size={11} /> Hồ sơ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Warnings Tab ─────────────────────────────────────────────────────────────

function WarningsTab({ classId, semesterId, onOpenStudent }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState("");
  const [editWarning, setEditWarning] = useState(null);

  const filters = useMemo(
    () => ({ classId, semesterId, status: statusFilter, _rk: refreshKey }),
    [classId, semesterId, statusFilter, refreshKey],
  );

  const { data, loading, error } = useAcademicWarnings(filters, Boolean(classId && semesterId));

  async function handleGenerate() {
    setGenerating(true); setGenMsg("");
    try {
      const res = await academicApi.generateWarnings(classId, semesterId);
      setGenMsg(`Đã tạo/cập nhật ${res.data.generated} cảnh báo.`);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setGenMsg(err.message);
    } finally {
      setGenerating(false);
    }
  }

  if (!classId || !semesterId) {
    return <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Chọn lớp và học kỳ để xem cảnh báo.</div>;
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
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "#08509F" }}>
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
            Không có cảnh báo. Nhấn "Quét cảnh báo tự động" để tạo theo ngưỡng.
          </div>
        ) : (
          <div className="space-y-3">
            {data.items.map((w) => {
              const typeCfg = WARNING_LABEL[w.warningType] ?? { label: w.warningType, color: "#64748B" };
              const stCfg = WARNING_STATUS[w.status];
              return (
                <div key={w.warningId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: "#08509F" }}>
                        {w.studentAvatar ? <img src={w.studentAvatar} alt={w.studentName} className="h-10 w-10 rounded-full object-cover" /> : (w.studentName?.[0]?.toUpperCase() ?? "?")}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: "#0F2747" }}>{w.studentName}</p>
                        <p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · GPA {w.gpaSnapshot ?? "—"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      {stCfg && <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>}
                    </div>
                  </div>

                  {w.note && <p className="mt-3 text-sm text-slate-600">{w.note}</p>}
                  {w.intervention && (
                    <p className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="font-semibold">Can thiệp: </span>{w.intervention}
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button type="button" onClick={() => setEditWarning(w)}
                      className="rounded-full px-4 py-1.5 text-xs font-semibold text-white transition hover:brightness-105" style={{ backgroundColor: "#F27123" }}>
                      Can thiệp
                    </button>
                    <button type="button" onClick={() => onOpenStudent(w.studentId)}
                      className="rounded-full px-4 py-1.5 text-xs font-medium transition" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
                      Xem hồ sơ
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {editWarning && (
        <WarningInterventionModal
          warning={editWarning}
          onClose={() => setEditWarning(null)}
          onSaved={() => { setEditWarning(null); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AcademicPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "scores";

  const { data: meta, loading: metaLoading, error: metaError } = useAcademicMeta();

  const [classId,    setClassId]    = useState("");
  const [subjectId,  setSubjectId]  = useState("");
  const [semesterId, setSemesterId] = useState("");

  useEffect(() => {
    if (!meta) return;
    if (meta.assignments.length && !classId) {
      setClassId(String(meta.assignments[0].classId));
      setSubjectId(String(meta.assignments[0].subjectId));
    }
    if (meta.semesters.length && !semesterId) {
      setSemesterId(String(meta.semesters[0].semesterId));
    }
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignments = useMemo(() => meta?.assignments ?? [], [meta]);

  const classOptions = useMemo(() => {
    const map = {};
    for (const a of assignments) map[a.classId] = a.className;
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [assignments]);

  const subjectOptions = useMemo(() => {
    return assignments
      .filter((a) => String(a.classId) === String(classId))
      .map((a) => ({ id: a.subjectId, name: a.subjectName }));
  }, [assignments, classId]);

  useEffect(() => {
    if (!subjectOptions.length) return;
    if (!subjectOptions.some((s) => String(s.id) === String(subjectId))) {
      setSubjectId(String(subjectOptions[0].id));
    }
  }, [subjectOptions]); // eslint-disable-line react-hooks/exhaustive-deps

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName),
    );
    return {
      name:   user?.fullName ?? user?.username ?? "Giáo viên",
      role:   roleEntry?.description ?? "Giáo viên",
      avatar: user?.avatar ?? "",
    };
  }, [user]);

  function setTab(key) { setSearchParams({ tab: key }); }
  function openStudent(studentId) { navigate(`/teacher/academic/students/${studentId}?semesterId=${semesterId}`); }

  const showSubject = activeTab === "scores";

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Học kỳ"
      sidebarFooterValue={meta?.semesters.find((s) => String(s.semesterId) === String(semesterId))?.semesterName ?? "—"}
    >
      {metaError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : meta && (
        <>
          {assignments.length === 0 ? (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
              Bạn chưa được phân công dạy lớp/môn nào.
            </div>
          ) : (
            <>
              {/* Toolbar: title + filters (right) */}
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <h1 className="text-xl font-bold sm:text-2xl" style={{ color: "#0F2747" }}>Kết quả học tập</h1>
                <div className="flex flex-wrap items-end gap-3">
                  <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectCls}>
                    {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {showSubject && (
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectCls}>
                      {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  )}
                  <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)} className={selectCls}>
                    {meta.semesters.map((s) => (
                      <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>
                    ))}
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
                {activeTab === "scores" && (
                  <GradebookTab classId={classId} subjectId={subjectId} semesterId={semesterId} scoreTypes={meta.scoreTypes} />
                )}
                {activeTab === "analytics" && (
                  <AnalyticsTab classId={classId} semesterId={semesterId} onOpenStudent={openStudent} />
                )}
                {activeTab === "warnings" && (
                  <WarningsTab classId={classId} semesterId={semesterId} onOpenStudent={openStudent} />
                )}
              </div>
            </>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default AcademicPage;
