import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FiAlertTriangle,
  FiAward,
  FiBarChart2,
  FiClipboard,
  FiExternalLink,
  FiMinusCircle,
  FiPlusCircle,
  FiRefreshCw,
  FiTrendingUp,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import GradeDistributionChart from "../../components/organisms/GradeDistributionChart";
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
  { key: "records",   label: "Ghi nhận", icon: FiClipboard },
  { key: "conduct",   label: "Hạnh kiểm", icon: FiAward },
  { key: "analytics", label: "Phân tích", icon: FiBarChart2 },
  { key: "warnings",  label: "Cảnh báo",  icon: FiAlertTriangle },
];

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#08509F", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };
const WARNING_LABEL = {
  LOW_CONDUCT:         { label: "Hạnh kiểm thấp", color: "#DC2626" },
  EXCESSIVE_VIOLATION: { label: "Vi phạm nhiều",  color: "#F59E0B" },
  INTERVENTION:        { label: "Cần can thiệp",  color: "#F27123" },
};
const WARNING_STATUS = {
  OPEN:        { label: "Mở",            bg: "#FEF2F2", text: "#DC2626" },
  IN_PROGRESS: { label: "Đang can thiệp", bg: "#FFFBEB", text: "#F59E0B" },
  RESOLVED:    { label: "Đã xử lý",       bg: "#ECFDF5", text: "#16A34A" },
};

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

// ─── Records Tab ──────────────────────────────────────────────────────────────

function RecordsTab({ classId, students, categories, onChanged }) {
  const [behaviorType, setBehaviorType] = useState("POSITIVE");
  const [refreshKey, setRefreshKey] = useState(0);
  const [modal, setModal] = useState(null); // { mode, record? }

  const filters = useMemo(
    () => ({ classId, behaviorType, page: 1, limit: 50, _rk: refreshKey }),
    [classId, behaviorType, refreshKey],
  );
  const { data, loading, error } = useBehaviourRecords(filters, Boolean(classId));

  const isMerit = behaviorType === "POSITIVE";
  const meritCats = categories.merit;
  const violationCats = categories.violation;

  async function handleArchive(rec) {
    const reason = window.prompt("Lý do lưu trữ bản ghi này?");
    if (reason === null) return;
    if (!reason.trim()) { alert("Cần nhập lý do."); return; }
    try {
      await behaviourApi.archiveRecord(rec.behaviorId, reason.trim());
      setRefreshKey((k) => k + 1);
      onChanged();
    } catch (err) {
      alert(err.message);
    }
  }

  function refresh() { setRefreshKey((k) => k + 1); onChanged(); }

  return (
    <div>
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
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition"
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
                        <span className="font-bold" style={{ color: isMerit ? "#16A34A" : "#DC2626" }}>
                          {isMerit ? "+" : "-"}{r.points}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.recordDate}</td>
                      <td className="px-4 py-3 text-slate-500">{r.createdByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setModal({ mode: "edit", record: r })}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>Sửa</button>
                          <button type="button" onClick={() => handleArchive(r)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Lưu trữ</button>
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
          categories={isMerit ? meritCats : violationCats}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}
    </div>
  );
}

// ─── Conduct Tab ──────────────────────────────────────────────────────────────

