import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft, FiAward, FiCalendar, FiFlag, FiPlus, FiShield, FiUser,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import GoalFormModal from "../../components/organisms/GoalFormModal";
import GoalProgressModal from "../../components/organisms/GoalProgressModal";
import GoalEvaluationModal from "../../components/organisms/GoalEvaluationModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { studentProfileApi, goalApi } from "../../api/client";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { useStudentGoals } from "../../hooks/useStudentGoals";
import { useStudentAcademic } from "../../hooks/useStudentAcademic";
import { useStudentBehaviour } from "../../hooks/useStudentBehaviour";

const TABS = [
  { key: "overview",   label: "Tổng quan", icon: FiUser },
  { key: "academic",   label: "Học tập",   icon: FiAward },
  { key: "attendance", label: "Điểm danh", icon: FiCalendar },
  { key: "behaviour",  label: "Hạnh kiểm", icon: FiShield },
  { key: "goals",      label: "Mục tiêu",  icon: FiFlag },
];

const RISK_COLOR = { HIGH: "#DC2626", MEDIUM: "#F59E0B", LOW: "#F27123", NONE: "#16A34A" };
const GOAL_STATUS = {
  IN_PROGRESS: { label: "Đang thực hiện", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED:   { label: "Hoàn thành",     bg: "#ECFDF5", text: "#16A34A" },
  FAILED:      { label: "Chưa đạt",       bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:    { label: "Đã lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };

function StatBox({ label, value, color = "#0F2747", sub }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ data }) {
  const { profile, attendance, risk } = data;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="Chuyên cần" value={attendance.attendanceRate === null ? "—" : `${attendance.attendanceRate}%`} color="#F27123" sub={`${attendance.total} buổi`} />
        <StatBox label="Vắng KP" value={attendance.absentUnexcused} color="#DC2626" />
        <StatBox label="Đi muộn" value={attendance.late} color="#F59E0B" />
        <StatBox label="Mức rủi ro" value={risk.levelLabel} color={RISK_COLOR[risk.level]} />
      </div>

      {/* Risk panel */}
      <div className="rounded-2xl p-5 shadow-sm" style={{ border: `1px solid ${risk.level === "NONE" ? "#FFE7D6" : RISK_COLOR[risk.level]}`, backgroundColor: "#fff" }}>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: RISK_COLOR[risk.level] }}>
          <FiShield size={15} /> Cảnh báo rủi ro: {risk.levelLabel}
        </h3>
        {risk.reasons.length === 0 ? (
          <p className="text-sm text-slate-500">Không có dấu hiệu rủi ro nổi bật.</p>
        ) : (
          <>
            <ul className="mb-3 list-inside list-disc space-y-1 text-sm text-slate-600">
              {risk.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Đề xuất</p>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
              {risk.actions.map((a, i) => <li key={i}>{a}</li>)}
            </ul>
          </>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(risk.domains).map(([k, d]) => (
            <span key={k} className="rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "#FFF7F2", color: RISK_COLOR[d.level] }}>
              {k === "attendance" ? "Chuyên cần" : k === "academic" ? "Học tập" : "Hạnh kiểm"}: {d.label}
            </span>
          ))}
        </div>
      </div>

      {/* Personal + enrollment */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Thông tin cá nhân</h3>
          <dl className="space-y-2 text-sm">
            {[
              ["Mã học sinh", profile.studentCode],
              ["Giới tính", profile.gender === "MALE" ? "Nam" : profile.gender === "FEMALE" ? "Nữ" : "Khác"],
              ["Ngày sinh", profile.dateOfBirth ?? "—"],
              ["Địa chỉ", profile.address ?? "—"],
              ["Lớp", `${profile.className ?? "—"} · ${profile.gradeName ?? ""}`],
              ["Năm học", profile.schoolYearName ?? "—"],
              ["Ngày nhập học", profile.enrollmentDate ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-slate-400">{k}</dt>
                <dd className="text-right font-medium text-[#0F2747]">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Người giám hộ / Liên hệ</h3>
          {profile.guardians.length === 0 ? (
            <p className="text-sm text-slate-400">Chưa có thông tin phụ huynh.</p>
          ) : (
            <div className="space-y-3">
              {profile.guardians.map((g) => (
                <div key={g.parentId} className="rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7F2" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#0F2747]">{g.fullName}</span>
                    {g.isPrimary && <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>Liên hệ chính</span>}
                  </div>
                  <p className="text-xs text-slate-500">{g.relationship ?? "—"} · {g.phone ?? "—"}{g.email ? ` · ${g.email}` : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Academic Tab (reuses academic endpoint) ──────────────────────────────────

function AcademicTab({ studentId, semesterId }) {
  const { data, loading, error } = useStudentAcademic(studentId, semesterId);
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;
  const c = data.current;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBox label="GPA học kỳ" value={c?.gpa ?? "—"} color="#F27123" />
        <StatBox label="Xếp loại" value={c?.standing?.label ?? "—"} color="#08509F" />
        <StatBox label="Xếp hạng" value={data.ranking?.rank ? `#${data.ranking.rank}` : "—"} sub={data.ranking?.totalRanked ? `/${data.ranking.totalRanked}` : ""} color="#0F2747" />
        <StatBox label="Môn chưa đạt" value={c?.failedCount ?? 0} color={(c?.failedCount ?? 0) > 0 ? "#DC2626" : "#16A34A"} />
      </div>
      {c?.subjects?.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <table className="min-w-full text-sm">
            <thead><tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
              {["MÔN", "ĐIỂM TB", "KẾT QUẢ"].map((h, i) => <th key={i} className="px-4 py-2.5 text-xs font-bold uppercase" style={{ color: "#F27123" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {c.subjects.map((s, idx) => (
                <tr key={s.subjectId} className="border-b last:border-b-0" style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 ? "#FAFAFA" : "#fff" }}>
                  <td className="px-4 py-2.5 font-medium text-[#0F2747]">{s.subjectName}</td>
                  <td className="px-4 py-2.5 font-semibold text-[#0F2747]">{s.average ?? "—"}</td>
                  <td className="px-4 py-2.5">{s.passed === null ? "—" : (
                    <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={s.passed ? { backgroundColor: "#ECFDF5", color: "#16A34A" } : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                      {s.passed ? "Đạt" : "Chưa đạt"}
                    </span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.semesterSummaries?.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Lịch sử GPA</h3>
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {[...data.semesterSummaries].reverse().filter((s) => s.gpa !== null).map((s) => (
              <div key={s.semesterId} className="flex flex-col items-center gap-1" style={{ minWidth: 64 }}>
                <span className="text-xs font-bold text-[#0F2747]">{s.gpa}</span>
                <div className="flex h-24 w-7 items-end overflow-hidden rounded-lg bg-slate-100">
                  <div className="w-full rounded-lg" style={{ height: `${(s.gpa / 10) * 100}%`, backgroundColor: "#F27123" }} />
                </div>
                <span className="text-center text-[10px] text-slate-500">{s.semesterName}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ studentId, semesterId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let m = true;
    setLoading(true); setError("");
    studentProfileApi.getAttendance(studentId, semesterId)
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [studentId, semesterId]);

  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;
  const s = data.summary;
  const maxRate = 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatBox label="Tỷ lệ chuyên cần" value={s.attendanceRate === null ? "—" : `${s.attendanceRate}%`} color="#F27123" />
        <StatBox label="Có mặt" value={s.present} color="#16A34A" />
        <StatBox label="Đi muộn" value={s.late} color="#F59E0B" />
        <StatBox label="Vắng có phép" value={s.absentExcused} color="#08509F" />
        <StatBox label="Vắng không phép" value={s.absentUnexcused} color="#DC2626" />
      </div>

      {data.monthly?.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-4 text-sm font-bold" style={{ color: "#0F2747" }}>Tỷ lệ chuyên cần theo tháng</h3>
          <div className="flex items-end gap-4 overflow-x-auto pb-2">
            {data.monthly.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-1" style={{ minWidth: 56 }}>
                <span className="text-xs font-bold text-[#0F2747]">{m.rate}%</span>
                <div className="flex h-24 w-7 items-end overflow-hidden rounded-lg bg-slate-100">
                  <div className="w-full rounded-lg" style={{ height: `${(m.rate / maxRate) * 100}%`, backgroundColor: m.rate >= 90 ? "#16A34A" : m.rate >= 75 ? "#F59E0B" : "#DC2626" }} />
                </div>
                <span className="text-[10px] text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Behaviour Tab (reuses behaviour endpoint) ────────────────────────────────

function BehaviourTab({ studentId, semesterId }) {
  const { data, loading, error } = useStudentBehaviour(studentId, semesterId);
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100" />;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;
  if (!data) return null;
  const cc = data.currentConduct;

  return (
    <div className="space-y-5">
      {cc && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatBox label="Điểm thưởng" value={`+${cc.meritPoints}`} color="#16A34A" />
          <StatBox label="Điểm trừ" value={`-${cc.demeritPoints}`} color="#DC2626" />
          <StatBox label="Hạnh kiểm" value={cc.finalScore} color="#F27123" />
          <StatBox label="Xếp loại" value={cc.grade?.label ?? "—"} color="#08509F" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#16A34A" }}>Khen thưởng gần đây</h3>
          {data.merits.length === 0 ? <p className="text-sm text-slate-400">Chưa có.</p> : (
            <div className="space-y-2">{data.merits.slice(0, 5).map((r) => (
              <div key={r.behaviorId} className="flex justify-between gap-2 text-sm"><span className="text-[#0F2747]">{r.title}</span><span className="font-bold" style={{ color: "#16A34A" }}>+{r.points}</span></div>
            ))}</div>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
          <h3 className="mb-3 text-sm font-bold" style={{ color: "#DC2626" }}>Vi phạm gần đây</h3>
          {data.demerits.length === 0 ? <p className="text-sm text-slate-400">Chưa có.</p> : (
            <div className="space-y-2">{data.demerits.slice(0, 5).map((r) => (
              <div key={r.behaviorId} className="flex justify-between gap-2 text-sm"><span className="text-[#0F2747]">{r.title}</span><span className="font-bold" style={{ color: "#DC2626" }}>-{r.points}</span></div>
            ))}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Goals Tab ────────────────────────────────────────────────────────────────

function GoalsTab({ studentId, goalTypes }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: goals, loading, error } = useStudentGoals(studentId, {}, refreshKey);
  const [formModal, setFormModal] = useState(null);  // { mode, goal? }
  const [progressGoal, setProgressGoal] = useState(null);
  const [evalGoal, setEvalGoal] = useState(null);

  async function handleArchive(goal) {
    const note = window.prompt("Lý do lưu trữ mục tiêu? (tùy chọn)") ?? "";
    if (note === null) return;
    try { await goalApi.archive(goal.goalId, note || null); setRefreshKey((k) => k + 1); }
    catch (err) { alert(err.message); }
  }

  function refresh() { setRefreshKey((k) => k + 1); }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={() => setFormModal({ mode: "create" })}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
          <FiPlus size={15} /> Tạo mục tiêu
        </button>
      </div>

      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && goals && (
        !goals.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Chưa có mục tiêu nào. Nhấn "Tạo mục tiêu" để bắt đầu.
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => {
              const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.IN_PROGRESS;
              const editable = g.status !== "ARCHIVED";
              const active = g.status === "IN_PROGRESS";
              return (
                <div key={g.goalId} className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{GOAL_TYPE_LABEL[g.goalType] ?? g.goalType}</span>
                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                      </div>
                      <h4 className="mt-1.5 text-sm font-bold text-[#0F2747]">{g.title}</h4>
                      {g.description && <p className="text-xs text-slate-500">{g.description}</p>}
                      {g.targetDate && <p className="mt-0.5 text-xs text-slate-400">Hạn: {g.targetDate}</p>}
                    </div>
                  </div>

                  {/* progress bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Tiến độ</span><span className="font-semibold">{g.progress}%</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: g.status === "FAILED" ? "#DC2626" : g.status === "COMPLETED" ? "#16A34A" : "#F27123" }} />
                    </div>
                  </div>

                  {g.finalComment && (
                    <p className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="font-semibold">Đánh giá: </span>{g.finalComment}
                    </p>
                  )}

                  {editable && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {active && (
                        <>
                          <button type="button" onClick={() => setProgressGoal(g)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#08509F" }}>Cập nhật tiến độ</button>
                          <button type="button" onClick={() => setEvalGoal(g)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ backgroundColor: "#16A34A" }}>Đánh giá</button>
                          <button type="button" onClick={() => setFormModal({ mode: "edit", goal: g })} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>Sửa</button>
                        </>
                      )}
                      <button type="button" onClick={() => handleArchive(g)} className="rounded-lg px-3 py-1.5 text-xs font-medium" style={{ backgroundColor: "#F1F5F9", color: "#475569" }}>Lưu trữ</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {formModal && (
        <GoalFormModal mode={formModal.mode} studentId={studentId} goal={formModal.goal} goalTypes={goalTypes}
          onClose={() => setFormModal(null)} onSaved={() => { setFormModal(null); refresh(); }} />
      )}
      {progressGoal && (
        <GoalProgressModal goal={progressGoal} onClose={() => setProgressGoal(null)} onSaved={() => { setProgressGoal(null); refresh(); }} />
      )}
      {evalGoal && (
        <GoalEvaluationModal goal={evalGoal} onClose={() => setEvalGoal(null)} onSaved={() => { setEvalGoal(null); refresh(); }} />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function StudentProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterId = searchParams.get("semesterId") || "";
  const activeTab = searchParams.get("tab") || "overview";

  const { data, loading, error } = useStudentProfile(studentId, semesterId);
  const [goalTypes, setGoalTypes] = useState([]);

  useEffect(() => {
    let m = true;
    goalApi.getTypes().then((res) => { if (m) setGoalTypes(res.data); }).catch(() => {});
    return () => { m = false; };
  }, []);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const profile = data?.profile;
  const effSemesterId = data?.targetSemesterId ? String(data.targetSemesterId) : semesterId;

  function setTab(key) {
    const next = { tab: key };
    if (effSemesterId) next.semesterId = effSemesterId;
    setSearchParams(next);
  }
  function changeSemester(value) {
    setSearchParams({ tab: activeTab, semesterId: value });
  }

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Học sinh"
      sidebarFooterValue={profile?.fullName ?? ""}
    >
      <button type="button" onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]">
        <FiArrowLeft size={15} /> Quay lại
      </button>

      {loading && <div className="space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && profile && (
        <>
          {/* Header */}
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: "#08509F" }}>
              {profile.avatar ? <img src={profile.avatar} alt={profile.fullName} className="h-16 w-16 rounded-full object-cover" /> : (profile.fullName?.[0]?.toUpperCase() ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>{profile.fullName}</h1>
              <p className="text-sm text-slate-500">{profile.studentCode} · {profile.className ?? "—"} · {profile.gradeName ?? ""}</p>
            </div>
            {data.semesters?.length > 0 && (
              <select value={effSemesterId} onChange={(e) => changeSemester(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]">
                {data.semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
              </select>
            )}
          </section>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className="flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition"
                style={activeTab === key ? { backgroundColor: "#F27123", color: "#fff" } : { color: "#64748B" }}>
                <Icon size={15} /><span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6" }}>
            {activeTab === "overview"   && <OverviewTab data={data} />}
            {activeTab === "academic"   && <AcademicTab studentId={studentId} semesterId={effSemesterId} />}
            {activeTab === "attendance" && <AttendanceTab studentId={studentId} semesterId={effSemesterId} />}
            {activeTab === "behaviour"  && <BehaviourTab studentId={studentId} semesterId={effSemesterId} />}
            {activeTab === "goals"      && <GoalsTab studentId={studentId} goalTypes={goalTypes} />}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default StudentProfilePage;
