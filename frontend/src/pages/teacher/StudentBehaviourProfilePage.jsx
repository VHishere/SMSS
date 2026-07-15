import { useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useStudentBehaviour } from "../../hooks/useStudentBehaviour";
import { formatDateVN } from "../../utils/datetime";

const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

const GRADE_COLOR = { TOT: "#16A34A", KHA: "#225DAD", TB: "#F59E0B", YEU: "#DC2626", NA: "#64748B" };

function StatBox({ label, value, color = C.onSurface }) {
  return (
    <div className="rounded-3xl bg-white p-4 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
      <p className="mb-1 text-xs font-medium" style={{ color: C.muted }}>{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function RecordList({ items, isMerit }) {
  if (!items.length) {
    return <p className="rounded-3xl border border-dashed px-4 py-6 text-center text-sm text-slate-400" style={{ borderColor: C.border, backgroundColor: C.surfaceLow }}>Chưa có dữ liệu.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.behaviorId} className="flex items-start justify-between gap-3 rounded-3xl px-4 py-3" style={{ border: `1px solid ${C.border}` }}>
          <div className="min-w-0">
            <p className="text-sm font-medium" style={{ color: C.onSurface }}>{r.title}</p>
            {r.description && <p className="text-xs text-slate-500">{r.description}</p>}
            <p className="mt-0.5 text-xs text-slate-400">
              {formatDateVN(r.recordDate)}{r.createdByName ? ` · ${r.createdByName}` : ""}
              {r.evidenceUrl && <> · <a href={r.evidenceUrl} target="_blank" rel="noreferrer" style={{ color: C.secondary }}>minh chứng</a></>}
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
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-[#1A1C1C]">
        <Ms name="arrow_back" className="!text-[18px]" /> Quay lại
      </button>

      {loading && <div className="space-y-4"><div className="h-24 animate-pulse rounded-3xl bg-slate-100" /><div className="h-64 animate-pulse rounded-3xl bg-slate-100" /></div>}
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
            {data.semesters?.length > 0 && (
              <select value={data.targetSemesterId ?? ""} onChange={(e) => setSearchParams({ semesterId: e.target.value })}
                className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]" style={{ borderColor: C.border, color: C.onSurface }}>
                {data.semesters.map((s) => <option key={s.semesterId} value={s.semesterId}>{s.semesterName} · {s.schoolYearName}</option>)}
              </select>
            )}
          </section>

          {/* Current conduct summary */}
          {cc && (
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox label="Điểm thưởng" value={`+${cc.meritPoints}`} color="#16A34A" />
              <StatBox label="Điểm trừ" value={`-${cc.demeritPoints}`} color="#DC2626" />
              <StatBox label="Điểm rèn luyện" value={cc.finalScore} color={C.onSurface} />
              <StatBox label="Hạnh kiểm" value={cc.grade?.label ?? "—"} color={GRADE_COLOR[cc.grade?.key] ?? C.onSurface} />
            </div>
          )}

          {/* Merit + Demerit history */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#16A34A" }}><Ms name="add_circle" className="!text-[18px]" /> Lịch sử khen thưởng</h3>
              <RecordList items={data.merits} isMerit />
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: "#DC2626" }}><Ms name="remove_circle" className="!text-[18px]" /> Lịch sử vi phạm</h3>
              <RecordList items={data.demerits} isMerit={false} />
            </div>
          </div>

          {/* Conduct history + teacher comments */}
          {data.conductHistory?.length > 0 && (
            <div className="rounded-3xl bg-white p-5 shadow-sm" style={{ border: `1px solid ${C.border}` }}>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold" style={{ color: C.onSurface }}><Ms name="workspace_premium" className="!text-[18px]" style={{ color: C.orange }} /> Lịch sử hạnh kiểm & nhận xét</h3>
              <div className="space-y-2">
                {data.conductHistory.map((h) => (
                  <div key={h.semesterId} className="rounded-3xl px-4 py-3" style={{ border: `1px solid ${C.border}` }}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: C.onSurface }}>{h.semesterName} · {h.schoolYearName}</span>
                      <span className="text-sm font-bold" style={{ color: GRADE_COLOR[
                        h.finalScore >= 80 ? "TOT" : h.finalScore >= 65 ? "KHA" : h.finalScore >= 50 ? "TB" : "YEU"
                      ] }}>
                        {h.conductGrade} · {h.finalScore}/100
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
