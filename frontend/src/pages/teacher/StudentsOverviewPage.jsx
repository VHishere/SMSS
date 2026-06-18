import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiAlertTriangle, FiSearch, FiUsers } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { useClassOverview } from "../../hooks/useClassOverview";
import { useStudentMeta } from "../../hooks/useStudentMeta";

const RISK = {
  HIGH:   { label: "Cao",        bg: "#FEF2F2", text: "#DC2626" },
  MEDIUM: { label: "Trung bình", bg: "#FFFBEB", text: "#F59E0B" },
  LOW:    { label: "Thấp",       bg: "#FFF7F2", text: "#F27123" },
  NONE:   { label: "Ổn định",    bg: "#ECFDF5", text: "#16A34A" },
};

const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function StatBox({ label, value, color }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <p className="text-2xl font-bold leading-none" style={{ color }}>{value}</p>
    </div>
  );
}

function StudentsOverviewPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: meta, loading: metaLoading } = useStudentMeta();

  const [classId,    setClassId]    = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [search,     setSearch]     = useState("");
  const [riskFilter, setRiskFilter] = useState("");

  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const effClassId    = classId    || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesterId || (semesters[0]?.semesterId ? String(semesters[0].semesterId) : "");

  const { data, loading, error } = useClassOverview(effClassId, effSemesterId, Boolean(effClassId));

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const filtered = useMemo(() => {
    let list = data?.students ?? [];
    if (riskFilter) list = list.filter((s) => s.riskLevel === riskFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.studentName.toLowerCase().includes(q) || s.studentCode.toLowerCase().includes(q));
    }
    return list;
  }, [data, riskFilter, search]);

  const summary = data?.summary ?? { total: 0, high: 0, medium: 0, low: 0 };

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"}
    >
      <section className="mb-6 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
        <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Hồ sơ & theo dõi học sinh</h1>
        <p className="text-sm text-slate-500">Theo dõi rủi ro học tập, chuyên cần, hạnh kiểm và xem hồ sơ 360 của từng học sinh.</p>
      </section>

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : classes.length === 0 ? (
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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Mức rủi ro</label>
              <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className={selectCls}>
                <option value="">Tất cả</option>
                <option value="HIGH">Cao</option>
                <option value="MEDIUM">Trung bình</option>
                <option value="LOW">Thấp</option>
                <option value="NONE">Ổn định</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Tìm học sinh</label>
              <div className="flex items-center rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm">
                <FiSearch size={15} className="text-slate-400" />
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tên hoặc mã..."
                  className="w-44 px-2 py-2 text-sm text-[#0F2747] outline-none" />
              </div>
            </div>
          </div>

          {/* Risk summary */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBox label="Tổng học sinh" value={summary.total} color="#08509F" />
            <StatBox label="Rủi ro cao" value={summary.high} color="#DC2626" />
            <StatBox label="Rủi ro TB" value={summary.medium} color="#F59E0B" />
            <StatBox label="Rủi ro thấp" value={summary.low} color="#F27123" />
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {loading && <div className="space-y-2">{[0,1,2,3,4].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}

          {!loading && !error && data && (
            !filtered.length ? (
              <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                Không có học sinh phù hợp.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: "#FFE7D6", backgroundColor: "#FFF7F2" }}>
                        {["HỌC SINH", "CHUYÊN CẦN", "HẠNH KIỂM", "MỤC TIÊU", "RỦI RO", ""].map((c, i) => (
                          <th key={i} className="px-4 py-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#F27123" }}>{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((s, idx) => {
                        const rc = RISK[s.riskLevel] ?? RISK.NONE;
                        return (
                          <tr key={s.studentId} className="border-b last:border-b-0 transition hover:bg-[#FFF7F2]"
                            style={{ borderColor: "#FFF7F2", backgroundColor: idx % 2 === 1 ? "#FAFAFA" : "#fff" }}>
                            <td className="px-4 py-3">
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
                            <td className="px-4 py-3 text-slate-600">{s.attendanceRate === null ? "—" : `${s.attendanceRate}%`}</td>
                            <td className="px-4 py-3 text-slate-600">{s.conductScore ?? "—"}</td>
                            <td className="px-4 py-3 text-slate-600">{s.activeGoals}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: rc.bg, color: rc.text }}>{rc.label}</span>
                              {s.riskReasons?.length > 0 && (
                                <span title={s.riskReasons.join("\n")} className="ml-1 inline-flex"><FiAlertTriangle size={12} style={{ color: rc.text }} /></span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <button type="button" onClick={() => navigate(`/teacher/students/${s.studentId}?semesterId=${effSemesterId}`)}
                                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "#EBF3FF", color: "#08509F" }}>
                                <FiUsers size={11} /> Hồ sơ
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default StudentsOverviewPage;