function ConductTab({ analytics, loading, error, semesterId, onChanged }) {
  const [evalStudent, setEvalStudent] = useState(null);

  if (loading) return <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                {["HỌC SINH", "THƯỞNG", "TRỪ", "HẠNH KIỂM", "XẾP LOẠI", ""].map((c, i) => (
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
                  <td className="px-4 py-3 font-semibold" style={{ color: "#DC2626" }}>-{s.demeritPoints}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: "#0F2747" }}>{s.finalScore}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: GRADE_COLOR[s.grade.key] }}>{s.grade.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setEvalStudent(s)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#F27123" }}>Đánh giá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {evalStudent && (
        <ConductEvaluationModal
          student={evalStudent}
          semesterId={semesterId}
          onClose={() => setEvalStudent(null)}
          onSaved={() => { setEvalStudent(null); onChanged(); }}
        />
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function StatBox({ label, value, color = "#0F2747" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function AnalyticsTab({ analytics, loading, error }) {
  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!analytics) return null;

  const s = analytics.summary;
  const maxTrend = Math.max(...analytics.trend.map((t) => Math.max(t.merit, t.demerit)), 1);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Sĩ số" value={s.totalStudents} color="#08509F" />
        <StatBox label="Hạnh kiểm TB" value={s.avgConduct ?? "—"} color="#F27123" />
        <StatBox label="Tổng điểm thưởng" value={s.totalMerit} color="#16A34A" />
        <StatBox label="Tổng điểm trừ" value={s.totalDemerit} color="#DC2626" />
      </div>

      {/* Conduct distribution */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Phân bố điểm hạnh kiểm</h3>
        <GradeDistributionChart distribution={analytics.distribution} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top positive */}
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
        {/* Most violations */}
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiAlertTriangle size={15} /> Vi phạm nhiều nhất</h3>
          {analytics.mostViolations.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
            <div className="space-y-2">
              {analytics.mostViolations.map((s2, i) => (
                <div key={s2.studentId} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ backgroundColor: "#FFF7F2" }}>
                  <span className="text-sm text-[#0F2747]">#{i + 1} {s2.studentName}</span>
                  <span className="text-sm font-bold" style={{ color: "#DC2626" }}>-{s2.demeritPoints} ({s2.violationCount} lần)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monthly merit vs demerit trend */}
      <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <h3 className="mb-4 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiTrendingUp size={15} /> Khen thưởng vs Kỷ luật theo tháng</h3>
        {analytics.trend.length === 0 ? <p className="text-sm text-slate-400">Chưa có dữ liệu.</p> : (
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {analytics.trend.map((t) => (
              <div key={t.month} className="flex flex-col items-center gap-1" style={{ minWidth: 56 }}>
                <div className="flex h-28 items-end gap-1">
                  <div className="w-4 rounded-t" style={{ height: `${(t.merit / maxTrend) * 100}%`, backgroundColor: "#16A34A" }} title={`Thưởng ${t.merit}`} />
                  <div className="w-4 rounded-t" style={{ height: `${(t.demerit / maxTrend) * 100}%`, backgroundColor: "#DC2626" }} title={`Trừ ${t.demerit}`} />
                </div>
                <span className="text-[10px] text-slate-500">{t.month}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#16A34A" }} /> Khen thưởng</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "#DC2626" }} /> Kỷ luật</span>
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
    setGenerating(true);
    setGenMsg("");
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
            className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50" style={{ backgroundColor: "#08509F" }}>
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
              const stCfg = WARNING_STATUS[w.status] ?? WARNING_STATUS.OPEN;
              return (
                <div key={w.warningId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#0F2747" }}>{w.studentName}</p>
                      <p className="text-xs text-slate-400">{w.studentCode} · {w.className ?? "—"} · HK {w.conductScore ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: typeCfg.color }}>{typeCfg.label}</span>
                      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: stCfg.bg, color: stCfg.text }}>{stCfg.label}</span>
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
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#F27123" }}>Can thiệp</button>
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "records";

  const { data: meta, loading: metaLoading, error: metaError } = useBehaviourMeta();

  const [classId,    setClassId]    = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [analyticsRefresh, setAnalyticsRefresh] = useState(0);

  // initialize defaults
  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  if (meta && !classId && classes.length) {
    // lazy init via state setter on first render after meta loads
  }

  // derive selected values with fallback
  const effClassId    = classId    || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");

  const { data: analytics, loading: aLoading, error: aError } =
    useBehaviourAnalytics(effClassId, effSemesterId, Boolean(effClassId && effSemesterId), analyticsRefresh);

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
      <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Quản lý hạnh kiểm</h1>
        <p className="text-sm text-slate-500">Ghi nhận khen thưởng / kỷ luật, đánh giá hạnh kiểm và theo dõi cảnh báo hành vi.</p>
      </section>

      {metaError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{metaError}</div>}

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : meta && (
        classes.length === 0 ? (
          <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
            Bạn chưa phụ trách lớp nào.
          </div>
        ) : (
          <>
            {/* Selectors */}
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Lớp</label>
                <select value={effClassId} onChange={(e) => setClassId(e.target.value)} className={selectCls}>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">Học kỳ</label>
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
                  students={studentsForModal}
                  categories={categories}
                  onChanged={() => setAnalyticsRefresh((k) => k + 1)}
                />
              )}
              {activeTab === "conduct" && (
                <ConductTab
                  analytics={analytics} loading={aLoading} error={aError}
                  semesterId={Number(effSemesterId)}
                  onChanged={() => setAnalyticsRefresh((k) => k + 1)}
                />
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
