import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FiAward,
  FiBarChart2,
  FiClipboard,
  FiMinusCircle,
  FiPlusCircle,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useParentStudents } from "../../hooks/useParentStudents";
import { useParentBehaviourSemesters } from "../../hooks/useParentBehaviourSemesters";
import { useParentBehaviourRecords } from "../../hooks/useParentBehaviourRecords";
import { useParentBehaviourConduct } from "../../hooks/useParentBehaviourConduct";

const TABS = [
  { key: "records",  label: "Ghi nhận",  icon: FiClipboard },
  { key: "conduct",  label: "Hạnh kiểm", icon: FiAward },
  { key: "analytics", label: "Phân tích", icon: FiBarChart2 },
];

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#08509F", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

// ─── Records Tab ──────────────────────────────────────────────────────────────

function RecordsTab({ studentId, semester }) {
  const [behaviorType, setBehaviorType] = useState("POSITIVE");

  const filters = useMemo(
    () => ({
      behaviorType,
      startDate: semester?.startDate,
      endDate:   semester?.endDate,
      page: 1,
      limit: 50,
    }),
    [behaviorType, semester?.startDate, semester?.endDate],
  );

  const { data, loading, error } = useParentBehaviourRecords(studentId, filters, Boolean(studentId));
  const isMerit = behaviorType === "POSITIVE";

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
      </div>

      {loading && <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        !data.items.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Chưa có bản ghi {isMerit ? "khen thưởng" : "kỷ luật"} nào trong kỳ này.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                    {["NỘI DUNG", "ĐIỂM", "NGÀY", "GV GHI"].map((c, i) => (
                      <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r, idx) => (
                    <tr key={r.behaviorId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0F2747]">{r.title}</div>
                        {r.description && <div className="text-xs text-slate-400">{r.description}</div>}
                        {r.evidenceUrl && (
                          <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs font-medium" style={{ color: "#08509F" }}>Xem minh chứng</a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold" style={{ color: isMerit ? "#16A34A" : "#DC2626" }}>
                          {isMerit ? "+" : "-"}{Math.abs(r.points)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{r.recordDate}</td>
                      <td className="px-4 py-3 text-slate-500">{r.createdByName ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ─── Conduct Tab ──────────────────────────────────────────────────────────────

function ConductTab({ studentId, semesterId }) {
  const { data, loading, error } = useParentBehaviourConduct(studentId, semesterId);

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data)   return null;

  const { computed, existing } = data;
  const gradeColor = GRADE_COLOR[computed.grade.key] ?? "#64748B";

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-2xl bg-white p-6 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#F27123" }}>Tổng kết hạnh kiểm</p>
            <p className="mt-1 text-4xl font-bold" style={{ color: "#0F2747" }}>{computed.finalScore}<span className="ml-1 text-lg text-slate-400">/100</span></p>
          </div>
          <span className="rounded-2xl px-5 py-2 text-lg font-bold" style={{ backgroundColor: gradeColor + "22", color: gradeColor }}>
            {computed.grade.label}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ backgroundColor: "#ECFDF5" }}>
            <p className="text-xs font-medium text-slate-500">Điểm gốc</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#0F2747" }}>{computed.base}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "#ECFDF5" }}>
            <p className="text-xs font-medium text-slate-500">Điểm thưởng</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#16A34A" }}>+{computed.meritPoints}</p>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: "#FEF2F2" }}>
            <p className="text-xs font-medium text-slate-500">Điểm trừ</p>
            <p className="mt-1 text-2xl font-bold" style={{ color: "#DC2626" }}>-{Math.abs(computed.demeritPoints)}</p>
          </div>
        </div>
        {computed.adjustment !== 0 && (
          <p className="mt-3 text-xs text-slate-400">Điều chỉnh thủ công: {computed.adjustment > 0 ? "+" : ""}{computed.adjustment}</p>
        )}
      </div>

      {/* Existing evaluation (if any) */}
      {existing && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#F27123" }}>Nhận xét của giáo viên</p>
          <p className="text-sm text-[#0F2747]">{existing.comment}</p>
          <p className="mt-2 text-xs text-slate-400">
            Trạng thái: <span className="font-semibold">{existing.status === "APPROVED" ? "Đã duyệt" : "Bản nháp"}</span>
            {existing.updatedAt && ` · Cập nhật: ${existing.updatedAt}`}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ studentId, semesterId }) {
  const { data, loading, error } = useParentBehaviourConduct(studentId, semesterId);

  if (loading) return <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">{[0,1,2,3].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  if (error)   return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data)   return null;

  const agg = data.aggregate;

  const stats = [
    { label: "Điểm hạnh kiểm", value: data.computed.finalScore, color: "#08509F" },
    { label: "Số lần khen thưởng", value: agg.meritCount, color: "#16A34A" },
    { label: "Số lần vi phạm", value: agg.violationCount, color: "#DC2626" },
    { label: "Điểm thưởng tích lũy", value: `+${agg.meritPoints}`, color: "#16A34A" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            <p className="mb-1 text-xs font-medium text-slate-500">{s.label}</p>
            <p className="text-2xl font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {agg.demeritPoints > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <p className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Tổng điểm trừ trong kỳ</p>
          <p className="text-3xl font-bold" style={{ color: "#DC2626" }}>-{Math.abs(agg.demeritPoints)}</p>
          <p className="mt-1 text-xs text-slate-400">từ {agg.violationCount} lần vi phạm</p>
        </div>
      )}

      {agg.meritPoints === 0 && agg.demeritPoints === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          Chưa có dữ liệu hành vi trong kỳ này.
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function StudentBehaviour() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "records";

  const { students, loading: studentsLoading } = useParentStudents();

  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedSemesterId, setSelectedSemesterId] = useState("");

  const effStudentId = selectedStudentId || (students[0]?.studentId ? String(students[0].studentId) : "");
  const activeStudent = students.find((s) => String(s.studentId) === effStudentId) ?? null;

  const { data: semesters, loading: semestersLoading } = useParentBehaviourSemesters(effStudentId);

  const effSemesterId = selectedSemesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");
  const effSemester   = semesters.find((s) => String(s.semesterId) === effSemesterId);

  const headerUser = useMemo(() => ({
    name:   user?.fullName ?? user?.username ?? "Phụ huynh",
    role:   "Phụ huynh",
    avatar: user?.avatar ?? "",
  }), [user]);

  function setTab(key) { setSearchParams({ tab: key }); }

  function selectStudent(id) {
    setSelectedStudentId(String(id));
    setSelectedSemesterId("");
  }

  return (
    <DashboardShell user={headerUser} menuItems={dashboardNavigation.PARENT}>
      <section className="mb-6 overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6 px-6 py-6 lg:px-8">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Theo dõi học sinh</p>
            <h1 className="mb-1 text-3xl font-bold" style={{ color: "#0F2747" }}>Hạnh kiểm</h1>
            <p className="text-sm text-slate-500">Xem kết quả khen thưởng, kỷ luật và hạnh kiểm của con trong từng học kỳ.</p>
          </div>
        </div>
      </section>

      {studentsLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : students.length === 0 ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>
          Không tìm thấy thông tin học sinh.
        </div>
      ) : (
        <>
          {/* Student pill selector — only when >1 child */}
          {students.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.studentId}
                  type="button"
                  onClick={() => selectStudent(s.studentId)}
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={
                    String(s.studentId) === effStudentId
                      ? { backgroundColor: "#08509F", color: "#fff" }
                      : { border: "1px solid #e2e8f0", backgroundColor: "#fff", color: "#475569" }
                  }
                >
                  {s.studentFullName}
                  {s.className && <span className="ml-1.5 opacity-70">· {s.className}</span>}
                </button>
              ))}
            </div>
          )}

          {/* Student info banner */}
          {activeStudent && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
              {activeStudent.studentAvatar ? (
                <img src={activeStudent.studentAvatar} alt={activeStudent.studentFullName}
                  className="h-9 w-9 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#08509F] text-sm font-bold text-white">
                  {activeStudent.studentFullName?.[0] ?? "?"}
                </div>
              )}
              <div>
                <span className="text-sm font-semibold" style={{ color: "#0F2747" }}>{activeStudent.studentFullName}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {activeStudent.studentCode}
                  {activeStudent.className && ` · ${activeStudent.className}`}
                  {activeStudent.relationship && ` · ${activeStudent.relationship}`}
                </span>
              </div>
            </div>
          )}

          {/* Semester selector */}
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Học kỳ</label>
              <select value={effSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)} className={selectCls}
                disabled={semestersLoading || semesters.length === 0}>
                {semestersLoading
                  ? <option>Đang tải...</option>
                  : semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)
                }
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
              <RecordsTab studentId={effStudentId} semester={effSemester} />
            )}
            {activeTab === "conduct" && (
              <ConductTab studentId={effStudentId} semesterId={effSemesterId} />
            )}
            {activeTab === "analytics" && (
              <AnalyticsTab studentId={effStudentId} semesterId={effSemesterId} />
            )}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default StudentBehaviour;
