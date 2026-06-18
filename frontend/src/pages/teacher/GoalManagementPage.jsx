import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FiFlag, FiPlus } from "react-icons/fi";

import DashboardShell from "../../components/templates/DashboardShell";
import GoalFormModal from "../../components/organisms/GoalFormModal";
import { dashboardNavigation } from "../../config/dashboardNavigation";
import { useAuth } from "../../context/useAuth";
import { goalApi, studentProfileApi } from "../../api/client";
import { useStudentMeta } from "../../hooks/useStudentMeta";

const GOAL_STATUS = {
  IN_PROGRESS: { label: "Đang thực hiện", bg: "#FFFBEB", text: "#F59E0B" },
  COMPLETED:   { label: "Hoàn thành",     bg: "#ECFDF5", text: "#16A34A" },
  FAILED:      { label: "Chưa đạt",       bg: "#FEF2F2", text: "#DC2626" },
  ARCHIVED:    { label: "Đã lưu trữ",     bg: "#F1F5F9", text: "#475569" },
};
const GOAL_TYPE_LABEL = { ACADEMIC: "Học tập", BEHAVIOUR: "Hạnh kiểm", ATTENDANCE: "Chuyên cần", PERSONAL: "Phát triển cá nhân" };
const selectCls =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-[#0F2747] shadow-sm outline-none focus:border-[#08509F] focus:ring-1 focus:ring-[#08509F]";

function GoalManagementPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: meta, loading: metaLoading } = useStudentMeta();

  const [classId,   setClassId]   = useState("");
  const [status,    setStatus]    = useState("");
  const [goalType,  setGoalType]  = useState("");
  const [page,      setPage]      = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  const [goalTypes, setGoalTypes] = useState([]);
  const [students,  setStudents]  = useState([]);
  const [createStudentId, setCreateStudentId] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const classes   = meta?.classes ?? [];
  const semesters = meta?.semesters ?? [];
  const effClassId = classId || (classes[0]?.classId ? String(classes[0].classId) : "");
  const effSemesterId = semesters[0]?.semesterId ? String(semesters[0].semesterId) : "";

  useEffect(() => {
    let m = true;
    goalApi.getTypes().then((res) => { if (m) setGoalTypes(res.data); }).catch(() => {});
    return () => { m = false; };
  }, []);

  // students for the create picker
  useEffect(() => {
    if (!effClassId) return;
    let m = true;
    studentProfileApi.getClassOverview(effClassId, effSemesterId)
      .then((res) => { if (m) { setStudents(res.data.students); setCreateStudentId(String(res.data.students[0]?.studentId ?? "")); } })
      .catch(() => {});
    return () => { m = false; };
  }, [effClassId, effSemesterId]);

  // goals list
  useEffect(() => {
    if (!effClassId) return;
    let m = true;
    setLoading(true); setError("");
    goalApi.listByClass({ classId: effClassId, status, goalType, page, limit: 20 })
      .then((res) => { if (m) setData(res.data); })
      .catch((err) => { if (m) setError(err.message); })
      .finally(() => { if (m) setLoading(false); });
    return () => { m = false; };
  }, [effClassId, status, goalType, page, refreshKey]);

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
      <section className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5 shadow-sm sm:p-6" style={{ border: "1px solid #FFE7D6", backgroundColor: "#fff" }}>
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: "#F27123" }}>Giáo viên</p>
          <h1 className="mb-1 text-2xl font-bold sm:text-3xl" style={{ color: "#0F2747" }}>Quản lý mục tiêu học sinh</h1>
          <p className="text-sm text-slate-500">Theo dõi và đánh giá mục tiêu của học sinh trong lớp phụ trách.</p>
        </div>
        {students.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Học sinh</label>
              <select value={createStudentId} onChange={(e) => setCreateStudentId(e.target.value)} className={selectCls}>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.studentName}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: "#F27123" }}>
              <FiPlus size={15} /> Tạo mục tiêu
            </button>
          </div>
        )}
      </section>

      {metaLoading ? (
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
      ) : classes.length === 0 ? (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ border: "1px solid #FFE7D6", backgroundColor: "#FFF7F2", color: "#0F2747" }}>Bạn chưa phụ trách lớp nào.</div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Lớp</label>
              <select value={effClassId} onChange={(e) => { setClassId(e.target.value); setPage(1); }} className={selectCls}>
                {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Trạng thái</label>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Tất cả</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="COMPLETED">Hoàn thành</option>
                <option value="FAILED">Chưa đạt</option>
                <option value="ARCHIVED">Đã lưu trữ</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Loại</label>
              <select value={goalType} onChange={(e) => { setGoalType(e.target.value); setPage(1); }} className={selectCls}>
                <option value="">Tất cả</option>
                {goalTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
          {loading && <div className="space-y-2">{[0,1,2,3].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}

          {!loading && !error && data && (
            !data.items.length ? (
              <div className="rounded-2xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm" style={{ border: "1px solid #FFE7D6" }}>Chưa có mục tiêu nào.</div>
            ) : (
              <>
                <div className="space-y-3">
                  {data.items.map((g) => {
                    const st = GOAL_STATUS[g.status] ?? GOAL_STATUS.IN_PROGRESS;
                    return (
                      <button key={g.goalId} type="button" onClick={() => navigate(`/teacher/students/${g.studentId}?tab=goals`)}
                        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md" style={{ border: "1px solid #FFE7D6" }}>
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#08509F" }}>
                            {g.studentAvatar ? <img src={g.studentAvatar} alt={g.studentName} className="h-9 w-9 rounded-full object-cover" /> : (g.studentName?.[0]?.toUpperCase() ?? "?")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <FiFlag size={12} style={{ color: "#08509F" }} />
                              <span className="truncate text-sm font-semibold text-[#0F2747]">{g.title}</span>
                            </div>
                            <p className="text-xs text-slate-400">{g.studentName} · {g.studentCode} · {GOAL_TYPE_LABEL[g.goalType] ?? g.goalType}{g.targetDate ? ` · hạn ${g.targetDate}` : ""}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-24">
                            <div className="mb-1 text-right text-xs text-slate-500">{g.progress}%</div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                              <div className="h-full rounded-full" style={{ width: `${g.progress}%`, backgroundColor: "#F27123" }} />
                            </div>
                          </div>
                          <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.text }}>{st.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                    <span>{(page - 1) * pagination.limit + 1}–{Math.min(page * pagination.limit, pagination.total)} / {pagination.total}</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Trước</button>
                      <button type="button" onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-slate-50">Sau</button>
                    </div>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}

      {showCreate && createStudentId && (
        <GoalFormModal mode="create" studentId={Number(createStudentId)} goalTypes={goalTypes}
          onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); setRefreshKey((k) => k + 1); }} />
      )}
    </DashboardShell>
  );
}

export default GoalManagementPage;
