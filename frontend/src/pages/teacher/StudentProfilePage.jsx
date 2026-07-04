import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  FiArrowLeft, FiAward, FiCalendar, FiFlag, FiShield, FiUser,
} from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { studentProfileApi } from "../../api/client";
import { useStudentProfile } from "../../hooks/useStudentProfile";
import { useStudentGoals } from "../../hooks/useStudentGoals";
import { useStudentAcademic } from "../../hooks/useStudentAcademic";
import { useStudentBehaviour } from "../../hooks/useStudentBehaviour";
import { formatDateVN } from "../../utils/datetime";

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
    <div className="rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
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
              ["Ngày sinh", profile.dateOfBirth ? formatDateVN(profile.dateOfBirth) : "—"],
              ["Địa chỉ", profile.address ?? "—"],
              ["Lớp", `${profile.className ?? "—"} · ${profile.gradeName ?? ""}`],
              ["Năm học", profile.schoolYearName ?? "—"],
              ["Ngày nhập học", profile.enrollmentDate ? formatDateVN(profile.enrollmentDate) : "—"],
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

// ─── GPA trend chart (SVG line chart) ─────────────────────────────────────────

function GpaTrendChart({ history }) {
  const stepX = 88, padX = 38, padTop = 26, chartH = 120, padBottom = 26;
  const n = history.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (gpa) => padTop + (1 - Math.min(gpa, 10) / 10) * chartH;
  const linePts = history.map((s, i) => `${x(i)},${y(s.gpa)}`).join(" ");
  const areaPath = n
    ? `M ${x(0)},${baseY} ${history.map((s, i) => `L ${x(i)},${y(s.gpa)}`).join(" ")} L ${x(n - 1)},${baseY} Z`
    : "";

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Lịch sử GPA</h3>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {[0, 2.5, 5, 7.5, 10].map((g) => (
            <g key={g}>
              <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
              <text x={padX - 12} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}</text>
            </g>
          ))}
          {n > 1 && <path d={areaPath} fill="rgba(242,113,35,0.10)" />}
          {n > 1 && <polyline points={linePts} fill="none" stroke="#F27123" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {history.map((s, i) => (
            <g key={s.semesterId}>
              <circle cx={x(i)} cy={y(s.gpa)} r="4.5" fill="#fff" stroke="#F27123" strokeWidth="2.5" />
              <text x={x(i)} y={y(s.gpa) - 11} fontSize="11" fontWeight="700" fill="#0F2747" textAnchor="middle">{s.gpa}</text>
              <text x={x(i)} y={baseY + 17} fontSize="9" fill="#64748B" textAnchor="middle">{s.semesterName}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ─── Academic Tab (reuses academic endpoint) ──────────────────────────────────

function AcademicTab({ studentId, semesterId, semesters = [] }) {
  const [sem, setSem] = useState(semesterId);
  const { data, loading, error } = useStudentAcademic(studentId, sem);

  const c = data?.current;
  const gpaHistory = useMemo(
    () => (data?.semesterSummaries ? [...data.semesterSummaries].filter((s) => s.gpa !== null).reverse() : []),
    [data],
  );

  return (
    <div className="space-y-5">
      {semesters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Học kỳ:</label>
          <select value={sem} onChange={(e) => setSem(e.target.value)}
            className="rounded-lg border border-[#FFE7D6] bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]">
            {semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
          </select>
        </div>
      )}

      {loading && <div className="h-48 animate-pulse rounded-xl bg-slate-100" />}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && (
        <>
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
                    <tr key={s.subjectId} className="border-b last:border-b-0 transition hover:bg-[#FFF7F2]" style={{ borderColor: "#FFF7F2" }}>
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

          {gpaHistory.length > 0 && <GpaTrendChart history={gpaHistory} />}
        </>
      )}
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function MonthlyAttendanceChart({ monthly }) {
  const stepX = 72, padX = 40, padTop = 24, chartH = 130, padBottom = 28;
  const n = monthly.length;
  const W = padX * 2 + Math.max(1, n - 1) * stepX;
  const H = padTop + chartH + padBottom;
  const baseY = padTop + chartH;
  const x = (i) => padX + i * stepX;
  const y = (rate) => padTop + (1 - Math.min(rate, 100) / 100) * chartH;
  const linePts = monthly.map((m, i) => `${x(i)},${y(m.rate)}`).join(" ");
  const areaPath = n
    ? `M ${x(0)},${baseY} ${monthly.map((m, i) => `L ${x(i)},${y(m.rate)}`).join(" ")} L ${x(n - 1)},${baseY} Z`
    : "";
  const dotColor = (rate) => (rate >= 90 ? "#16A34A" : rate >= 75 ? "#F59E0B" : "#DC2626");

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <h3 className="mb-3 text-sm font-bold" style={{ color: "#0F2747" }}>Tỷ lệ chuyên cần theo tháng</h3>
      <div className="overflow-x-auto">
        <svg width={W} height={H} className="block">
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line x1={padX - 6} y1={y(g)} x2={W - padX + 6} y2={y(g)} stroke="#F1F5F9" strokeWidth="1" />
              <text x={padX - 12} y={y(g) + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{g}%</text>
            </g>
          ))}
          {n > 1 && <path d={areaPath} fill="rgba(242,113,35,0.10)" />}
          {n > 1 && <polyline points={linePts} fill="none" stroke="#F27123" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
          {monthly.map((m, i) => (
            <g key={m.month}>
              <circle cx={x(i)} cy={y(m.rate)} r="4.5" fill="#fff" stroke={dotColor(m.rate)} strokeWidth="2.5" />
              <text x={x(i)} y={y(m.rate) - 11} fontSize="11" fontWeight="700" fill="#0F2747" textAnchor="middle">{m.rate}%</text>
              <text x={x(i)} y={baseY + 17} fontSize="9" fill="#64748B" textAnchor="middle">{m.month}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatBox label="Tỷ lệ chuyên cần" value={s.attendanceRate === null ? "—" : `${s.attendanceRate}%`} color="#F27123" />
        <StatBox label="Có mặt" value={s.present} color="#16A34A" />
        <StatBox label="Đi muộn" value={s.late} color="#F59E0B" />
        <StatBox label="Vắng có phép" value={s.absentExcused} color="#08509F" />
        <StatBox label="Vắng không phép" value={s.absentUnexcused} color="#DC2626" />
      </div>

      {data.monthly?.length > 0 && <MonthlyAttendanceChart monthly={data.monthly} />}
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
          <StatBox label="Điểm rèn luyện" value={cc.finalScore} color="#0F2747" />
          <StatBox label="Hạnh kiểm" value={cc.grade?.label ?? "—"} color="#F27123" />
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

function GoalsTab({ studentId }) {
  const { data: goals, loading, error } = useStudentGoals(studentId, {});

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
        <FiFlag size={14} className="mt-0.5 shrink-0" />
        <span>Mục tiêu do học sinh tự thiết lập. Giáo viên theo dõi tiến độ và kết quả tại đây.</span>
      </div>

      {loading && <div className="space-y-2">{[0,1,2].map((n) => <div key={n} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && goals && (
        !goals.length ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
            Học sinh chưa thiết lập mục tiêu nào.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {goals.map((g) => {
              const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.IN_PROGRESS;
              const barColor = g.status === "FAILED" ? "#DC2626" : g.status === "COMPLETED" ? "#16A34A" : "#F27123";
              return (
                <div key={g.goalId} className="flex flex-col rounded-2xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>{GOAL_TYPE_LABEL[g.goalType] ?? g.goalType}</span>
                    <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                    {g.targetDate && <span className="ml-auto text-xs text-slate-400">Hạn: {formatDateVN(g.targetDate)}</span>}
                  </div>
                  <h4 className="text-sm font-bold text-[#0F2747]">{g.title}</h4>
                  {g.description && <p className="mt-0.5 text-xs text-slate-500">{g.description}</p>}

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Tiến độ</span><span className="font-semibold" style={{ color: barColor }}>{g.progress}%</span></div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${g.progress}%`, backgroundColor: barColor }} />
                    </div>
                  </div>

                  {g.teacherRemark && (
                    <p className="mt-3 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#FFF7F2" }}>
                      <span className="font-semibold">GV nhận xét: </span>{g.teacherRemark}
                    </p>
                  )}
                  {g.finalComment && (
                    <p className="mt-2 rounded-lg px-3 py-2 text-xs text-slate-600" style={{ backgroundColor: "#ECFDF5" }}>
                      <span className="font-semibold">Đánh giá cuối: </span>{g.finalComment}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )
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
                className="rounded-lg border border-[#FFE7D6] bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]">
                {data.semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
              </select>
            )}
          </section>

          {/* Tabs */}
          <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-[#FFE7D6] bg-white p-1 shadow-sm">
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
            {activeTab === "academic"   && <AcademicTab studentId={studentId} semesterId={effSemesterId} semesters={data.semesters ?? []} />}
            {activeTab === "attendance" && <AttendanceTab studentId={studentId} semesterId={effSemesterId} />}
            {activeTab === "behaviour"  && <BehaviourTab studentId={studentId} semesterId={effSemesterId} />}
            {activeTab === "goals"      && <GoalsTab studentId={studentId} />}
          </div>
        </>
      )}
    </DashboardShell>
  );
}

export default StudentProfilePage;
