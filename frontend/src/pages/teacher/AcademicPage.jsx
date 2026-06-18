import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiBarChart2,
  FiEdit3,
  FiExternalLink,
  FiRefreshCw,
  FiSave,
  FiTrendingUp,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import GradeDistributionChart from "../../components/organisms/GradeDistributionChart";
import WarningInterventionModal from "../../components/organisms/WarningInterventionModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { academicApi } from "../../api/client";
import { useAcademicAnalytics } from "../../hooks/useAcademicAnalytics";
import { useAcademicMeta } from "../../hooks/useAcademicMeta";
import { useAcademicWarnings } from "../../hooks/useAcademicWarnings";
import { useScoreSheet } from "../../hooks/useScoreSheet";

const TABS = [
  { key: "scores",    label: "Nhập điểm", icon: FiEdit3 },
  { key: "analytics", label: "Phân tích", icon: FiBarChart2 },
  { key: "warnings",  label: "Cảnh báo",  icon: FiAlertTriangle },
];

const WARNING_LABEL = {
  LOW_GPA:       { label: "GPA thấp",       color: "#F59E0B" },
  MULTIPLE_FAIL: { label: "Trượt nhiều môn", color: "#DC2626" },
  DECLINING:     { label: "Sa sút",          color: "#F27123" },
  AT_RISK:       { label: "Nguy cơ cao",     color: "#DC2626" },
};

const WARNING_STATUS = {
  OPEN:        { label: "Mở",            bg: "#FEF2F2", text: "#DC2626" },
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FFFBEB", text: "#F59E0B" },
  RESOLVED:    { label: "Đã xử lý",       bg: "#ECFDF5", text: "#16A34A" },
};

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

// ─── Score Entry Tab ──────────────────────────────────────────────────────────

