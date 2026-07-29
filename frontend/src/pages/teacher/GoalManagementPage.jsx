import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardShell from "../../components/templates/DashboardShell";
import PrettySelect from "../../components/molecules/PrettySelect";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { goalApi } from "../../api/client";
import { useStudentMeta } from "../../hooks/useStudentMeta";

const GOAL_STATUS = {
  IN_PROGRESS: { label: "Đang thực hiện", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED:   { label: "Hoàn thành",     bg: "#ECFDF5", text: "#16A34A" },
  FAILED:      { label: "Chưa đạt",       bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:    { label: "Đã lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };
const C = { onSurface: "#1A1C1C", muted: "#584238", border: "#DFC0B2", orange: "#F27123", secondary: "#225DAD", deepBlue: "#00458E", surfaceLow: "#F3F3F3" };
function Ms({ name, className = "", style }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}
const selectCls =
  "rounded-xl border border-[#DFC0B2] bg-white px-3 py-2 text-sm text-[#1A1C1C] shadow-sm outline-none focus:ring-1 focus:ring-[#00458E]";

function GoalManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: meta, loading: metaLoading } = useStudentMeta();

  const [classId,  setClassId]  = useState("");
  const [status,   setStatus]   = useState("");
  const [goalType, setGoalType] = useState("");
  const [page,     setPage]     = useState(1);

  const [goalTypes, setGoalTypes] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Mục tiêu là nghiệp vụ GVCN → chỉ chọn lớp chủ nhiệm.
  const classes   = (meta?.classes ?? []).filter((c) => c.roleInClass === "HOMEROOM_TEACHER");
  const effClassId = classId || (classes[0]?.classId ? String(classes[0].classId) : "");

  useEffect(() => {
    let m = true;
    goalApi.getTypes().then((res) => { if (m) setGoalTypes(res.data); }).catch(() => {});
    return () => { m = false; };
  }, []);

  useEffect(() => {
    if (!effClassId) return;
    let m = true;
    setLoading(true); setError("");
    goalApi.listByClass({ classId: effClassId, status, goalType, page, limit: 20 })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [effClassId, status, goalType, page]);

  const headerUser = useMemo(() => {
    const roleEntry = user?.roles?.find((r) =>
      ["HOMEROOM_TEACHER", "SUBJECT_TEACHER", "DORM_SUPERVISOR"].includes(r.roleName));
    return { name: user?.fullName ?? user?.username ?? "Giáo viên", role: roleEntry?.description ?? "Giáo viên", avatar: user?.avatar ?? "" };
  }, [user]);

  const pagination = data?.pagination;

  return (
    <DashboardShell
      user={headerUser}
      menuItems={dashboardNavigation.TEACHER}
      sidebarFooterLabel="Lớp"
      sidebarFooterValue={classes.find((c) => String(c.classId) === effClassId)?.className ?? "—"}
    >
      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-3xl bg-slate-100" />
      ) : classes.length === 0 ? (
        <div className="rounded-3xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Bạn chưa phụ trách lớp nào.</div>
      ) : (
        <>
          {/* Toolbar: title + filters (right) */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl" style={{ color: "#1A1C1C" }}>Theo dõi mục tiêu</h1>
            <div className="flex flex-wrap items-end gap-2">
              <PrettySelect value={effClassId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className={selectCls}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </PrettySelect>
              <PrettySelect value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Mọi trạng thái</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="FAILED">Chưa đạt</option>
                <option value="ARCHIVED">Đã lưu trữ</option>
              </PrettySelect>
              <PrettySelect value={goalType} onChange={(e) => { setGoalType(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Mọi loại</option>
                {goalTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </PrettySelect>
            </div>
          </div>

          {error && <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {loading && <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>}

          {!loading && !error && data && (
            !data.items.length ? (
              <div className="rounded-3xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có mục tiêu nào.</div>
            ) : (
              <>
                <div className="overflow-hidden rounded-3xl bg-white shadow-sm" style={{ border: "1px solid #FFE7D6" }}>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-white" style={{ backgroundColor: "#00458E" }}>
                        <tr className="text-left">
                          {["HỌC SINH", "MỤC TIÊU", "LOẠI", "TIẾN ĐỘ", "TRẠNG THÁI", ""].map((c, i) => (
                            <th key={i} className="px-4 py-3 text-xs font-medium uppercase tracking-wider">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "#DFC0B2" }}>
                        {data.items.map((g) => {
                          const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.IN_PROGRESS;
                          const barColor = g.status === "FAILED" ? "#DC2626" : g.status === "COMPLETED" ? "#16A34A" : "#F27123";
                          return (
                            <tr key={g.goalId} onClick={() => navigate(`/teacher/students/${g.studentId}?tab=goals`)}
                              className="group cursor-pointer transition-colors hover:bg-[#F3F3F3]">
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#00458E" }}>
                                    {g.studentAvatar ? <img src={g.studentAvatar} alt={g.studentName} className="h-9 w-9 rounded-full object-cover" /> : (g.studentName?.[0]?.toUpperCase() ?? "?")}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium" style={{ color: "#1A1C1C" }}>{g.studentName}</div>
                                    <div className="text-xs text-slate-400">{g.studentCode}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                  <Ms name="flag" className="!text-[15px] shrink-0" style={{ color: "#225DAD" }} />
                                  <span className="text-sm font-medium" style={{ color: "#1A1C1C" }}>{g.title}</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "rgba(34,93,173,0.1)", color: "#225DAD" }}>{GOAL_TYPE_LABEL[g.goalType] ?? g.goalType}</span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-28 shrink-0 overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: barColor }} />
                                  </div>
                                  <span className="w-9 text-right text-xs font-semibold" style={{ color: barColor }}>{g.progress}%</span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Ms name="chevron_right" className="!text-[18px] inline text-slate-300 transition group-hover:text-[#225DAD]" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                    <span>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Trước</button>
                      <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Sau</button>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}
    </DashboardShell>
  );
}

export default GoalManagementPage;
