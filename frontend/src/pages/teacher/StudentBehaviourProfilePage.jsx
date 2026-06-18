import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FiArrowLeft, FiAward, FiMinusCircle, FiPlusCircle } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentBehaviour } from "../../hooks/useStudentBehaviour";

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#08509F", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };

function StatBox({ label, value, color = "#0F2747" }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function RecordList({ items, isMerit }) {
  if (!items.length) {
    return <p className="rounded-xl px-4 py-6 text-center text-sm text-slate-400" style={{ backgroundColor: "#FFF7F2" }}>Chưa có dữ liệu.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.behaviorId} className="flex items-start justify-between gap-3 rounded-xl px-4 py-3" style={{ border: "1px solid #FFE7D6" }}>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#0F2747]">{r.title}</p>
            {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
            <p className="mt-0.5 text-xs text-slate-400">
              {r.recordDate}{r.createdByName ? ` · ${r.createdByName}` : ""}
              {r.evidenceUrl && <> · <a href={r.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: "#08509F" }}>minh chứng</a></>}
            </p>
          </div>
          <span className="shrink-0 text-sm font-bold" style={{ color: isMerit ? "#16A34A" : "#DC2626" }}>
            {isMerit ? "+" : "-"}{r.points}
          </span>
        </div>
      ))}
    </div>
  );
}

function StudentBehaviourProfilePage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const semesterId = searchParams.get("semesterId") || "";

  const { data, loading, error } = useStudentBehaviour(studentId, semesterId);

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
  const cc = data?.currentConduct;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Học sinh"
      sidebarFooterValue={profile?.fullName ?? ""}
    >
      <button type="button" onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#0F2747]">
        <FiArrowLeft size={15} /> Quay lại
      </button>

      {loading && <div className="space-y-4"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="h-64 animate-pulse rounded-2xl bg-slate-100" /></div>}
      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {!loading && !error && data && profile && (
        <>
          {/* Profile header */}
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white" style={{ backgroundColor: "#08509F" }}>
              {profile.avatar ? <img src={profile.avatar} alt={profile.fullName} className="h-16 w-16 rounded-full object-cover" /> : (profile.fullName?.[0]?.toUpperCase() ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold" style={{ color: "#0F2747" }}>{profile.fullName}</h1>
              <p className="text-sm text-slate-500">{profile.studentCode} · {profile.className ?? "—"} · {profile.gradeName ?? ""}</p>
            </div>
            {data.semesters?.length > 0 && (
              <select value={data.targetSemesterId ?? ""} onChange={(e) => setSearchParams({ semesterId: e.target.value })}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]">
                {data.semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
              </select>
            )}
          </section>

          {/* Current conduct summary */}
          {cc && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox label="Điểm thưởng" value={`+${cc.meritPoints}`} color="#16A34A" />
              <StatBox label="Điểm trừ" value={`-${cc.demeritPoints}`} color="#DC2626" />
              <StatBox label="Hạnh kiểm" value={cc.finalScore} color="#F27123" />
              <StatBox label="Xếp loại" value={cc.grade?.label ?? "—"} color={GRADE_COLOR[cc.grade?.key] ?? "#0F2747"} />
            </div>
          )}

          {/* Merit + Demerit history */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#16A34A" }}><FiPlusCircle size={15} /> Lịch sử khen thưởng</h3>
              <RecordList items={data.merits} isMerit />
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#DC2626" }}><FiMinusCircle size={15} /> Lịch sử vi phạm</h3>
              <RecordList items={data.demerits} isMerit={false} />
            </div>
          </div>

          {/* Conduct history + teacher comments */}
          {data.conductHistory?.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#0F2747" }}><FiAward size={15} /> Lịch sử hạnh kiểm & nhận xét</h3>
              <div className="space-y-2">
                {data.conductHistory.map((h) => (
                  <div key={h.semesterId} className="rounded-xl px-4 py-3" style={{ border: "1px solid #FFE7D6" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#0F2747]">{h.semesterName} · {h.schoolYearName}</span>
                      <span className="text-sm font-bold" style={{ color: GRADE_COLOR[
                        h.finalScore >= 80 ? "TOT" : h.finalScore >= 65 ? "KHA" : h.finalScore >= 50 ? "TB" : "YEU"
                      ] }}>
                        {h.finalScore}/100 · {h.conductGrade}
                        {h.status === "APPROVED" ? "" : " (nháp)"}
                      </span>
                    </div>
                    {h.comment && <p className="mt-1 text-xs text-slate-600">{h.comment}</p>}
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

export default StudentBehaviourProfilePage;