function ScoreEntryTab({ classId, subjectId, semesterId, scoreType, setScoreType, scoreTypes }) {
  const [maxScore, setMaxScore] = useState(10);
  const [refreshKey, setRefreshKey] = useState(0);
  const { data, loading, error } = useScoreSheet({ classId, subjectId, semesterId, scoreType }, refreshKey);

  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState({ text: "", isError: false });

  useEffect(() => {
    if (!data) return;
    const init = {};
    for (const s of data.students) {
      init[s.studentId] = {
        scoreValue: s.scoreValue ?? "",
        comment: s.comment ?? "",
        resultId: s.resultId,
      };
      if (s.maxScore) setMaxScore(s.maxScore);
    }
    setDraft(init);
    setSaveMsg({ text: "", isError: false });
  }, [data]);

  function setScore(studentId, value) {
    setDraft((prev) => ({ ...prev, [studentId]: { ...prev[studentId], scoreValue: value } }));
  }

  const ready = classId && subjectId && semesterId && scoreType;

  async function handleSave() {
    const records = Object.entries(draft)
      .filter(([, v]) => v.scoreValue !== "" && v.scoreValue !== null)
      .map(([studentId, v]) => ({ studentId: parseInt(studentId, 10), scoreValue: Number(v.scoreValue), comment: v.comment || null }));

    if (records.length === 0) {
      setSaveMsg({ text: "Chưa nhập điểm nào.", isError: true });
      return;
    }
    // client-side range check
    for (const r of records) {
      if (r.scoreValue < 0) { setSaveMsg({ text: "Điểm không được âm.", isError: true }); return; }
      if (r.scoreValue > Number(maxScore)) { setSaveMsg({ text: `Điểm vượt quá tối đa (${maxScore}).`, isError: true }); return; }
    }

    setSaving(true);
    setSaveMsg({ text: "", isError: false });
    try {
      const res = await academicApi.submitScores({
        classId, subjectId, semesterId, scoreType, maxScore: Number(maxScore), records,
      });
      setSaveMsg({ text: `Đã lưu ${res.data.saved} điểm.`, isError: false });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSaveMsg({ text: err.message, isError: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Loại điểm</label>
          <select value={scoreType} onChange={(e) => setScoreType(e.target.value)} className={selectCls}>
            {scoreTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Điểm tối đa</label>
          <input type="number" min="1" max="100" step="0.5" value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)} className={`${selectCls} w-28`} />
        </div>
      </div>

      {!ready && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
          Vui lòng chọn lớp, môn và học kỳ để nhập điểm.
        </div>
      )}

      {ready && loading && (
        <div className="space-y-2">{[0, 1, 2, 3].map((n) => <div key={n} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      )}

      {ready && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {ready && !loading && !error && data && (
        <>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            {data.students.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-400">Lớp chưa có học sinh.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                      {["HỌC SINH", `ĐIỂM (/${maxScore})`, "GHI CHÚ"].map((c, i) => (
                        <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                      ))}
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
                            <div>
                              <div className="text-sm font-medium text-[#0F2747]">{s.studentName}</div>
                              <div className="text-xs text-slate-400">{s.studentCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <input
                            type="number" min="0" max={maxScore} step="0.25"
                            value={draft[s.studentId]?.scoreValue ?? ""}
                            onChange={(e) => setScore(s.studentId, e.target.value)}
                            placeholder="—"
                            className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-[#0F2747] outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-xs text-slate-500">
                          {draft[s.studentId]?.comment || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleSave} disabled={saving || data.students.length === 0}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
              style={{ backgroundColor: "#F27123" }}>
              <FiSave size={15} /> {saving ? "Đang lưu..." : "Lưu điểm"}
            </button>
            {saveMsg.text && (
              <span className={`text-xs font-medium ${saveMsg.isError ? "text-red-600" : "text-green-600"}`}>{saveMsg.text}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function StatBox({ label, value, suffix = "", color = "#0F2747" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}{suffix}</p>
    </div>
  );
}

function AnalyticsTab({ classId, semesterId, onOpenStudent }) {
  const { data, trend, loading, error } = useAcademicAnalytics(classId, semesterId, Boolean(classId && semesterId));

  if (!classId || !semesterId) {
    return <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Chọn lớp và học kỳ để xem thống kê.</div>;
  }
  if (loading) {
    return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3,4,5,6,7].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const s = data.summary;
  const maxSubjAvg = Math.max(...data.subjectPerformance.map((x) => x.average), 10);
  const maxTrend = Math.max(...trend.map((t) => t.classAverage), 10);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Điểm TB lớp" value={s.classAverage ?? "—"} color="#F27123" />
        <StatBox label="Tỷ lệ đạt" value={s.passRate} suffix="%" color="#16A34A" />
        <StatBox label="Tỷ lệ trượt" value={s.failRate} suffix="%" color="#DC2626" />
        <StatBox label="Đã có điểm" value={`${s.scored}/${s.totalStudents}`} color="#08509F" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-500">Cao nhất</p>
          <p className="text-sm font-bold" style={{ color: "#16A34A" }}>
            {s.highest ? `${s.highest.name} · ${s.highest.gpa}` : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="text-xs text-slate-500">Thấp nhất</p>
          <p className="text-sm font-bold" style={{ color: "#DC2626" }}>
            {s.lowest ? `${s.lowest.name} · ${s.lowest.gpa}` : "—"}
          </p>
        </div>
      </div>

      {/* Grade distribution */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Phân bố xếp loại (theo GPA)</h3>
        <GradeDistributionChart distribution={data.distribution} />
      </div>

      {/* Subject performance */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Điểm trung bình theo môn</h3>
        {data.subjectPerformance.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa có dữ liệu.</p>
        ) : (
          <div className="space-y-3">
            {data.subjectPerformance.map((sp) => (
              <div key={sp.subjectName}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-[#0F2747]">{sp.subjectName}</span>
                  <span className="text-slate-500">TB {sp.average} · cao {sp.highest} · thấp {sp.lowest}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(sp.average / maxSubjAvg) * 100}%`, backgroundColor: "#08509F" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trend */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}>
          <FiTrendingUp size={15} /> Xu hướng điểm TB lớp qua các kỳ
        </h3>
        {trend.length === 0 ? (
          <p className="text-sm text-slate-400">Chưa đủ dữ liệu nhiều kỳ.</p>
        ) : (
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {trend.map((t) => (
              <div key={t.semesterName} className="flex flex-col items-center gap-2" style={{ minWidth: 70 }}>
                <span className="text-xs font-bold" style={{ color: "#0F2747" }}>{t.classAverage}</span>
                <div className="flex h-28 w-8 items-end overflow-hidden rounded-lg bg-slate-100">
                  <div className="w-full rounded-lg" style={{ height: `${(t.classAverage / maxTrend) * 100}%`, backgroundColor: "#F27123" }} />
                </div>
                <span className="text-center text-[10px] text-slate-500" style={{ maxWidth: 70 }}>{t.semesterName}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ranking table */}
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="border-b px-5 py-3" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
          <h3 className="text-sm font-bold" style={{ color: "#0F2747" }}>Bảng xếp hạng lớp</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#FFE7D6" }}>
                {["HẠNG", "HỌC SINH", "GPA", "XẾP LOẠI", ""].map((c, i) => (
                  <th key={i} className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((st, idx) => (
                <tr key={st.studentId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-2.5 font-bold" style={{ color: "#0F2747" }}>#{st.rank}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-sm font-medium text-[#0F2747]">{st.studentName}</div>
                    <div className="text-xs text-slate-400">{st.studentCode}</div>
                  </td>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "#08509F" }}>{st.gpa}</td>
                  <td className="px-4 py-2.5 text-slate-600">{st.standing?.label}</td>
                  <td className="px-4 py-2.5">
                    <button type="button" onClick={() => onOpenStudent(st.studentId)}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition"
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
    setGenerating(true);
    setGenMsg("");
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
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Trạng thái</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
            <option value="">Tất cả</option>
            <option value="OPEN">Mở</option>
            <option value="IN_PROGRESS">Đang can thiệp</option>
            <option value="RESOLVED">Đã xử lý</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          {genMsg && <span className="text-xs text-slate-500">{genMsg}</span>}
          <button type="button" onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
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
              const stCfg = WARNING_STATUS[w.status] ?? WARNING_STATUS.OPEN;
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
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>
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
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition" style={{ backgroundColor: "#F27123", color: "#fff" }}>
                      Can thiệp
                    </button>
                    <button type="button" onClick={() => onOpenStudent(w.studentId)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium transition" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
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
  const [scoreType,  setScoreType]  = useState("MIDTERM");

  // Initialize defaults once meta loads
  useEffect(() => {
    if (!meta) return;
    if (meta.assignments.length && !classId) {
      setClassId(String(meta.assignments[0].classId));
      setSubjectId(String(meta.assignments[0].subjectId));
    }
    if (meta.semesters.length && !semesterId) {
      setSemesterId(String(meta.semesters[0].semesterId));
    }
    if (meta.scoreTypes.length) {
      setScoreType((prev) => (meta.scoreTypes.some((t) => t.key === prev) ? prev : meta.scoreTypes[0].key));
    }
  }, [meta]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignments = meta?.assignments ?? [];

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

  // keep subject valid when class changes
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
      <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Quản lý kết quả học tập</h1>
        <p className="text-sm text-slate-500">Nhập điểm, phân tích kết quả và quản lý cảnh báo học tập theo lớp.</p>
      </section>

      {metaError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

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
              {/* Shared selectors */}
              <div className="mb-5 flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Lớp</label>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)} className={selectCls}>
                    {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                {showSubject && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Môn</label>
                    <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectCls}>
                      {subjectOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Học kỳ</label>
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
                  <ScoreEntryTab
                    classId={classId} subjectId={subjectId} semesterId={semesterId}
                    scoreType={scoreType} setScoreType={setScoreType} scoreTypes={meta.scoreTypes}
                  />
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
