import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentAcademic } from "../../hooks/useStudentAcademic";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const STANDING_COLOR = {
  GIOI: "#16A34A", KHA: "#225DAD", TB: "#F59E0B", YEU: "#F27123", KEM: "#DC2626", NA: "#64748B",
};

function StatBox({ label, value, sub, color = C.onSurface }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <p className="mb-1 text-xs font-medium" style={{ color: C.muted }}>{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function StudentAcademicProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterId = searchParams.get("semesterId") || "";

  const { data, loading, error } = useStudentAcademic(studentId, semesterId);

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

  const profile = data?.profile;
  const current = data?.current;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Học sinh"
      sidebarFooterValue={profile?.fullName ?? ""}
    >
      <button type="button" onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1A1C1C]">
        <Ms name="arrow_back" className="!text-[18px]" /> Quay lại
      </button>

      {loading && (
        <div className="space-y-4">
          <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
          <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
        </div>
      )}

      {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && profile && (
        <>
          {/* Profile header */}
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl p-5 shadow-sm sm:p-6" style={{ border: `1px solid ${C.border}`, backgroundColor: "#fff" }}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: C.deepBlue }}>
              {profile.avatar ? <img src={profile.avatar} alt={profile.fullName} className="h-16 w-16 rounded-full object-cover" /> : (profile.fullName?.[0]?.toUpperCase() ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold" style={{ color: C.onSurface }}>{profile.fullName}</h1>
              <p className="text-sm text-slate-500">{profile.studentCode} · {profile.className ?? "—"} · {profile.gradeName ?? ""}</p>
            </div>
            {/* Semester selector */}
            {data.semesters?.length > 0 && (
              <select
                value={data.targetSemesterId ?? ""}
                onChange={(e) => setSearchParams({ semesterId: e.target.value })}
                className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]"
                style={{ borderColor: C.border, color: C.onSurface }}
              >
                {data.semesters.map((s) => (
                  <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>
                ))}
              </select>
            )}
          </section>

          {/* Current-semester summary */}
          {!current ? (
            <div className="rounded-3xl border-dashed px-4 py-3 text-sm" style={{ border: `1px dashed ${C.border}`, backgroundColor: C.surfaceLow, color: C.onSurface }}>
              Chưa có điểm trong học kỳ này.
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatBox label="GPA học kỳ" value={current.gpa ?? "—"} color={C.orange} />
                <StatBox label="Xếp loại" value={current.standing?.label ?? "—"} color={STANDING_COLOR[current.standing?.key] ?? C.onSurface} />
                <StatBox
                  label="Xếp hạng lớp"
                  value={data.ranking?.rank ? `#${data.ranking.rank}` : "—"}
                  sub={data.ranking?.totalRanked ? `/${data.ranking.totalRanked} HS` : ""}
                  color={C.secondary}
                />
                <StatBox label="Môn trượt" value={current.failedCount} color={current.failedCount > 0 ? "#DC2626" : "#16A34A"} />
              </div>

              {/* Subject results */}
              <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <div className="border-b px-5 py-3" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>
                  <h3 className="text-sm font-bold" style={{ color: C.onSurface }}>Kết quả theo môn</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-white" style={{ backgroundColor: C.deepBlue }}>
                      <tr className="text-left">
                        {["MÔN HỌC", "ĐIỂM TB (thang 10)", "KẾT QUẢ"].map((c, i) => (
                          <th key={i} className="px-4 py-3 text-xs font-medium uppercase tracking-wider">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: C.border }}>
                      {current.subjects.map((sub) => (
                        <tr key={sub.subjectId} className="transition hover:bg-[#F3F3F3]">
                          <td className="px-4 py-2.5 font-medium" style={{ color: C.onSurface }}>{sub.subjectName}</td>
                          <td className="px-4 py-2.5 font-semibold" style={{ color: C.onSurface }}>{sub.average ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            {sub.passed === null ? <span className="text-slate-400">—</span> : (
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={sub.passed ? { backgroundColor: "#ECFDF5", color: "#16A34A" } : { backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                                {sub.passed ? "Đạt" : "Chưa đạt"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Yearly results */}
          {data.yearlyResults?.length > 0 && (
            <div className="mb-6 rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}>
                <Ms name="workspace_premium" className="!text-[18px]" style={{ color: C.orange }} /> Kết quả theo năm học
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {data.yearlyResults.map((y) => (
                  <div key={y.schoolYearName} className="flex items-center justify-between rounded-3xl px-4 py-3" style={{ backgroundColor: C.surfaceLow, border: `1px solid ${C.border}` }}>
                    <span className="text-sm font-medium" style={{ color: C.onSurface }}>{y.schoolYearName}</span>
                    <span className="text-sm font-bold" style={{ color: STANDING_COLOR[y.standing?.key] ?? C.onSurface }}>
                      GPA {y.gpa} · {y.standing?.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All-semester history */}
          {data.semesterSummaries?.length > 0 && (
            <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}>
                <Ms name="trending_up" className="!text-[18px]" style={{ color: C.secondary }} /> Lịch sử các học kỳ
              </h3>
              <div className="space-y-2">
                {data.semesterSummaries.map((s) => (
                  <div key={s.semesterId} className="flex items-center justify-between rounded-3xl px-4 py-2.5" style={{ border: `1px solid ${C.border}` }}>
                    <div>
                      <span className="text-sm font-medium" style={{ color: C.onSurface }}>{s.semesterName}</span>
                      <span className="ml-2 text-xs text-slate-400">{s.schoolYearName}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold" style={{ color: STANDING_COLOR[s.standing?.key] ?? C.onSurface }}>GPA {s.gpa ?? "—"}</span>
                      <span className="ml-2 text-xs text-slate-500">{s.standing?.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentAcademicProfilePage;
